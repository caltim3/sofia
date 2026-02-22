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

    const { entryId, format } = await request.json()

    const { data: entry } = await supabase.from('entries').select('*').eq('id', entryId).single()
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    const date = new Date(entry.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const tags = entry.tags?.length > 0 ? entry.tags.map(t => `#${t}`).join(' ') : ''

    const markdown = `# ${entry.title}

**Category:** ${entry.category}  
**Date:** ${date}  
${tags ? `**Tags:** ${tags}  ` : ''}

---

${entry.summary ? `> **Summary:** ${entry.summary}\n\n---\n\n` : ''}${entry.content}

---

*Exported from Sofia Knowledge System*
`

    return NextResponse.json({ markdown, title: entry.title })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
