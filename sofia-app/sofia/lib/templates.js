// lib/templates.js
// Sofia V2.1 — Template definitions and helpers
// These are the client-side defaults. The source of truth lives in the Supabase 'templates' table.

export const TEMPLATE_SLUGS = {
  FREEFORM: 'freeform',
  TODO: 'todo',
  DEAL_CONCEPT: 'deal-concept',
  MUSIC_IDEA: 'music-idea',
  SHOPPING_LIST: 'shopping-list',
  DEEP_THOUGHT: 'deep-thought',
  BOOK_NOTE: 'book-note',
  GHENT_PROJECT: 'ghent-project',
  RECIPE_RESTAURANT: 'recipe-restaurant',
};

// Prefix shortcuts (type these at the start of freeform input to auto-select template)
export const TEMPLATE_PREFIXES = {
  '#todo': 'todo',
  '#deal': 'deal-concept',
  '#music': 'music-idea',
  '#shop': 'shopping-list',
  '#deep': 'deep-thought',
  '#book': 'book-note',
  '#ghent': 'ghent-project',
  '#food': 'recipe-restaurant',
};

// Todo priority config
export const TODO_PRIORITIES = [
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', border: 'border-red-300', icon: '🔴' },
  { value: 'high', label: 'High', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', border: 'border-orange-300', icon: '🟠' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', border: 'border-yellow-300', icon: '🟡' },
  { value: 'low', label: 'Low', color: 'bg-blue-400', textColor: 'text-blue-700', bgLight: 'bg-blue-50', border: 'border-blue-300', icon: '🔵' },
];

export function getPriorityConfig(priority) {
  return TODO_PRIORITIES.find(p => p.value === priority) || TODO_PRIORITIES[2]; // default medium
}

// Detect template prefix from raw input
export function detectTemplatePrefix(input) {
  const trimmed = input.trim().toLowerCase();
  for (const [prefix, slug] of Object.entries(TEMPLATE_PREFIXES)) {
    if (trimmed.startsWith(prefix)) {
      return {
        slug,
        cleanedInput: input.trim().slice(prefix.length).trim(),
      };
    }
  }
  return null;
}

// Build the AI system prompt addition for a given template
export function getTemplateAIContext(template, templateData) {
  if (!template || template.slug === 'freeform') return '';

  let context = `\n\n--- TEMPLATE CONTEXT ---\n`;
  context += `Template type: ${template.name}\n`;

  if (template.ai_instructions) {
    context += `Special instructions: ${template.ai_instructions}\n`;
  }

  if (templateData && Object.keys(templateData).length > 0) {
    context += `Structured data provided:\n`;
    for (const [key, value] of Object.entries(templateData)) {
      if (value) context += `  - ${key}: ${value}\n`;
    }
  }

  return context;
}

// Default template list (used as fallback if Supabase fetch fails)
export const DEFAULT_TEMPLATES = [
  { slug: 'freeform', name: 'Freeform', icon: '✏️', description: 'Open-ended capture', sort_order: 0 },
  { slug: 'todo', name: 'Todo', icon: '☑️', description: 'Quick action item with priority', sort_order: 1 },
  { slug: 'deal-concept', name: 'Deal Concept', icon: '⚡', description: 'Early-stage DevEngine project idea', sort_order: 2 },
  { slug: 'music-idea', name: 'Music Idea', icon: '🎸', description: 'Guitar concept or practice goal', sort_order: 3 },
  { slug: 'shopping-list', name: 'Shopping List', icon: '🛒', description: 'Items to buy', sort_order: 4 },
  { slug: 'deep-thought', name: 'Deep Thought', icon: '🧠', description: 'Strategic reflection', sort_order: 5 },
  { slug: 'book-note', name: 'Book Note', icon: '📚', description: 'Reading note or book club prep', sort_order: 6 },
  { slug: 'ghent-project', name: 'Ghent Project', icon: '🏠', description: 'House project tracker', sort_order: 7 },
  { slug: 'recipe-restaurant', name: 'Recipe / Restaurant', icon: '🍽️', description: 'Food note', sort_order: 8 },
];
