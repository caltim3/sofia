// app/api/entries/delete/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { id } = await request.json();
    console.log('DELETE request for id:', id);

    if (!id) {
      return Response.json({ error: 'No ID provided' }, { status: 400 });
    }

    const { data, error, count } = await supabase
      .from('entries')
      .delete()
      .eq('id', id)
      .select();

    console.log('DELETE result:', { data, error, count });

    if (error) throw error;

    return Response.json({ success: true, deleted: data });
  } catch (error) {
    console.error('Delete error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
