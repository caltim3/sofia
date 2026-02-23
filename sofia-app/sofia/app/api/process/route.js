import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
- Do not simplify unnecessarily.
- Do not infantilize.
- Do not use filler encouragement or generic advice.

**Length Control**
- If Body contains #short: remove the token, limit output to under 100 words.
- Otherwise limit to under 1000 words.

**Domain Detection**
Before writing the response:
- Identify the domain(s): historical, technical, business, finance, legal, personal, creative, music, procurement, etc.
- Identify intent: explanation, evaluation, decision, execution, or procurement.
- Apply the appropriate depth model.

**Domain Depth Models**

1. Historical / Cultural / Event-Based
   - Provide origin and chronology. Identify actors and context.
   - Explain why it mattered then and now. Address misconceptions.

2. Technical / Engineering / Software
   - Define system boundaries. Explain mechanisms end-to-end.
   - Identify dependencies and failure modes. Provide diagnostics and quality indicators.

3. Business / Strategy
   - Define objective and constraints. Identify value drivers and structural forces.
   - Evaluate tradeoffs and second-order effects. Provide decision criteria and recommendation.

4. Finance / Legal / Regulatory
   - Identify governing rules and thresholds.
   - Highlight timelines, compliance gates, documentation.
   - Provide checklist and decision tree. Flag uncertainties requiring verification.

5. Personal / Health / Lifestyle
   - Provide measurable guidance. Identify risks and escalation points.

6. Creative / Writing
   - Improve clarity, logic, structure, and persuasion.
   - Maintain voice and audience alignment. Provide rationale for major changes.

7. Music / Jazz / Theory
   - Apply domain-specific terminology accurately (modes, chord-scale relationships, voice leading, bebop conventions).
   - Reference real musicians, recordings, and methods (e.g. Barry Harris) where relevant.
   - Be technically precise about harmony, rhythm, and form.

**Type Router**

- Research: Build accurate understanding. Restate scope briefly. Use concrete details.
- Brainstorm: Stress-test ideas. Identify assumptions, failure modes, second-order effects. Conclude with strengthen/reframe/abandon.
- Decision: Define the decision precisely. Compare viable options. Identify asymmetric risks. Give a recommendation.
- Draft: Rewrite clearly and concisely. Improve structure and persuasion. Include "Rationale for Changes."
- Tasks: Clarify and reorganize tasks. Do not add new tasks. Keep under 200 words.
- Observation: Extract implications and patterns. Distinguish temporary from durable effects.
- Shopping: Name real products, realistic prices, real retailers. Use three tiers: Basic/Normal/Luxury. End with bold recommendation.

**Structural Integrity Rule**
- Do not force managerial frameworks onto purely descriptive topics.
- Do not omit sub-questions.
- Do not output surface-level generalities when specifics are available.`

// ─────────────────────────────────────────────
// CATEGORY LIST (explicit — used for classification)
// ─────────────────────────────────────────────
const CATEGORIES = {
  work: 'Work / DevEngine / business / energy / solar / BESS / finance / deals / regulatory / professional tasks',
  music: 'Music / jazz / guitar / theory / harmony / bebop / Barry Harris / scales / chords / songs / practice / recordings / teaching',
  personal: 'Personal life / health / relationships / home / Ghent / routines / lifestyle / travel',
  ideas: 'Ideas / concepts / brainstorming / hypotheticals / future thinking',
  books: 'Books / reading / literature / summaries / analysis',
  shopping: 'Shopping / procurement / gear / products / purchases / equipment',
  todos: 'Tasks / todos / action items / reminders / to-do lists',
}

// ─────────────────────────────────────────────
// Brain dump prompt
// ─────────────────────────────────────────────
const BRAINDUMP_PROMPT = `You are Sofia processing a brain dump. The user has written a stream of consciousness containing multiple ideas, thoughts, and topics.

Parse it into SEPARATE distinct thoughts/ideas. For EACH thought, output it in this exact format:

---ENTRY---
CATEGORY: <work|music|personal|ideas|books|shopping|todos>
TITLE: <short descriptive title>

<Full Markdown content for this thought, using the Sofia Reasoning Engine standards: specific, decision-useful, no filler>

---END---

Rules:
- Each thought gets its own ---ENTRY--- block
- Classify each independently using the correct category
- Give each a clear, specific title
- Expand on each thought with structure and detail
- Minimum 2 entries, maximum 8 entries from a single brain dump
- For music-related thoughts, classify as "music" — not "personal"
- For work/business thoughts, classify as "work" — not "ideas"
- Never use HTML, only Markdown`

// ─────────────────────────────────────────────
// Model callers — LATEST MODELS
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
      model: 'claude-sonnet-4-20250514', // Claude Sonnet 4 — latest
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.content?.map(b => b.text || '').join('') || ''
}

async function callOpenAI(systemPrompt, userMessage) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o', // GPT-4o — latest
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─────────────────────────────────────────────
// Classify category — explicit + AI-assisted
// ─────────────────────────────────────────────
async function classifyCategory(prompt, aiResponse) {
  const classifySystemPrompt = `You are a precise content classifier for a second brain app.

Given a user's prompt and the AI response to it, classify it into EXACTLY ONE of these categories:

work     — ${CATEGORIES.work}
music    — ${CATEGORIES.music}
personal — ${CATEGORIES.personal}
ideas    — ${CATEGORIES.ideas}
books    — ${CATEGORIES.books}
shopping — ${CATEGORIES.shopping}
todos    — ${CATEGORIES.todos}

RULES:
- If the content mentions jazz, guitar, chords, scales, harmony, bebop, Barry Harris, music theory, or any musical instrument → ALWAYS return "music"
- If the content mentions DevEngine, solar, BESS, energy, deals, Spring Lane, ITC, FEOC, investors, or business finance → ALWAYS return "work"
- If the content is a task list or action items → return "todos"
- Return ONLY the single category word. No punctuation, no explanation.`

  const classifyInput = `User prompt: "${prompt}"\n\nAI response summary: "${aiResponse.slice(0, 500)}"`

  try {
    const result = await callAnthropic(classifySystemPrompt, classifyInput)
    const cleaned = result.trim().toLowerCase().replace(/[^a-z]/g, '')
    return CATEGORIES[cleaned] ? cleaned : 'ideas'
  } catch {
    // Fallback: keyword detection
    const combined = (prompt + ' ' + aiResponse).toLowerCase()
    if (/jazz|guitar|chord|scale|bebop|harmony|barry harris|music|note|interval|mode|improvise|solo|rhythm|melody/.test(combined)) return 'music'
    if (/devengi|solar|bess|battery|energy|deal|spring lane|itc|feoc|investor|megawatt|kwh|ppa|offtake/.test(combined)) return 'work'
    if (/todo|task|action item|reminder|to-do|checklist/.test(combined)) return 'todos'
    if (/book|novel|reading|chapter|author|literature/.test(combined)) return 'books'
    if (/buy|purchase|price|product|brand|retailer|shop/.test(combined)) return 'shopping'
    if (/ghent|house|home|personal|health|travel|family/.test(combined)) return 'personal'
    return 'ideas'
  }
}

// ─────────────────────────────────────────────
// Generate title from prompt
// ─────────────────────────────────────────────
function generateTitle(prompt) {
  const cleaned = prompt.replace(/^#(dump|short|challenge)\s*/i, '').trim()
  if (cleaned.length <= 60) return cleaned
  return cleaned.slice(0, 57) + '...'
}

// ─────────────────────────────────────────────
// Parse brain dump response into entries
// ─────────────────────────────────────────────
function parseBrainDump(raw) {
  const blocks = raw.split('---ENTRY---').slice(1)
  return blocks.map(block => {
    const end = block.indexOf('---END---')
    const content = end > -1 ? block.slice(0, end).trim() : block.trim()
    const lines = content.split('\n')

    let category = 'ideas'
    let title = 'Thought'
    let bodyLines = []
    let headerDone = false

    for (const line of lines) {
      if (!headerDone && line.startsWith('CATEGORY:')) {
        const val = line.replace('CATEGORY:', '').trim().toLowerCase()
        category = CATEGORIES[val] ? val : 'ideas'
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
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { prompt, model = 'claude' } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const isBrainDump = /^#dump\s/i.test(prompt.trim())
    const caller = model === 'gpt4' ? callOpenAI : callAnthropic

    // ── Brain Dump ──
    if (isBrainDump) {
      const cleanPrompt = prompt.replace(/^#dump\s*/i, '').trim()
      const raw = await caller(BRAINDUMP_PROMPT, cleanPrompt)
      const entries = parseBrainDump(raw)

      if (entries.length === 0) {
        return NextResponse.json({ error: 'Could not parse brain dump' }, { status: 500 })
      }

      const inserted = []
      for (const entry of entries) {
        const { data, error } = await supabase.from('entries').insert({
          user_id: user.id,
          title: entry.title,
          body: cleanPrompt,
          response: entry.content,
          category: entry.category,
          model: model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4',
          source: 'brain_dump',
        }).select().single()
        if (!error && data) inserted.push(data)
      }

      return NextResponse.json({ entries: inserted, type: 'brain_dump' })
    }

    // ── Standard Entry ──
    const aiResponse = await caller(SOFIA_SYSTEM_PROMPT, prompt)

    // Classify category with strong rules
    const category = await classifyCategory(prompt, aiResponse)

    // Generate title
    const title = generateTitle(prompt)

    // Save to Supabase
    const { data: entry, error } = await supabase.from('entries').insert({
      user_id: user.id,
      title,
      body: prompt,
      response: aiResponse,
      category,
      model: model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4',
    }).select().single()

    if (error) throw error

    return NextResponse.json({ entry })

  } catch (err) {
    console.error('Process error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
