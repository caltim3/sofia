// app/api/chat/route.js
// Sofia V2.2 — Fixed chat mode with entry context

import { NextResponse } from 'next/server';

const CHAT_SYSTEM_PROMPT = `You are Sofia, an AI assistant engaged in a follow-up conversation about a specific entry in Timo's knowledge base. 

Context about Timo: CEO of DevEngine (sustainable infrastructure, solar/BESS development), jazz guitarist (bebop, Barry Harris methods), lives in Ghent NY, leads a Brooklyn book club.

You have access to the entry details below. Use them to provide contextual, insightful follow-up responses. Be concise but substantive — this is a chat, not an essay. If asked about the entry's topic, draw on your knowledge to go deeper than the original entry.`;

async function callClaude(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: CHAT_SYSTEM_PROMPT,
      messages: messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

async function callGPT4o(messages) {
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
      max_tokens: 1000,
      messages: [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...messages,
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

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, history = [], context = {}, model = 'claude' } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Build the conversation with entry context
    const entryContext = `--- Entry Being Discussed ---
Title: ${context.title || 'Unknown'}
Category: ${context.category || 'Unknown'}
Summary: ${context.summary || 'No summary'}
Original Input: ${context.raw_content || 'No original content'}
---`;

    // Build messages array
    const messages = [];

    // First message includes the entry context
    if (history.length === 0) {
      messages.push({
        role: 'user',
        content: `${entryContext}\n\nMy question: ${message}`,
      });
    } else {
      // Include entry context in first message, then history
      messages.push({
        role: 'user',
        content: `${entryContext}\n\nMy question: ${history[0].content}`,
      });

      // Add remaining history
      for (let i = 1; i < history.length; i++) {
        messages.push({
          role: history[i].role,
          content: history[i].content,
        });
      }

      // Add current message
      messages.push({
        role: 'user',
        content: message,
      });
    }

    let response;
    if (model === 'gpt4o') {
      response = await callGPT4o(messages);
    } else {
      response = await callClaude(messages);
    }

    return NextResponse.json({ response });

  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: 'Chat failed: ' + err.message }, { status: 500 });
  }
}
