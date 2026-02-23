import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// No auth check — frontend sends no Authorization header
// Service role handles all DB operations
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// ─────────────────────────────────────────────
// SOFIA REASONING ENGINE — System Prompt
// ─────────────────────────────────────────────
const SOFIA_SYSTEM_PROMPT = `You are SOFIA, a Second Brain strategic cognition layer.

**Mission**
Transform captured inputs into accurate, domain-correct understanding, refined writing, or actionable guidance that materially improves clarity, judgment, and execution. Output must be intelligent, specific, and decision-useful.

**Core Standards**

Responsiveness Rule
- Always answer the actual question asked.
- If multiple questions are asked, answer each explicitly.
- Never output a structure that ignores part of the question.

Specificity Rule
- Avoid placeholders. Avoid vague language.
- Use real examples, real products, real mechanisms, real dates when appropriate.
- Do not fabricate precision. Use realistic ranges and well-known sources.

Tone Rule
- Assume a sophisticated, fluent, decision-capable reader.
- Do not simplify unnecessarily. Do not infantilize.
- Do not use filler encouragement or generic advice.

**Length Control**
- If Body contains #short: remove the token, limit output to under 100 words.
- Otherwise limit to under 1000 words.

**Domain Depth Models**

1. Historical / Cultural / Event-Based: origin, chronology, actors, context, misconceptions.
2. Technical / Engineering / Software: system boundaries, mechanisms, dependencies, failure modes.
3. Business / Strategy: objective, constraints, value drivers, tradeoffs, recommendation.
4. Finance / Legal / Regulatory: governing rules, timelines, compliance gates, uncertainties.
5. Personal / Health / Lifestyle: measurable guidance, risks, escalation points.
6. Creative / Writing: clarity, logic, structure, persuasion, voice alignment.
7. Music / Jazz / Theory: correct terminology (modes, chord-scale relationships, voice leading, bebop conventions). Reference real musicians, recordings, methods (e.g. Barry Harris). Technically precise about harmony, rhythm, form.

**Type Router**
- Research: accurate understanding, concrete details.
- Brainstorm: stress-test ideas, assumptions, failure modes.
- Decision: compare options, asymmetric risks, give a recommendation.
- Draft: rewrite clearly, improve structure, include rationale for changes.
- Tasks: clarify and reorganize only, do not add new tasks.
- Observation: extract implications, distinguish temporary from durable effects.
- Shopping: real products, realistic prices, real retailers, three tiers, bold recommendation.

**Structural Integrity Rule**
Do not force frameworks onto descriptive topics. Do not omit sub-questions. Do not output generalities when specifics are available.`

// ─────────────────────────────────────────────
// Category definitions
// ─────────────────────────────────────────────
const VALID_CATEGORIES = ['work', 'music', 'personal', 'ideas', 'books', 'shopping', 'todos', 'travel/food']

const BRAINDUMP_PROMPT = `You are Sofia processing a brain dump. Parse it into SEPARATE distinct thoughts. For EACH, output:

---ENTRY---
CATEGORY: <work|music|personal|ideas|books|shopping|todos|travel/food>
TITLE: <short descriptive title>

<Full Markdown content — specific, decision-useful, no filler>

---END---

Rules: each thought = own block. Music content = "music". Business content = "work". Min 2, max 8 entries. Markdown only.`

// ─────────────────────────────────────────────
// Model callers
// ─────────────────────────────────────────────
async function callAnthropic(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content?.map(b => b.text || '').join('') || ''
}

async function callOpenAI(systemPrompt, userMessage) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4000,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─────────────────────────────────────────────
// Category classification
// ─────────────────────────────────────────────
async function classifyCategory(prompt, aiResponse) {
  const combined = (prompt + ' ' + aiResponse).toLowerCase()

  if (/jazz|bebop|barry harris|chord voic|music theory|guitar lick|ii[\s-]v|tritone sub|arpeggio|comping|walking bass|lead sheet|pentatonic|dorian|mixolydian|lydian|phrygian|locrian|kenny burrell|wes montgomery|pat metheny|joe pass|grant green|freddie green|chord scale|voice leading|improvise/.test(combined)) return 'music'
  if (/devengin|spring lane|solar project|bess|battery energy|feoc|itc adder|safe harbor|ppa|offtake|megawatt|kwh|utility scale|energy storage|project finance|tax equity/.test(combined)) return 'work'
  if (/\btodo\b|action item|to-do|checklist/.test(combined)) return 'todos'
  if (/\bbook\b|novel|reading|chapter|author|literature|memoir|biography/.test(combined)) return 'books'
  if (/buy|purchase|price range|product review|brand comparison|best.*under \$/.test(combined)) return 'shopping'
  if (/restaurant|where to eat|trip to|travel|visiting/.test(combined)) return 'travel/food'

  try {
    const result = await callAnthropic(
      `Classify into exactly one of: work, music, personal, ideas, books, shopping, todos, travel/food. Return only the category word.`,
      `"${prompt.slice(0, 300)}"`
    )
    const cleaned = result.trim().toLowerCase().replace(/[^a-z/]/g, '')
    return VALID_CATEGORIES.includes(cleaned) ? cleaned : 'ideas'
  } catch {
    return 'ideas'
  }
}

function generateTitle(prompt) {
  const cleaned = prompt.replace(/^#(dump|short|challenge)\s*/i, '').trim()
  return cleaned.length <= 60 ? cleaned : cleaned.slice(0, 57) + '...'
}

function parseBrainDump(raw) {
  return raw.split('---ENTRY---').slice(1).map(block => {
    const end = block.indexOf('---END---')
    const content = (end > -1 ? block.slice(0, end) : block).trim()
    const lines = content.split('\n')
    let category = 'ideas', title = 'Thought', bodyLines = [], headerDone = false
    for (const line of lines) {
      if (!headerDone && line.startsWith('CATEGORY:')) {
        const val = line.replace('CATEGORY:', '').trim().toLowerCase()
        category = VALID_CATEGORIES.includes(val) ? val : 'ideas'
      } else if (!headerDone && line.startsWith('TITLE:')) {
        title = line.replace('TITLE:', '').trim()
        headerDone = true
      } else {
        bodyLines.push(line)
      }
    }
    return { title, category, content: bodyLines.join('\n').trim() }
  }).filter(e => e.title && e.content)
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
export async function POST(request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()

    // Frontend sends: { content, template_type, template_data, model }
    // Legacy sends:   { promptBody, promptId, model, mode }
    const {
      content,
      prompt: promptField,
      promptBody,
      promptId,
      model = 'claude',
      mode,
      template_type = 'freeform',
      template_data,
    } = body

    const prompt = content || promptField || promptBody

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Get user_id — try prompts table, then fall back to first auth user
    let userId = null
    if (promptId) {
      const { data: promptRecord } = await supabase
        .from('prompts').select('user_id').eq('id', promptId).single()
      userId = promptRecord?.user_id ?? null
    }
    if (!userId) {
      try {
        const result = await supabase.auth.admin.listUsers({ perPage: 1 })
        userId = result?.data?.users?.[0]?.id ?? null
      } catch (e) {
        console.error('listUsers failed:', e.message)
      }
    }

    const isBrainDump = /^#dump\s/i.test(prompt.trim()) || mode === 'brain_dump'
    const isChallenge = /^#challenge\s/i.test(prompt.trim()) || mode === 'challenge'
    const caller = model === 'gpt4' ? callOpenAI : callAnthropic
    const modelLabel = model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4'

    // ── Brain Dump ──
    if (isBrainDump) {
      const cleanPrompt = prompt.replace(/^#dump\s*/i, '').trim()
      const raw = await caller(BRAINDUMP_PROMPT, cleanPrompt)
      const parsed = parseBrainDump(raw)
      if (parsed.length === 0) return NextResponse.json({ error: 'Could not parse brain dump' }, { status: 500 })

      const inserted = []
      for (const e of parsed) {
        const { data } = await supabase.from('entries').insert({
          user_id: userId, title: e.title,
          content: e.content, response: e.content, summary: e.content,
          original_content: cleanPrompt, body: cleanPrompt,
          category: e.category, model: modelLabel,
        }).select().single()
        if (data) inserted.push(data)
      }

      if (promptId) await supabase.from('prompts').update({ status: 'Completed', processed_at: new Date().toISOString() }).eq('id', promptId)
      return NextResponse.json({ entries: inserted, type: 'brain_dump' })
    }

    // ── Standard + Challenge ──
    const systemPrompt = isChallenge
      ? SOFIA_SYSTEM_PROMPT + '\n\nChallenge mode: steelman the opposite view rigorously. Find genuine weaknesses. Do not be a pushover.'
      : SOFIA_SYSTEM_PROMPT

    const cleanPrompt = prompt.replace(/^#(short|challenge)\s*/i, '').trim()
    const aiResponse = await caller(systemPrompt, cleanPrompt)
    const category = await classifyCategory(cleanPrompt, aiResponse)
    const title = generateTitle(cleanPrompt)

    const { data: entry, error } = await supabase.from('entries').insert({
      user_id: userId, title,
      content: aiResponse, response: aiResponse, summary: aiResponse,
      original_content: cleanPrompt, body: cleanPrompt,
      category, model: modelLabel,
    }).select().single()

    if (error) throw error

    if (promptId) await supabase.from('prompts').update({ status: 'Completed', processed_at: new Date().toISOString() }).eq('id', promptId)

    // Return both formats for compatibility
    return NextResponse.json({ entry, entries: [entry], category, success: true })

  } catch (err) {
    console.error('Process error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
