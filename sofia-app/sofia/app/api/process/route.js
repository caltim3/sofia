// app/api/process/route.js
// Sofia V2.1 — Template-aware entry processing
// Replace your existing route.js with this version

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Your existing categories
const CATEGORIES = [
  'personal', 'health', 'fitness', 'family', 'work', 'music',
  'ideas', 'ghent', 'NYC', 'travel/food', 'books', 'oligarch novel'
];

export async function POST(request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const {
      content,
      template_type = 'freeform',
      template_data = null,
      model = 'claude',
    } = body;

    if (!content && !template_data) {
      return Response.json({ error: 'Content or template data required' }, { status: 400 });
    }

    // 1. Fetch the template config from Supabase (for AI instructions)
    let template = null;
    if (template_type !== 'freeform') {
      const { data: tmpl } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', template_type)
        .single();
      template = tmpl;
    }

    // 2. Build the input text from either freeform content or structured template data
    let inputText = content || '';
    if (template_data && Object.keys(template_data).length > 0) {
      // Append structured fields to give Claude full context
      inputText += '\n\n--- Structured Fields ---\n';
      for (const [key, value] of Object.entries(template_data)) {
        if (value) inputText += `${key}: ${value}\n`;
      }
    }

    // 3. Build the system prompt
    const systemPrompt = buildSystemPrompt(template, template_type);

    // 4. Call the AI
    let aiResponse;
    if (model === 'gpt4o') {
      aiResponse = await callGPT4o(systemPrompt, inputText);
    } else {
      aiResponse = await callClaude(systemPrompt, inputText);
    }

    // 5. Parse the response
    let parsed;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parsed = {
        title: 'Processing Error',
        summary: aiResponse,
        category: template?.default_category || 'ideas',
        tags: [],
        confidence: 0.3,
        research: null,
      };
    }

    // 6. Build the entry object
    const entry = {
      raw_content: content || JSON.stringify(template_data),
      title: parsed.title,
      summary: parsed.summary,
      category: parsed.category || template?.default_category || 'ideas',
      tags: parsed.tags || [],
      confidence: parsed.confidence || 0.7,
      ai_research: parsed.research || null,
      template_type: template_type,
      template_data: template_data,
      reviewed: false,
      pinned: false,
      starred: false,
      created_at: new Date().toISOString(),
    };

    // 7. Add todo-specific fields if it's a todo
    if (template_type === 'todo') {
      entry.todo_priority = template_data?.priority || parsed.inferred_priority || 'medium';
      entry.todo_due_date = template_data?.due_date || parsed.inferred_due_date || null;
      entry.todo_completed = false;
    }

    // 8. Save to Supabase
    const { data, error } = await supabase
      .from('entries')
      .insert([entry])
      .select()
      .single();

    if (error) throw error;

    return Response.json({ success: true, entry: data });

  } catch (error) {
    console.error('Process error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function buildSystemPrompt(template, templateType) {
  let prompt = `You are Sofia, an AI knowledge management assistant. Process the user's input and return a JSON object with these fields:
{
  "title": "concise title (5-8 words)",
  "summary": "1-3 paragraph enriched summary",
  "category": "one of: ${CATEGORIES.join(', ')}",
  "tags": ["array", "of", "relevant", "tags"],
  "confidence": 0.0 to 1.0 (how confident you are in the categorization),
  "research": {
    "key_findings": ["array of relevant research points"],
    "links": ["array of useful URLs if applicable"],
    "related_topics": ["array of related topics to explore"]
  }
}`;

  // Add template-specific instructions
  if (template && template.ai_instructions) {
    prompt += `\n\nSPECIAL INSTRUCTIONS FOR THIS TEMPLATE TYPE (${template.name}):\n${template.ai_instructions}`;
  }

  // Add todo-specific parsing
  if (templateType === 'todo') {
    prompt += `\n\nADDITIONAL: If the user mentions a timeframe, infer the due date relative to today (${new Date().toISOString().split('T')[0]}). Return these extra fields:
  "inferred_priority": "urgent|high|medium|low" (based on language urgency),
  "inferred_due_date": "YYYY-MM-DD or null"`;
  }

  // Add deep thought devil's advocate
  if (templateType === 'deep-thought') {
    prompt += `\n\nADDITIONAL: Structure the summary as a devil's advocate analysis:
1. **Strongest version of the argument** — steelman it
2. **Strongest counter-argument** — genuine pushback, not strawman  
3. **Hidden assumptions** — what's being taken for granted?
4. **What would resolve it** — data, experiment, or experience needed`;
  }

  // Add shopping list parsing
  if (templateType === 'shopping-list') {
    prompt += `\n\nADDITIONAL: In the summary, organize items into sub-categories (groceries, music gear, books, household, etc.) with checkboxes. If an item spans multiple Sofia categories, note which category each sub-group maps to.`;
  }

  prompt += `\n\nReturn ONLY valid JSON. No markdown fences, no preamble.`;

  return prompt;
}

async function callClaude(systemPrompt, userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await response.json();
  return data.content[0].text;
}

async function callGPT4o(systemPrompt, userMessage) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2000,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
