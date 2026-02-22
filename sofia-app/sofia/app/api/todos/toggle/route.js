// app/api/todos/toggle/route.js
// Sofia V2.1 — Toggle todo completion

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { id, completed } = await request.json();

    const updateData = {
      todo_completed: completed,
      todo_completed_at: completed ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ success: true, entry: data });
  } catch (error) {
    console.error('Todo toggle error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
