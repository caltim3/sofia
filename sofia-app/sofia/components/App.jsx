'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase-browser'
import Sofia from '@/components/Sofia'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = getSupabase()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleAuth(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link!')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center">
          <div className="text-4xl font-serif text-ink-500 mb-2">Sofia</div>
          <div className="text-cream-600 text-sm">Loading...</div>
        </div>
      </div>
    )
  }

  if (user) {
    return <Sofia user={user} onLogout={handleLogout} />
  }

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-ink-500 mb-1">Sofia</h1>
          <p className="text-cream-600 text-sm">Your AI-powered knowledge system</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-300">
          <div className="flex mb-5 bg-cream-200 rounded-lg p-0.5">
            <button onClick={() => { setAuthMode('login'); setError(''); setMessage('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${authMode === 'login' ? 'bg-white text-ink-500 shadow-sm' : 'text-cream-600'}`}>
              Log In
            </button>
            <button onClick={() => { setAuthMode('signup'); setError(''); setMessage('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${authMode === 'signup' ? 'bg-white text-ink-500 shadow-sm' : 'text-cream-600'}`}>
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-cream-600 uppercase tracking-wider mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-300 text-sm" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-cream-600 uppercase tracking-wider mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-cream-300 text-sm" placeholder="••••••••" minLength={6} />
            </div>

            {error && <div className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            {message && <div className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2">{message}</div>}

            <button type="submit" className="w-full bg-ink-500 text-cream-200 py-2.5 rounded-lg font-semibold text-sm mt-2">
              {authMode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-cream-500 text-xs mt-4">
          Prompts are processed by Claude AI. Your data is stored securely in Supabase.
        </p>
      </div>
    </div>
  )
}
