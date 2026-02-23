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
Before writing the response, identify the domain(s) and intent, then apply the appropriate depth model.

**Domain Depth Models**

1. Historical / Cultural / Event-Based
   - Provide origin and chronology. Identify actors and context.
   - Explain why it mattered then and now. Address misconceptions.

2. Technical / Engineering / Software
   - Define system boundaries. Explain mechanisms end-to-end.
   - Identify dependencies and failure modes.

3. Business / Strategy
   - Define objective and constraints. Identify value drivers and structural forces.
   - Evaluate tradeoffs and second-order effects. Provide decision criteria and recommendation.

4. Finance / Legal / Regulatory
   - Identify governing rules and thresholds.
   - Highlight timelines, compliance gates, documentation.
   - Flag uncertainties requiring verification.

5. Personal / Health / Lifestyle
   - Provide measurable guidance. Identify risks and escalation points.

6. Creative / Writing
   - Improve clarity, logic, structure, and persuasion.
   - Maintain voice and audience alignment.

7. Music / Jazz / Theory
   - Apply domain-specific terminology accurately (modes, chord-scale relationships, voice leading, bebop conventions).
   - Reference real musicians, recordings, and methods (e.g. Barry Harris) where relevant.
   - Be technically precise about harmony, rhythm, and form.

**Type Router**
- Research: Build accurate understanding. Use concrete details.
- Brainstorm: Stress-test ideas. Identify assumptions and failure modes.
- Decision: Compare viable options. Identify asymmetric risks. Give a recommendation.
- Draft: Rewrite clearly. Improve structure. Include rationale for changes.
- Tasks: Clarify and reorganize. Do not add new tasks.
- Observation: Extract implications. Distinguish temporary from durable effects.
- Shopping: Name real products, realistic prices, real retailers. Three tiers. Bold recommendation.

**Structural Integrity Rule**
- Do not force managerial frameworks onto purely descriptive topics.
- Do not omit sub-questions.
- Do not output surface-level generalities when specifics are available.`

// ─────────────────────────────────────────────
// CATEGORY DEFINITIONS
// ─────────────────────────────────────────────
const VALID_CATEGORIES = ['work', 'music', 'personal', 'ideas', 'books', 'shopping', 'todos', 'travel/food']

const CATEGORY_DESCRIPTIONS = {
  work:          'DevEngine, business, energy, solar, BESS, finance, deals, Spring Lane, regulatory, ITC, FEOC, professional tasks',
  music:         'jazz, guitar, chords, scales, bebop, harmony, Barry Harris, music theory, intervals, modes, improvisation, songs, practice, recordings, teaching',
  personal:      'personal life, health, relationships, home, Ghent, routines, lifestyle',
  'travel/food': 'travel, restaurants, food, trips, places to visit',
  ideas:         'ideas, concepts, brainstorming, hypotheticals, future thinking',
  books:         'books, reading, literature, summaries, analysis',
  shopping:      'shopping, procurement, gear, products, purchases, equipment',
  todos:         'tasks, todos, action items, reminders, to-do lists',
}

// ─────────────────────────────────────────────
// Brain dump prompt
// ─────────────────────────────────────────────
const BRAINDUMP_PROMPT = `You are Sofia processing a brain dump. Parse it into SEPARATE distinct thoughts/ideas. For EACH thought, output exactly:

---ENTRY---
CATEGORY: <work|music|personal|ideas|books|shopping|todos|travel/food>
TITLE: <short descriptive title>

<Full Markdown content using Sofia Reasoning Engine standards: specific, decision-useful, no filler>

---END---

Rules:
- Each thought gets its own ---ENTRY--- block
- Classify each independently — music content MUST be "music", business content MUST be "work"
- Minimum 2 entries, maximum 8 entries
- Never use HTML, only Markdown`

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
      model: 'gpt-4o',
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
// Category classification — keyword-first, AI fallback
// ─────────────────────────────────────────────
async function classifyCategory(prompt, aiResponse) {
  const combined = (prompt + ' ' + aiResponse).toLowerCase()

  // Hard rules — don't call AI for obvious cases
  if (/jazz|bebop|barry harris|chord voic|music theory|guitar lick|ii[\s-]v|tritone sub|chord tone|arpeggio|comping|walking bass|lead sheet|fake book|pentatonic|dorian|mixolydian|lydian|phrygian|locrian|kenny burrell|wes montgomery|pat metheny|joe pass|grant green|freddie green/.test(combined)) return 'music'
  if (/devengin|spring lane|solar project|bess|battery energy|feoc|itc adder|safe harbor|ppa|offtake|megawatt|kwh|utility scale|net metering|energy storage|project finance|tax equity/.test(combined)) return 'work'
  if (/\btodo\b|action item|to-do|checklist/.test(combined)) return 'todos'
  if (/\bbook\b|novel|reading|chapter|author|literature|memoir|biography/.test(combined)) return 'books'
  if (/buy|purchase|price range|product review|brand comparison|retailer|best.*under \$/.test(combined)) return 'shopping'
  if (/restaurant|where to eat|trip to|travel|visiting/.test(combined)) return 'travel/food'

  // AI fallback
  const classifySystem = `You classify content for a second brain app. Given a prompt and AI response, return EXACTLY ONE of these category names with no other text, punctuation, or explanation:
work, music, personal, ideas, books, shopping, todos, travel/food

Definitions:
${Object.entries(CATEGORY_DESCRIPTIONS).map(([k, v]) => `${k}: ${v}`).join('\n')}`

  try {
    const result = await callAnthropic(
      classifySystem,
      `Prompt: "${prompt.slice(0, 300)}"\n\nResponse preview: "${aiResponse.slice(0, 300)}"`
    )
    const cleaned = result.trim().toLowerCase().replace(/\s/g, '').replace(/[^a-z/]/g, '')
    return VALID_CATEGORIES.includes(cleaned) ? cleaned : 'ideas'
  } catch {
    return 'ideas'
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function generateTitle(prompt) {
  const cleaned = prompt.replace(/^#(dump|short|challenge)\s*/i, '').trim()
  return cleaned.length <= 60 ? cleaned : cleaned.slice(0, 57) + '...'
}

function parseBrainDump(raw) {
  const blocks = raw.split('---ENTRY---').slice(1)
  return blocks.map(block => {
    const end = block.indexOf('---END---')
    const content = end > -1 ? block.slice(0, end).trim() : block.trim()
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
    const authHeader = request.headers.get('authorization')

    // Try user-scoped auth first (anon key + Bearer token from frontend session)
    let supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    )

    let user = null
    if (authHeader) {
      const { data } = await supabase.auth.getUser()
      user = data?.user ?? null
    }

    // Fallback: service role key (compatible with older auth pattern in this app)
    if (!user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data } = await supabase.auth.getUser(token)
        user = data?.user ?? null
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    // Accept both old field name (promptBody) and new (prompt)
    const { prompt: newPrompt, promptBody, promptId, model = 'claude', mode } = body
    const prompt = newPrompt || promptBody

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const isBrainDump = /^#dump\s/i.test(prompt.trim()) || mode === 'brain_dump'
    const isChallenge = /^#challenge\s/i.test(prompt.trim()) || mode === 'challenge'
    const caller = model === 'gpt4' ? callOpenAI : callAnthropic
    const modelLabel = model === 'gpt4' ? 'gpt-4o' : 'claude-sonnet-4'

    // ── Brain Dump ──────────────────────────────
    if (isBrainDump) {
      const cleanPrompt = prompt.replace(/^#dump\s*/i, '').trim()
      const raw = await caller(BRAINDUMP_PROMPT, cleanPrompt)
      const parsed = parseBrainDump(raw)

      if (parsed.length === 0) {
        return NextResponse.json({ error: 'Could not parse brain dump' }, { status: 500 })
      }

      const inserted = []
      for (const e of parsed) {
        const { data } = await supabase.from('entries').insert({
          user_id: user.id,
          title: e.title,
          body: cleanPrompt,
          response: e.content,
          category: e.category,
          model: modelLabel,
          source: 'brain_dump',
        }).select().single()
        if (data) inserted.push(data)
      }

      if (promptId) {
        await supabase.from('prompts')
          .update({ status: 'Completed', processed_at: new Date().toISOString() })
          .eq('id', promptId)
      }

      return NextResponse.json({ entries: inserted, type: 'brain_dump' })
    }

    // ── Standard + Challenge Mode ───────────────
    const systemPrompt = isChallenge
      ? SOFIA_SYSTEM_PROMPT + '\n\nAdditional: This is challenge/devil\'s advocate mode. Steelman the opposite view rigorously. Find genuine weaknesses. Do not be a pushover.'
      : SOFIA_SYSTEM_PROMPT

    const cleanPrompt = prompt.replace(/^#(short|challenge)\s*/i, '').trim()
    const aiResponse = await caller(systemPrompt, cleanPrompt)
    const category = await classifyCategory(cleanPrompt, aiResponse)
    const title = generateTitle(cleanPrompt)

    const { data: entry, error } = await supabase.from('entries').insert({
      user_id: user.id,
      title,
      body: cleanPrompt,
      response: aiResponse,
      category,
      model: modelLabel,
    }).select().single()

    if (error) throw error

    if (promptId) {
      await supabase.from('prompts')
        .update({ status: 'Completed', processed_at: new Date().toISOString() })
        .eq('id', promptId)
    }

    return NextResponse.json({ entries: [entry], category, type: 'standard' })

  } catch (err) {
    console.error('Process error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
