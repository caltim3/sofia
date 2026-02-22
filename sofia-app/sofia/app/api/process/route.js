import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CATEGORIES = ['Decision', 'Brainstorm', 'Shopping', 'Observation', 'Draft']

const SYSTEM_PROMPT = `You are Sofia, an analytical assistant and second brain. Always classify your response into one of the allowed categories: Decision, Brainstorm, Shopping, Observation, Draft.

The first line of your response must STRICTLY follow this format:
CATEGORY: <Decision|Brainstorm|Shopping|Observation|Draft>

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
- Draft: When the user is writing content, composing messages, creating documents, or producing written output`

function parseAIResponse(text) {
  const lines = text.split('\n')
  let category = 'Observation'
  let contentStart = 0

  if (lines[0] && lines[0].startsWith('CATEGORY:')) {
    const cat = lines[0].replace('CATEGORY:', '').trim()
    if (CATEGORIES.includes(cat)) category = cat
    contentStart = 1
    if (lines[contentStart]?.trim() === '') contentStart++
  }

  const content = lines.slice(contentStart).join('\n').trim()
  return { category, content }
}

function extractTags(content) {
  const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4)
  const freq = {}
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  const stopWords = new Set([
    'about', 'above', 'after', 'again', 'being', 'below', 'between', 'could',
    'these', 'their', 'there', 'those', 'through', 'under', 'until', 'would',
    'should', 'which', 'while', 'other', 'might', 'where', 'every', 'never',
    'often', 'using', 'based', 'first', 'second', 'third', 'example',
    'following', 'however', 'consider', 'important', 'provide', 'specific',
    'different', 'approach', 'another', 'without', 'before', 'because',
    'something', 'anything', 'everything', 'nothing'
  ])
  return Object.entries(freq)
    .filter(([w]) => !stopWords.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
}

function generateSummary(content) {
  const sentences = content
    .replace(/[#*`>\-]/g, '')
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20)
  return sentences.slice(0, 3).join('. ') + (sentences.length > 0 ? '.' : '')
}

export async function POST(request) {
  try {
    // Verify the user is authenticated via the auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { promptId, promptBody } = await request.json()
    if (!promptId || !promptBody) {
      return NextResponse.json({ error: 'Missing prompt data' }, { status: 400 })
    }

    // Check prompt hasn't already been processed (idempotency)
    const { data: prompt } = await supabase
      .from('prompts')
      .select('status')
      .eq('id', promptId)
      .single()

    if (prompt?.status === 'Completed') {
      return NextResponse.json({ error: 'Already processed' }, { status: 409 })
    }

    // Set status to Processing
    await supabase
      .from('prompts')
      .update({ status: 'Processing' })
      .eq('id', promptId)

    // Call Anthropic API
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptBody }],
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('Anthropic API error:', errText)
      await supabase
        .from('prompts')
        .update({ status: 'Failed' })
        .eq('id', promptId)
      return NextResponse.json({ error: 'AI processing failed' }, { status: 502 })
    }

    const aiData = await aiResponse.json()
    const rawText = aiData.content?.map(b => b.text || '').join('') || ''

    // Parse the response
    const { category, content } = parseAIResponse(rawText)
    const tags = extractTags(content)
    const summary = generateSummary(content)

    // Get the prompt title
    const { data: promptData } = await supabase
      .from('prompts')
      .select('title')
      .eq('id', promptId)
      .single()

    // Create the entry
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        title: promptData?.title || 'Untitled',
        category,
        content,
        tags,
        summary,
        source_prompt_id: promptId,
        original_content: content,
      })
      .select()
      .single()

    if (entryError) {
      console.error('Entry creation error:', entryError)
      await supabase
        .from('prompts')
        .update({ status: 'Failed' })
        .eq('id', promptId)
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    // Update prompt to Completed
    await supabase
      .from('prompts')
      .update({ status: 'Completed', processed_at: new Date().toISOString() })
      .eq('id', promptId)

    return NextResponse.json({ entry, category })
  } catch (err) {
    console.error('Processing error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
