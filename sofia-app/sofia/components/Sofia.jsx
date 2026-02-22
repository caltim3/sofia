'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '@/lib/supabase-browser'
import Markdown from './Markdown'

const CATEGORIES = ['Decision', 'Brainstorm', 'Shopping', 'Observation', 'Draft']
const CAT_ICONS = { Decision: '⚖️', Brainstorm: '💡', Shopping: '🛒', Observation: '👁️', Draft: '📝' }
const CAT_COLORS = {
  Decision: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-400', bar: 'bg-purple-500' },
  Brainstorm: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-400', bar: 'bg-amber-500' },
  Shopping: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-400', bar: 'bg-emerald-500' },
  Observation: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-400', bar: 'bg-sky-500' },
  Draft: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-400', bar: 'bg-rose-500' },
}

export default function Sofia({ user, onLogout }) {
  const supabase = getSupabase()
  const [prompts, setPrompts] = useState([])
  const [entries, setEntries] = useState([])
  const [view, setView] = useState('inbox')
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [newPromptTitle, setNewPromptTitle] = useState('')
  const [newPromptText, setNewPromptText] = useState('')
  const [processing, setProcessing] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [notification, setNotification] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Load data from Supabase
  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('prompts').select('*').order('created_at', { ascending: false }),
      supabase.from('entries').select('*').order('created_at', { ascending: false }),
    ])
    setPrompts(p || [])
    setEntries(e || [])
    setLoading(false)
  }

  function notify(msg, type = 'success') {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }

  // ─── Submit new prompt ───
  async function submitPrompt() {
    if (!newPromptText.trim()) return
    const title = newPromptTitle.trim() || newPromptText.slice(0, 60) + (newPromptText.length > 60 ? '...' : '')

    const { data: prompt, error } = await supabase
      .from('prompts')
      .insert({ user_id: user.id, title, body: newPromptText.trim(), status: 'New' })
      .select()
      .single()

    if (error) { notify('Failed to create prompt', 'error'); return }

    setPrompts(prev => [prompt, ...prev])
    setNewPromptText('')
    setNewPromptTitle('')
    setShowNewPrompt(false)
    notify('Prompt submitted — processing...')
    processPrompt(prompt)
  }

  // ─── Process prompt through AI ───
  async function processPrompt(prompt) {
    if (prompt.status === 'Processing' || prompt.status === 'Completed') return
    setProcessing(prompt.id)
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, status: 'Processing' } : p))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ promptId: prompt.id, promptBody: prompt.body }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const { entry, category } = await res.json()
      setEntries(prev => [entry, ...prev])
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, status: 'Completed', processed_at: new Date().toISOString() } : p))
      notify(`Classified as ${category}`)
    } catch (err) {
      console.error('Processing error:', err)
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, status: 'Failed' } : p))
      await supabase.from('prompts').update({ status: 'Failed' }).eq('id', prompt.id)
      notify('Processing failed — you can retry', 'error')
    }
    setProcessing(null)
  }

  // ─── Archive prompt ───
  async function archivePrompt(id) {
    await supabase.from('prompts').update({ status: 'Archived' }).eq('id', id)
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, status: 'Archived' } : p))
    notify('Prompt archived')
  }

  // ─── Delete entry ───
  async function deleteEntry(id) {
    await supabase.from('entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelectedEntry(null)
    notify('Entry deleted')
  }

  // ─── Save edited entry ───
  async function saveEdit() {
    if (!editingEntry) return
    const tags = extractTags(editContent)
    const summary = generateSummary(editContent)

    await supabase
      .from('entries')
      .update({ content: editContent, category: editCategory, tags, summary })
      .eq('id', editingEntry)

    setEntries(prev => prev.map(e =>
      e.id === editingEntry ? { ...e, content: editContent, category: editCategory, tags, summary } : e
    ))
    const updated = entries.find(e => e.id === editingEntry)
    if (updated) setSelectedEntry({ ...updated, content: editContent, category: editCategory, tags, summary })
    setEditingEntry(null)
    notify('Entry updated')
  }

  // ─── Regenerate entry ───
  async function regenerateEntry(entry) {
    const sourcePrompt = prompts.find(p => p.id === entry.source_prompt_id)
    if (!sourcePrompt) return

    await supabase.from('entries').delete().eq('id', entry.id)
    await supabase.from('prompts').update({ status: 'New', processed_at: null }).eq('id', sourcePrompt.id)

    setEntries(prev => prev.filter(e => e.id !== entry.id))
    setPrompts(prev => prev.map(p => p.id === sourcePrompt.id ? { ...p, status: 'New', processed_at: null } : p))
    setSelectedEntry(null)

    processPrompt({ ...sourcePrompt, status: 'New' })
    notify('Regenerating...')
  }

  function extractTags(content) {
    const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4)
    const freq = {}
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
    const stop = new Set(['about','above','after','again','being','below','between','could','these','their','there','those','through','under','until','would','should','which','while','other','might','where','every','never','often','using','based','first','second','third','example','following','however','consider','important','provide','specific','different','approach','another','without','before','because','something','anything','everything','nothing'])
    return Object.entries(freq).filter(([w]) => !stop.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w)
  }

  function generateSummary(content) {
    const sentences = content.replace(/[#*`>\-]/g, '').split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20)
    return sentences.slice(0, 3).join('. ') + (sentences.length > 0 ? '.' : '')
  }

  // ─── Filtered data ───
  const filteredEntries = (() => {
    let filtered = entries
    if (view !== 'all' && view !== 'inbox' && view !== 'archive') {
      filtered = filtered.filter(e => e.category === view)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.content?.toLowerCase().includes(q) ||
        e.tags?.some(t => t.includes(q))
      )
    }
    return filtered
  })()

  const categoryCounts = CATEGORIES.reduce((acc, c) => {
    acc[c] = entries.filter(e => e.category === c).length
    return acc
  }, {})

  const inboxCount = prompts.filter(p => ['New', 'Processing', 'Failed'].includes(p.status)).length

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center">
          <div className="text-4xl font-serif text-ink-500 mb-2">Sofia</div>
          <div className="text-cream-600 text-sm">Loading your knowledge base...</div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // ENTRY DETAIL VIEW
  // ═══════════════════════════════════════════
  if (selectedEntry && !editingEntry) {
    const entry = entries.find(e => e.id === selectedEntry.id) || selectedEntry
    const sourcePrompt = prompts.find(p => p.id === entry.source_prompt_id)
    const cc = CAT_COLORS[entry.category] || CAT_COLORS.Observation

    return (
      <div className="min-h-screen bg-cream-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <button onClick={() => setSelectedEntry(null)} className="text-cream-600 text-sm mb-4 hover:text-cream-800">
            ← Back to {CATEGORIES.includes(view) ? view + 's' : view === 'inbox' ? 'Inbox' : 'All Entries'}
          </button>

          <article className="bg-white rounded-xl p-5 sm:p-8 shadow-sm border border-cream-300 animate-fade-up">
            <div className="flex items-center gap-2 mb-2">
              <span className={`${cc.bg} ${cc.text} px-3 py-1 rounded-full text-xs font-semibold`}>
                {CAT_ICONS[entry.category]} {entry.category}
              </span>
              <span className="text-cream-500 text-xs">{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl text-ink-500 mt-2 mb-4 leading-tight">{entry.title}</h1>

            {entry.tags?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-5">
                {entry.tags.map(t => (
                  <span key={t} className="bg-cream-200 text-cream-700 px-2 py-0.5 rounded text-xs">#{t}</span>
                ))}
              </div>
            )}

            {entry.summary && (
              <div className="bg-cream-50 rounded-lg p-4 mb-5 border-l-[3px] border-gold-500">
                <div className="text-[11px] font-semibold text-gold-500 mb-1 uppercase tracking-wider">Summary</div>
                <div className="text-cream-700 text-sm leading-relaxed">{entry.summary}</div>
              </div>
            )}

            <div className="border-t border-cream-300 pt-5">
              <Markdown content={entry.content} />
            </div>

            {sourcePrompt && (
              <div className="mt-8 pt-4 border-t border-cream-300">
                <div className="text-[11px] font-semibold text-cream-500 uppercase tracking-wider mb-2">Original Prompt</div>
                <div className="bg-cream-50 rounded-lg p-4 text-cream-700 text-sm leading-relaxed italic">
                  {sourcePrompt.body}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-cream-300">
              <button onClick={() => { setEditingEntry(entry.id); setEditContent(entry.content); setEditCategory(entry.category); }}
                className="bg-ink-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Edit Entry</button>
              <button onClick={() => { if (confirm('Delete this entry?')) deleteEntry(entry.id) }}
                className="border border-red-400 text-red-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50">Delete</button>
              {sourcePrompt && (
                <button onClick={() => regenerateEntry(entry)}
                  className="border border-gold-500 text-gold-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-50">Regenerate</button>
              )}
            </div>
          </article>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // EDIT VIEW
  // ═══════════════════════════════════════════
  if (editingEntry) {
    return (
      <div className="min-h-screen bg-cream-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <button onClick={() => setEditingEntry(null)} className="text-cream-600 text-sm mb-4">← Cancel editing</button>
          <div className="bg-white rounded-xl p-5 sm:p-8 shadow-sm border border-cream-300">
            <h2 className="font-serif text-2xl text-ink-500 mb-5">Edit Entry</h2>

            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-cream-600 uppercase tracking-wider mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => {
                  const cc = CAT_COLORS[c]
                  return (
                    <button key={c} onClick={() => setEditCategory(c)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                        editCategory === c ? `${cc.bg} ${cc.text} ${cc.border}` : 'border-cream-300 text-cream-600 hover:border-cream-400'
                      }`}>
                      {CAT_ICONS[c]} {c}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-cream-600 uppercase tracking-wider mb-2">Content (Markdown)</label>
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                className="w-full min-h-[350px] p-4 rounded-lg border border-cream-300 font-mono text-sm leading-relaxed resize-y bg-cream-50" />
            </div>

            <div className="flex gap-3">
              <button onClick={saveEdit} className="bg-ink-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm">Save Changes</button>
              <button onClick={() => setEditingEntry(null)} className="border border-cream-400 text-cream-600 px-5 py-2.5 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-cream-100 flex">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg text-sm font-medium text-white shadow-lg animate-fade-in ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-ink-500'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── SIDEBAR ─── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-ink-500 text-cream-100 flex flex-col transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="font-serif text-2xl text-cream-200">Sofia</div>
          <div className="text-[10px] text-cream-100/40 mt-0.5 uppercase tracking-[0.12em]">Knowledge System</div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          {/* Inbox */}
          <SidebarItem icon="📥" label="Inbox" badge={inboxCount} active={view === 'inbox'}
            onClick={() => { setView('inbox'); setSearchQuery(''); setSidebarOpen(false) }} />

          <div className="px-3 pt-4 pb-1 text-[10px] font-semibold text-cream-100/30 uppercase tracking-[0.12em]">Categories</div>
          {CATEGORIES.map(c => (
            <SidebarItem key={c} icon={CAT_ICONS[c]} label={c + 's'} count={categoryCounts[c]} active={view === c}
              onClick={() => { setView(c); setSearchQuery(''); setSelectedEntry(null); setSidebarOpen(false) }} />
          ))}

          <div className="h-px bg-white/[0.06] mx-3 my-2" />
          <SidebarItem icon="📚" label="All Entries" count={entries.length} active={view === 'all'}
            onClick={() => { setView('all'); setSearchQuery(''); setSidebarOpen(false) }} />
          <SidebarItem icon="🗄️" label="Archive" active={view === 'archive'}
            onClick={() => { setView('archive'); setSearchQuery(''); setSidebarOpen(false) }} />
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] text-cream-100/30 truncate">{user.email}</span>
            <button onClick={onLogout} className="text-[11px] text-cream-100/40 hover:text-cream-200">Logout</button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="px-4 sm:px-6 py-3 flex items-center gap-3 border-b border-cream-300 bg-cream-100/80 backdrop-blur-sm sticky top-0 z-20">
          <button className="lg:hidden text-cream-700 text-xl" onClick={() => setSidebarOpen(true)}>☰</button>
          <h1 className="font-serif text-lg sm:text-xl text-ink-500 flex-shrink-0">
            {view === 'inbox' ? 'Inbox' : view === 'archive' ? 'Archive' : view === 'all' ? 'All Entries' : `${view}s`}
          </h1>
          <div className="flex-1 max-w-md">
            <input type="text" placeholder="Search entries..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm" />
          </div>
          <button onClick={() => setShowNewPrompt(true)}
            className="bg-ink-500 text-cream-200 px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap">
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ New Prompt</span>
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">

          {/* ─── New Prompt Modal ─── */}
          {showNewPrompt && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowNewPrompt(false) }}>
              <div className="bg-white rounded-2xl p-5 sm:p-7 w-full max-w-xl shadow-2xl animate-fade-up">
                <h2 className="font-serif text-xl sm:text-2xl text-ink-500 mb-4">New Prompt</h2>
                <input type="text" placeholder="Title (optional)" value={newPromptTitle} onChange={e => setNewPromptTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-cream-300 text-sm mb-3" />
                <textarea placeholder="What's on your mind? Ask a question, capture an idea, draft something..." value={newPromptText}
                  onChange={e => setNewPromptText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitPrompt() }}
                  className="w-full min-h-[160px] p-4 rounded-lg border border-cream-300 text-sm leading-relaxed resize-y" autoFocus />
                <div className="flex justify-between items-center mt-4">
                  <span className="text-xs text-cream-500">⌘/Ctrl + Enter to submit</span>
                  <div className="flex gap-2">
                    <button onClick={() => setShowNewPrompt(false)} className="border border-cream-400 px-4 py-2 rounded-lg text-sm text-cream-600">Cancel</button>
                    <button onClick={submitPrompt} disabled={!newPromptText.trim()}
                      className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${newPromptText.trim() ? 'bg-ink-500' : 'bg-cream-400 cursor-default'}`}>Submit</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── INBOX VIEW ─── */}
          {view === 'inbox' && (
            <>
              {prompts.filter(p => !['Archived'].includes(p.status)).length === 0 ? (
                <EmptyState icon="📭" title="Your inbox is empty" subtitle="Submit a prompt to get started. Sofia will process it and file it automatically."
                  action={() => setShowNewPrompt(true)} actionLabel="+ New Prompt" />
              ) : (
                <div className="flex flex-col gap-2">
                  {prompts.filter(p => p.status !== 'Archived').map(p => (
                    <div key={p.id} className="bg-white rounded-xl p-4 border border-cream-300 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink-500 truncate">{p.title}</div>
                        <div className="text-xs text-cream-500 flex items-center gap-2 mt-1">
                          <StatusBadge status={p.status} />
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {(p.status === 'New' || p.status === 'Failed') && (
                          <button onClick={() => processPrompt(p)} disabled={processing === p.id}
                            className={`bg-gold-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium ${processing === p.id ? 'opacity-50 cursor-default' : ''}`}>
                            {processing === p.id ? 'Processing...' : p.status === 'Failed' ? 'Retry' : 'Process'}
                          </button>
                        )}
                        {p.status === 'Completed' && (
                          <button onClick={() => { const entry = entries.find(e => e.source_prompt_id === p.id); if (entry) setSelectedEntry(entry) }}
                            className="border border-gold-500 text-gold-500 px-3 py-1.5 rounded-lg text-xs font-medium">View Entry</button>
                        )}
                        <button onClick={() => archivePrompt(p.id)}
                          className="border border-cream-400 text-cream-600 px-3 py-1.5 rounded-lg text-xs">Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── ARCHIVE VIEW ─── */}
          {view === 'archive' && (
            <>
              {prompts.filter(p => p.status === 'Archived').length === 0 ? (
                <EmptyState icon="🗄️" title="No archived prompts" subtitle="Archived prompts will appear here." />
              ) : (
                <div className="flex flex-col gap-2">
                  {prompts.filter(p => p.status === 'Archived').map(p => (
                    <div key={p.id} className="bg-white rounded-xl p-4 border border-cream-300 opacity-60">
                      <div className="font-medium text-cream-700">{p.title}</div>
                      <div className="text-xs text-cream-500 mt-1">{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── ENTRY LIST VIEW ─── */}
          {(CATEGORIES.includes(view) || view === 'all') && (
            <>
              {filteredEntries.length === 0 ? (
                <EmptyState icon={view === 'all' ? '📚' : CAT_ICONS[view]} title={searchQuery ? 'No results found' : `No ${view === 'all' ? 'entries' : view.toLowerCase() + 's'} yet`}
                  subtitle={searchQuery ? `Nothing matches "${searchQuery}"` : 'Submit a prompt and Sofia will categorize it here.'} />
              ) : (
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {filteredEntries.map(entry => {
                    const cc = CAT_COLORS[entry.category] || CAT_COLORS.Observation
                    return (
                      <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                        className="bg-white rounded-xl p-4 border border-cream-300 cursor-pointer hover:shadow-md hover:border-cream-400 transition-all relative overflow-hidden group animate-fade-up">
                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${cc.bar}`} />
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[11px] font-semibold ${cc.text} uppercase tracking-wide`}>{CAT_ICONS[entry.category]} {entry.category}</span>
                          <span className="text-[11px] text-cream-500 ml-auto">{new Date(entry.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="font-serif text-base text-ink-500 mb-1 leading-snug group-hover:text-gold-600 transition-colors">{entry.title}</div>
                        {entry.summary && (
                          <div className="text-xs text-cream-600 leading-relaxed line-clamp-3">{entry.summary}</div>
                        )}
                        {entry.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {entry.tags.slice(0, 3).map(t => (
                              <span key={t} className="bg-cream-200 text-cream-600 px-1.5 py-0.5 rounded text-[10px]">#{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Processing indicator */}
      {processing && (
        <div className="fixed bottom-5 right-5 bg-ink-500 text-cream-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-xl z-50 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
          Sofia is thinking...
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───

function SidebarItem({ icon, label, count, badge, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between mb-0.5 transition-all ${
        active ? 'bg-gold-500/15 text-amber-200' : 'text-cream-100/50 hover:bg-white/[0.05] hover:text-cream-100/70'
      }`}>
      <span>{icon} {label}</span>
      {badge > 0 && <span className="bg-gold-500 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">{badge}</span>}
      {count > 0 && !badge && <span className="text-[11px] text-cream-100/30">{count}</span>}
    </button>
  )
}

function StatusBadge({ status }) {
  const styles = {
    New: 'bg-cream-200 text-cream-700',
    Processing: 'bg-amber-100 text-amber-700',
    Completed: 'bg-green-100 text-green-700',
    Failed: 'bg-red-100 text-red-700',
    Archived: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${styles[status] || styles.New}`}>
      {status === 'Processing' && '⏳ '}{status}
    </span>
  )
}

function EmptyState({ icon, title, subtitle, action, actionLabel }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-3">{icon}</div>
      <div className="font-serif text-xl text-ink-500 mb-1">{title}</div>
      <div className="text-cream-600 text-sm mb-5">{subtitle}</div>
      {action && (
        <button onClick={action} className="bg-ink-500 text-cream-200 px-5 py-2.5 rounded-lg font-semibold text-sm">{actionLabel}</button>
      )}
    </div>
  )
}
