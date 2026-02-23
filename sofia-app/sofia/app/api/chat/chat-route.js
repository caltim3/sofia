import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sofia chat system prompt — carries the reasoning engine into follow-up conversations
const CHAT_SYSTEM_PROMPT = `You are SOFIA, a Second Brain strategic cognition layer, continuing a conversation about a specific entry.

Your role in chat mode:
- Answer follow-up questions with the same depth and specificity as the original response
- Build on the entry's content — don't repeat what was already said
- Apply domain expertise: if it's a music/jazz topic, use correct theory terminology; if it's a business topic, apply strategic rigor
- Be direct and decision-useful
- Do not use filler, generic advice, or unnecessary hedging
- Format with Markdown when structure helps clarity
- Keep responses under 600 words unless the question demands more`

// ── Model callers ──────────────────────────────────────────────
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
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.content?.map(b => b.text || '').join('') || ''
}

async function callOpenAI(messages, system) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized — no auth header' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized — invalid session' }, { status: 401 })
    }

    const body = await request.json()
    const { entryId, message, model = 'claude' } = body

    if (!entryId || !message?.trim()) {
      return NextResponse.json({ error: 'entryId and message are required' }, { status: 400 })
    }

    // ── Fetch the parent entry for context ──
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('title, body, response, category')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // ── Load prior messages for this entry ──
    const { data: priorMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true })

    // ── Build conversation: seed with original entry Q&A, then history ──
    const conversationMessages = [
      // Seed: the original prompt and Sofia's response
      { role: 'user', content: entry.body || entry.title },
      { role: 'assistant', content: entry.response || 'I have analyzed this entry.' },
      // Prior chat history
      ...(priorMessages || []).map(m => ({ role: m.role, content: m.content })),
      // New message
      { role: 'user', content: message },
    ]

    // Build system prompt with entry context
    const system = `${CHAT_SYSTEM_PROMPT}

Entry context:
- Title: "${entry.title}"
- Category: ${entry.category}
- This is a follow-up conversation about the entry above.`

    // ── Call AI ──
    const caller = model === 'gpt4' ? callOpenAI : callAnthropic
    const aiResponse = await caller(conversationMessages, system)

    // ── Save user message ──
    await supabase.from('messages').insert({
      user_id: user.id,
      entry_id: entryId,
      role: 'user',
      content: message,
      model: model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4',
    })

    // ── Save assistant message and return it ──
    const { data: saved, error: saveError } = await supabase
      .from('messages')
      .insert({
        user_id: user.id,
        entry_id: entryId,
        role: 'assistant',
        content: aiResponse,
        model: model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4',
      })
      .select()
      .single()

    if (saveError) {
      // Still return the response even if save fails — user sees the answer
      console.error('Message save error:', saveError)
      return NextResponse.json({
        message: {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: aiResponse,
          created_at: new Date().toISOString(),
        },
        warning: 'Response generated but could not be saved. Check that the messages table exists in Supabase.',
      })
    }

    return NextResponse.json({ message: saved })

  } catch (err) {
    console.error('Chat route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
