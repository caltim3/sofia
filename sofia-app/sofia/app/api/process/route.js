import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_CATEGORIES = ['Decision', 'Brainstorm', 'Shopping', 'Observation', 'Draft']

function getSystemPrompt(customCategories = []) {
  const allCats = [...DEFAULT_CATEGORIES, ...customCategories].join(', ')
  return `You are Sofia, an analytical assistant and second brain. Always classify your response into one of the allowed categories: ${allCats}.

The first line of your response must STRICTLY follow this format:
CATEGORY: <CategoryName>

Then leave a blank line.

Then provide a fully structured Markdown answer using:
- Proper headings (## and ###)
- Bullet lists and numbered lists where appropriate
- Bold and italic for emphasis
- Paragraphs with clear structure
- Be concise but thorough
- Avoid fluff
- Never use HTML formatting, only Markdown

Classification guide:
- Decision: When the user is weighing options, making choices, or needs help deciding something
- Brainstorm: When the user is exploring ideas, generating possibilities, or thinking creatively
- Shopping: When the user mentions products, purchases, comparisons of things to buy, or wishlists
- Observation: General notes, insights, reflections, factual information, or anything that doesn't fit other categories
- Draft: When the user is writing content, composing messages, creating documents, or producing written output
${customCategories.length > 0 ? `\nCustom categories available: ${customCategories.join(', ')}. Use these when the content clearly fits.` : ''}`
}

const CHALLENGE_PROMPT = `You are Sofia in Challenge Mode. The user wants you to play devil's advocate on a previous analysis or decision.

Your job:
1. First line must be: CATEGORY: Decision
2. Then a blank line
3. Then provide a structured critique using Markdown:
   - ## Devil's Advocate Analysis
   - ### Assumptions Being Made — identify unstated assumptions
   - ### Potential Blind Spots — what's being overlooked
   - ### Counter-Arguments — the strongest case against this position
   - ### Risk Factors — what could go wrong
   - ### Alternative Perspectives — different ways to look at this
   - ### Stress Test Questions — 3-5 hard questions to pressure-test the thinking
   
Be respectful but genuinely challenging. Don't be a pushover. Find the real weaknesses.`

const BRAINDUMP_PROMPT = `You are Sofia processing a brain dump. The user has written a stream of consciousness containing multiple ideas, thoughts, and topics.

Your job:
1. Parse the brain dump into SEPARATE distinct thoughts/ideas
2. For EACH thought, output it in this exact format:

---ENTRY---
CATEGORY: <Decision|Brainstorm|Shopping|Observation|Draft>
TITLE: <short descriptive title for this thought>

<Full Markdown content for this thought>

---END---

Rules:
- Each thought gets its own ---ENTRY--- block
- Classify each independently
- Give each a clear, specific title
- Expand on each thought with structure and detail
- Minimum 2 entries, maximum 8 entries from a single brain dump
- Never use HTML, only Markdown`

const TODO_PROMPT = `You are Sofia parsing a todo list request. The user has described tasks they need to do.

Your job: Parse the input into individual todo items. Output ONLY in this exact format, one block per task:

---TODO---
TITLE: <short actionable task title, max 80 chars>
PRIORITY: <high|medium|low>
NOTES: <optional one-line context or detail, leave empty if none>
DUE: <YYYY-MM-DD if a date is mentioned or can be inferred, otherwise leave empty>
---END---

Rules:
- Each task gets its own ---TODO--- block
- Titles should be actionable (start with a verb when possible)
- Assign priority based on urgency/importance cues in the text
- If the user mentions "urgent", "ASAP", "today", "critical" → high
- If the user mentions "eventually", "someday", "low priority", "when I get a chance" → low
- Default to medium if unclear
- Extract any dates mentioned
- Minimum 1 todo, maximum 15 from a single input
- Keep titles concise and clear`

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
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
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
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callModel(model, systemPrompt, userMessage) {
  switch (model) {
    case 'gpt4': return callOpenAI(systemPrompt, userMessage)
    case 'claude':
    default: return callAnthropic(systemPrompt, userMessage)
  }
}

function parseAIResponse(text, allCategories) {
  const lines = text.split('\n')
  let category = 'Observation'
  let contentStart = 0
  if (lines[0]?.startsWith('CATEGORY:')) {
    const cat = lines[0].replace('CATEGORY:', '').trim()
    if (allCategories.includes(cat)) category = cat
    contentStart = 1
    if (lines[contentStart]?.trim() === '') contentStart++
  }
  const content = lines.slice(contentStart).join('\n').trim()
  return { category, content }
}

function parseBrainDump(text, allCategories) {
  const entries = []
  const blocks = text.split('---ENTRY---').filter(b => b.trim())
  for (const block of blocks) {
    const cleaned = block.replace('---END---', '').trim()
    if (!cleaned) continue
    const lines = cleaned.split('\n')
    let category = 'Observation'
    let title = 'Untitled Thought'
    let contentStart = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('CATEGORY:')) {
        const cat = lines[i].replace('CATEGORY:', '').trim()
        if (allCategories.includes(cat)) category = cat
        contentStart = i + 1
      } else if (lines[i].startsWith('TITLE:')) {
        title = lines[i].replace('TITLE:', '').trim()
        contentStart = i + 1
      } else if (lines[i].trim() !== '') {
        contentStart = i
        break
      }
    }
    const content = lines.slice(contentStart).join('\n').trim()
    if (content) entries.push({ category, title, content })
  }
  return entries
}

function parseTodos(text) {
  const todos = []
  const blocks = text.split('---TODO---').filter(b => b.trim())
  for (const block of blocks) {
    const cleaned = block.replace('---END---', '').trim()
    if (!cleaned) continue
    const lines = cleaned.split('\n')
    let title = '', priority = 'medium', notes = '', due = ''
    for (const line of lines) {
      if (line.startsWith('TITLE:')) title = line.replace('TITLE:', '').trim()
      else if (line.startsWith('PRIORITY:')) priority = line.replace('PRIORITY:', '').trim().toLowerCase()
      else if (line.startsWith('NOTES:')) notes = line.replace('NOTES:', '').trim()
      else if (line.startsWith('DUE:')) due = line.replace('DUE:', '').trim()
    }
    if (!['high', 'medium', 'low'].includes(priority)) priority = 'medium'
    if (title) todos.push({ title, priority, notes: notes || null, due_date: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null })
  }
  return todos
}

function extractTags(content) {
  const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4)
  const freq = {}
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  const stop = new Set(['about','above','after','again','being','below','between','could','these','their','there','those','through','under','until','would','should','which','while','other','might','where','every','never','often','using','based','first','second','third','example','following','however','consider','important','provide','specific','different','approach','another','without','before','because','something','anything','everything','nothing','making','really','things','still','point','think','right','going','always','rather','given','along','since','around','across'])
  return Object.entries(freq).filter(([w]) => !stop.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w)
}

function generateSummary(content) {
  const sentences = content.replace(/[#*`>\-]/g, '').split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20)
  return sentences.slice(0, 3).join('. ') + (sentences.length > 0 ? '.' : '')
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { promptId, promptBody, model = 'claude', mode = 'standard' } = await request.json()
    if (!promptId || !promptBody) return NextResponse.json({ error: 'Missing prompt data' }, { status: 400 })

    // Idempotency check
    const { data: prompt } = await supabase.from('prompts').select('status, title').eq('id', promptId).single()
    if (prompt?.status === 'Completed') return NextResponse.json({ error: 'Already processed' }, { status: 409 })

    await supabase.from('prompts').update({ status: 'Processing' }).eq('id', promptId)

    // Get custom categories
    const { data: customCats } = await supabase.from('custom_categories').select('name').eq('user_id', user.id)
    const customCatNames = (customCats || []).map(c => c.name)
    const allCategories = [...DEFAULT_CATEGORIES, ...customCatNames]

    try {
      let entries = []
      let todos = []

      if (mode === 'todo') {
        // Todo mode - parse into todo items
        const rawText = await callModel(model, TODO_PROMPT, promptBody)
        const parsed = parseTodos(rawText)

        for (const t of parsed) {
          const { data: todo } = await supabase.from('todos').insert({
            user_id: user.id, title: t.title, priority: t.priority,
            notes: t.notes, due_date: t.due_date, source_prompt_id: promptId,
          }).select().single()
          if (todo) todos.push(todo)
        }

        await supabase.from('prompts').update({ status: 'Completed', processed_at: new Date().toISOString() }).eq('id', promptId)
        return NextResponse.json({ todos, mode: 'todo' })

      } else if (mode === 'braindump') {
        // Brain dump mode - split into multiple entries
        const rawText = await callModel(model, BRAINDUMP_PROMPT, promptBody)
        const parsed = parseBrainDump(rawText, allCategories)

        for (const p of parsed) {
          const tags = extractTags(p.content)
          const summary = generateSummary(p.content)
          const { data: entry } = await supabase.from('entries').insert({
            user_id: user.id, title: p.title, category: p.category,
            content: p.content, tags, summary, source_prompt_id: promptId,
            original_content: p.content, model,
          }).select().single()
          if (entry) entries.push(entry)
        }
      } else if (mode === 'challenge') {
        // Challenge mode
        const rawText = await callModel(model, CHALLENGE_PROMPT, promptBody)
        const { category, content } = parseAIResponse(rawText, allCategories)
        const tags = extractTags(content)
        const summary = generateSummary(content)
        const { data: entry } = await supabase.from('entries').insert({
          user_id: user.id, title: `Challenge: ${prompt?.title || 'Analysis'}`,
          category, content, tags, summary, source_prompt_id: promptId,
          original_content: content, model,
        }).select().single()
        if (entry) entries.push(entry)
      } else {
        // Standard mode
        const systemPrompt = getSystemPrompt(customCatNames)
        const rawText = await callModel(model, systemPrompt, promptBody)
        const { category, content } = parseAIResponse(rawText, allCategories)
        const tags = extractTags(content)
        const summary = generateSummary(content)
        const { data: entry } = await supabase.from('entries').insert({
          user_id: user.id, title: prompt?.title || 'Untitled',
          category, content, tags, summary, source_prompt_id: promptId,
          original_content: content, model,
        }).select().single()
        if (entry) entries.push(entry)
      }

      await supabase.from('prompts').update({ status: 'Completed', processed_at: new Date().toISOString() }).eq('id', promptId)
      return NextResponse.json({ entries, category: entries[0]?.category })
    } catch (aiErr) {
      console.error('AI error:', aiErr)
      await supabase.from('prompts').update({ status: 'Failed' }).eq('id', promptId)
      return NextResponse.json({ error: 'AI processing failed: ' + aiErr.message }, { status: 502 })
    }
  } catch (err) {
    console.error('Processing error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
