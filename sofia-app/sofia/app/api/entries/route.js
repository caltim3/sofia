import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(request) {
  try {
    const supabase = getSupabase()

    // Get the single user in this account
    const result = await supabase.auth.admin.listUsers({ perPage: 1 })
    const userId = result?.data?.users?.[0]?.id ?? null

    let query = supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by user_id if we have one
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ entries: data || [] })
  } catch (err) {
    console.error('Entries fetch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
