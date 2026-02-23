import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getUser(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '').trim()
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

const CHAT_SYSTEM_PROMPT = `You are SOFIA, a Second Brain strategic cognition layer, in follow-up chat mode.

Your role:
- Answer follow-up questions with the same depth as the original response
- Build on the entry — don't repeat what was already said
- Apply domain expertise: music/jazz = correct theory terminology; business = strategic rigor
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
    const user = await getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { entryId, message, model = 'claude' } = await request.json()

    if (!entryId || !message?.trim()) {
      return NextResponse.json({ error: 'entryId and message are required' }, { status: 400 })
    }

    // Fetch parent entry for context
    const { data: entry } = await supabase
      .from('entries')
      .select('title, body, response, category')
      .eq('id', entryId)
      .single()

    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    // Load prior messages
    const { data: priorMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true })

    const conversationMessages = [
      { role: 'user', content: entry.body || entry.title },
      { role: 'assistant', content: entry.response || 'I have analyzed this entry.' },
      ...(priorMessages || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const system = `${CHAT_SYSTEM_PROMPT}\n\nEntry: "${entry.title}" (${entry.category})`
    const caller = model === 'gpt4' ? callOpenAI : callAnthropic
    const aiResponse = await caller(conversationMessages, system)
    const modelLabel = model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4'

    // Save user message
    await supabase.from('messages').insert({
      user_id: user.id, entry_id: entryId, role: 'user', content: message, model: modelLabel,
    })

    // Save + return assistant message
    const { data: saved, error: saveError } = await supabase
      .from('messages')
      .insert({
        user_id: user.id, entry_id: entryId, role: 'assistant', content: aiResponse, model: modelLabel,
      })
      .select()
      .single()

    if (saveError) {
      // Return response even if save fails
      console.error('Message save error:', saveError)
      return NextResponse.json({
        message: { id: crypto.randomUUID(), role: 'assistant', content: aiResponse, created_at: new Date().toISOString() },
        warning: 'Response generated but not saved — check messages table exists in Supabase',
      })
    }

    return NextResponse.json({ message: saved })

  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
