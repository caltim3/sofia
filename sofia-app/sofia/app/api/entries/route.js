// app/api/entries/route.js
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ entries: data });
  } catch (error) {
    console.error('Entries fetch error:', error);
    return Response.json({ entries: [] });
  }
}
