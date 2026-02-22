import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
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
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

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

    const { entryId, message, model = 'claude' } = await request.json()
    if (!entryId || !message) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

    // Get the entry for context
    const { data: entry } = await supabase.from('entries').select('*').eq('id', entryId).single()
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    // Get previous messages for context
    const { data: prevMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true })
      .limit(20)

    // Build conversation
    const system = `You are Sofia, an analytical assistant. You are continuing a conversation about an entry titled "${entry.title}" (category: ${entry.category}).

Here is the original entry content for context:
---
${entry.content}
---

Provide helpful, structured follow-up responses using Markdown. Be concise but thorough.`

    const conversationMessages = [
      { role: 'user', content: entry.content },
      { role: 'assistant', content: 'I\'ve analyzed this. What would you like to explore further?' },
      ...(prevMessages || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    // Save user message
    await supabase.from('messages').insert({
      user_id: user.id, entry_id: entryId, role: 'user', content: message, model,
    })

    // Call AI
    let response
    if (model === 'gpt4') {
      response = await callOpenAI(conversationMessages, system)
    } else {
      response = await callAnthropic(conversationMessages, system)
    }

    // Save assistant message
    const { data: saved } = await supabase.from('messages').insert({
      user_id: user.id, entry_id: entryId, role: 'assistant', content: response, model,
    }).select().single()

    return NextResponse.json({ message: saved })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
