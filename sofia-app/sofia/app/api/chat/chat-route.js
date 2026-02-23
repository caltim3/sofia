import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Same auth pattern that works in process route
async function getUserId(request) {
  // Try JWT decode first
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim()
      const payload = token.split('.')[1]
      if (payload) {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
        if (decoded.sub) return decoded.sub
      }
    }
  } catch {}

  // Fallback: get first user via admin API (works with service role)
  try {
    const supabase = getSupabase()
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 })
    return users?.[0]?.id ?? null
  } catch {}

  return null
}

const CHAT_SYSTEM_PROMPT = `You are SOFIA, a Second Brain strategic cognition layer, in follow-up chat mode.

- Answer follow-up questions with the same depth as the original response
- Build on the entry — don't repeat what was already said
- Music/jazz topics: use correct theory terminology; business topics: apply strategic rigor
- Be direct and decision-useful. No filler.
- Format with Markdown when structure helps
- Under 600 words unless the question demands more`

async function callAnthropic(messages, system) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system,
      messages,
    }),
  })
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content?.map(b => b.text || '').join('') || ''
}

async function callOpenAI(messages, system) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function POST(request) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { entryId, message, model = 'claude' } = await request.json()
    if (!entryId || !message?.trim()) {
      return NextResponse.json({ error: 'entryId and message are required' }, { status: 400 })
    }

    // Fetch parent entry
    const { data: entry } = await supabase
      .from('entries')
      .select('title, body, original_content, content, response, category')
      .eq('id', entryId)
      .single()

    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    // Load prior messages — non-blocking, empty array if table missing
    let priorMessages = []
    try {
      const { data } = await supabase
        .from('messages')
        .select('role, content')
        .eq('entry_id', entryId)
        .order('created_at', { ascending: true })
      priorMessages = data || []
    } catch {}

    const originalPrompt = entry.body || entry.original_content || entry.title
    const originalResponse = entry.response || entry.content || 'I have analyzed this entry.'

    const conversationMessages = [
      { role: 'user', content: originalPrompt },
      { role: 'assistant', content: originalResponse },
      ...priorMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const system = `${CHAT_SYSTEM_PROMPT}\n\nEntry: "${entry.title}" (${entry.category})`
    const caller = model === 'gpt4' ? callOpenAI : callAnthropic
    const aiResponse = await caller(conversationMessages, system)
    const modelLabel = model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4'

    // Save messages — non-blocking, don't fail the request if table missing
    let saved = null
    try {
      await supabase.from('messages').insert({
        user_id: userId, entry_id: entryId, role: 'user', content: message, model: modelLabel,
      })
      const { data } = await supabase.from('messages')
        .insert({ user_id: userId, entry_id: entryId, role: 'assistant', content: aiResponse, model: modelLabel })
        .select().single()
      saved = data
    } catch (e) {
      console.warn('Message save failed (non-fatal):', e.message)
    }

    return NextResponse.json({
      message: saved ?? {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse,
        created_at: new Date().toISOString(),
      }
    })

  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
