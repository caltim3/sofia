// app/api/templates/route.js
// Sofia V2.1 — Fetch available templates

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return Response.json({ templates: data });
  } catch (error) {
    console.error('Templates fetch error:', error);
    // Return defaults on error so the app still works
    return Response.json({
      templates: [
        { slug: 'freeform', name: 'Freeform', icon: '✏️', description: 'Open-ended capture', fields: [], sort_order: 0 },
        { slug: 'todo', name: 'Todo', icon: '☑️', description: 'Quick action item', fields: [], sort_order: 1 },
      ]
    });
  }
}
