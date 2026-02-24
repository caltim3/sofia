// app/api/process/route.js
// Sofia V2.2 — Improved response quality, categorization, and updated models

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = [
  'personal', 'health', 'fitness', 'family', 'work', 'music',
  'ideas', 'ghent', 'NYC', 'travel/food', 'books', 'oligarch novel'
];

// ─── THE SOFIA REASONING ENGINE SYSTEM PROMPT ─────────────────────────────

const SOFIA_SYSTEM_PROMPT = `You are Sofia, an AI-powered knowledge management assistant and second brain for Timo. Your role is to process, categorize, and enrich every thought, question, and idea he captures.

## Your Owner's Context
Timo is the CEO of DevEngine, a sustainable infrastructure development company focused on "missing middle" project financing ($500K-$5M) for commercial/industrial solar, community solar, and battery energy storage systems (BESS) across the USA and Canada. He's backed by Spring Lane Capital with $20M in funding. He's also a jazz guitarist who teaches and studies bebop theory (especially Barry Harris methods), leads a Brooklyn book club, and recently purchased a house in Ghent, NY.

## Category Definitions — USE THESE TO CLASSIFY EVERY ENTRY
Pick the SINGLE best category. Be specific — don't default to "personal" or "ideas" unless nothing else fits.

- **work** — DevEngine business: deals, pipeline, investor relations, Spring Lane, BESS, solar projects, FEOC compliance, ITC, interconnection, substation co-location, project finance, team management, market analysis, competitor research, pitch decks, regulatory
- **music** — Jazz guitar, bebop theory, Barry Harris methods, chord voicings, scales, transcriptions, practice routines, licks, specific musicians (Grant Green, Wes Montgomery, Pat Martino, Bill Frisell, etc.), gig planning, teaching
- **ghent** — Anything about the Ghent NY house: renovations, repairs, contractors, property, landscaping, heating/cooling, water heater, appliances, local services, the neighborhood
- **NYC** — Brooklyn life, commuting, local spots, city-specific logistics
- **books** — Book club, reading notes, literature analysis, specific books (Count of Monte Cristo, etc.), the oligarch novel writing project
- **oligarch novel** — Specifically about writing/plotting the oligarch novel (not general book discussion)
- **health** — Medical, mental health, diet, nutrition, sleep, wellness, doctor appointments
- **fitness** — Exercise, workouts, running, gym, physical training routines
- **family** — Family relationships, family events, family logistics
- **travel/food** — Travel planning, restaurants, recipes, food discoveries, travel recommendations
- **ideas** — General brainstorms, creative concepts, startup ideas, inventions, shower thoughts that don't fit other categories
- **personal** — Only use for things that truly don't fit any other category: personal admin, errands, shopping, miscellaneous life logistics

## Response Format
You MUST return your response as valid JSON with this exact structure:
{
  "title": "A clear, descriptive title (5-10 words)",
  "category": "one of the categories listed above",
  "summary": "A rich 2-3 sentence summary that captures the key insight or action",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "confidence": 0.95,
  "ai_research": {
    "key_findings": ["Finding 1 with specific, useful detail", "Finding 2", "Finding 3"],
    "links": []
  }
}

## Quality Standards
- **Title**: Be specific and descriptive. "BESS Co-Location at PJM Substations" not "Energy Question"
- **Category**: Use the definitions above strictly. Music topics → music. DevEngine/solar/BESS → work. Ghent house → ghent.
- **Summary**: Don't just restate the input. Add value — synthesize, contextualize, identify the core decision or insight. If it's a question, provide a substantive answer.
- **Tags**: 3-5 specific, searchable tags. Use consistent naming (e.g., "BESS" not "battery storage", "solar" not "photovoltaic")
- **Confidence**: 0.9+ if clearly categorizable, 0.7-0.9 if ambiguous, below 0.7 if you're genuinely unsure
- **AI Research**: Provide genuinely useful findings. For work topics, include market data, regulatory details, or strategic considerations. For music, include theory insights, recommended listening, or practice approaches. For ghent, include practical home improvement advice.

## Template-Specific Instructions
If the input includes template_type or structured fields, adapt your processing:
- **todo**: Extract the action item, assign priority (urgent/high/medium/low), extract due date if mentioned, categorize based on content
- **deal-concept**: Focus on project viability, interconnection considerations, ITC implications, market context
- **music-idea**: Provide theory context, related concepts, practice suggestions
- **deep-thought**: Engage seriously with the idea, provide multiple perspectives, suggest next steps`;

// ─── TODO-SPECIFIC PROMPT ─────────────────────────────────────────────────

const TODO_SYSTEM_PROMPT = `You are Sofia, processing a todo item. Return valid JSON:
{
  "title": "Clear action item title",
  "category": "best category from: personal, health, fitness, family, work, music, ideas, ghent, NYC, travel/food, books, oligarch novel",
  "summary": "Brief description of what needs to be done and why it matters",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "todo_priority": "urgent|high|medium|low",
  "todo_due_date": "YYYY-MM-DD or null if no date mentioned",
  "ai_research": { "key_findings": [], "links": [] }
}

Priority guide:
- urgent: Deadline today/tomorrow, blocking other work, time-sensitive legal/financial
- high: This week, important business deliverable, client-facing
- medium: This month, nice to do, self-imposed deadline
- low: Someday, no deadline, nice to have

Context: Timo is CEO of DevEngine (solar/BESS development), jazz guitarist, lives in Ghent NY.
Categorize based on content: DevEngine/solar/BESS/investor → work, guitar/jazz → music, house stuff → ghent, etc.`;

// ─── CALL CLAUDE ──────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ─── CALL GPT-4O ──────────────────────────────────────────────────────────

async function callGPT4o(systemPrompt, userContent) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT-4o API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── PARSE AI RESPONSE ───────────────────────────────────────────────────

function parseAIResponse(rawText) {
  // Try to extract JSON from the response
  let jsonStr = rawText.trim();

  // Strip markdown code fences if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate category
    if (!CATEGORIES.includes(parsed.category)) {
      // Try to fuzzy match
      const lower = (parsed.category || '').toLowerCase();
      const match = CATEGORIES.find(c => c.toLowerCase() === lower);
      parsed.category = match || 'personal';
    }

    // Ensure required fields
    return {
      title: parsed.title || 'Untitled Entry',
      category: parsed.category,
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      ai_research: parsed.ai_research || { key_findings: [], links: [] },
      todo_priority: parsed.todo_priority || null,
      todo_due_date: parsed.todo_due_date || null,
    };
  } catch (e) {
    console.error('Failed to parse AI response as JSON:', e);
    console.error('Raw text:', rawText.slice(0, 500));

    // Fallback: create a basic entry from the raw text
    return {
      title: rawText.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Processing Error',
      category: 'personal',
      summary: rawText.slice(0, 200),
      tags: [],
      confidence: 0.3,
      ai_research: { key_findings: ['Failed to parse structured response'], links: [] },
      todo_priority: null,
      todo_due_date: null,
    };
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      content,
      template_type = 'freeform',
      template_data = null,
      model = 'claude',
    } = body;

    if (!content && !template_data) {
      return NextResponse.json({ error: 'Content or template data required' }, { status: 400 });
    }

    // Build input text
    let inputText = content || '';
    if (template_data && Object.keys(template_data).length > 0) {
      inputText += '\n\n--- Structured Fields ---\n';
      for (const [key, value] of Object.entries(template_data)) {
        if (value) inputText += `${key}: ${value}\n`;
      }
    }

    // Add template context to the input
    if (template_type !== 'freeform') {
      inputText = `[Template: ${template_type}]\n${inputText}`;
    }

    // Choose system prompt
    const systemPrompt = template_type === 'todo' ? TODO_SYSTEM_PROMPT : SOFIA_SYSTEM_PROMPT;

    // Call AI
    let rawResponse;
    if (model === 'gpt4o') {
      rawResponse = await callGPT4o(systemPrompt, inputText);
    } else {
      rawResponse = await callClaude(systemPrompt, inputText);
    }

    // Parse
    const parsed = parseAIResponse(rawResponse);

    // Insert into Supabase
    const insertData = {
      title: parsed.title,
      category: parsed.category,
      summary: parsed.summary,
      tags: parsed.tags,
      confidence: parsed.confidence,
      ai_research: parsed.ai_research,
      raw_content: content || '',
      template_type: template_type,
      template_data: template_data,
      model: model,
      reviewed: false,
      pinned: false,
      starred: false,
    };

    // Add todo fields if applicable
    if (template_type === 'todo') {
      insertData.todo_priority = parsed.todo_priority || 'medium';
      insertData.todo_due_date = parsed.todo_due_date || null;
      insertData.todo_completed = false;
    }

    const { data: entry, error: insertError } = await supabase
      .from('entries')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save entry: ' + insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, entry });

  } catch (err) {
    console.error('Processing error:', err);
    return NextResponse.json({ error: 'Processing failed: ' + err.message }, { status: 500 });
  }
}
