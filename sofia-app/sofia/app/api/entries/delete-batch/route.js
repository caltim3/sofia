import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(request) {
  try {
    const { ids } = await request.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase.from('entries').delete().in('id', ids)
    if (error) throw error

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (err) {
    console.error('Batch delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
