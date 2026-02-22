import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const notionKey = process.env.NOTION_API_KEY
    const notionDbId = process.env.NOTION_DATABASE_ID
    if (!notionKey || !notionDbId) {
      return NextResponse.json({ error: 'Notion not configured. Add NOTION_API_KEY and NOTION_DATABASE_ID to environment variables.' }, { status: 400 })
    }

    const { entryId } = await request.json()
    if (!entryId) return NextResponse.json({ error: 'Missing entry ID' }, { status: 400 })

    const { data: entry } = await supabase.from('entries').select('*').eq('id', entryId).single()
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    // Split content into Notion blocks (max 2000 chars per block)
    const contentChunks = []
    const lines = entry.content.split('\n')
    let currentChunk = ''
    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > 1800) {
        if (currentChunk) contentChunks.push(currentChunk)
        currentChunk = line
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line
      }
    }
    if (currentChunk) contentChunks.push(currentChunk)

    // Create Notion page
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: notionDbId },
        properties: {
          'Name': {
            title: [{ text: { content: entry.title } }],
          },
          ...(await getNotionProperties(entry)),
        },
        children: contentChunks.map(chunk => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }],
          },
        })),
      }),
    })

    if (!notionRes.ok) {
      const errData = await notionRes.json()
      console.error('Notion API error:', errData)
      return NextResponse.json({ error: `Notion error: ${errData.message || 'Unknown'}` }, { status: 502 })
    }

    const notionPage = await notionRes.json()
    return NextResponse.json({ url: notionPage.url, id: notionPage.id })
  } catch (err) {
    console.error('Notion sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function getNotionProperties(entry) {
  const props = {}
  // Try to set Category as select property (will work if the Notion DB has it)
  try {
    props['Category'] = { select: { name: entry.category } }
  } catch {}
  // Try to set Tags as multi_select
  try {
    if (entry.tags?.length > 0) {
      props['Tags'] = { multi_select: entry.tags.map(t => ({ name: t })) }
    }
  } catch {}
  return props
}
