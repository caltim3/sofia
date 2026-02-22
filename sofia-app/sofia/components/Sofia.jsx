'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase-browser'
import Markdown from './Markdown'

const DEFAULT_CATEGORIES = ['Decision', 'Brainstorm', 'Shopping', 'Observation', 'Draft']
const DEFAULT_ICONS = { Decision: '⚖️', Brainstorm: '💡', Shopping: '🛒', Observation: '👁️', Draft: '📝' }
const DEFAULT_COLORS = {
  Decision: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-400', bar: 'bg-purple-500', hex: '#6b5ce7' },
  Brainstorm: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-400', bar: 'bg-amber-500', hex: '#e8a838' },
  Shopping: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-400', bar: 'bg-emerald-500', hex: '#3dba7a' },
  Observation: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-400', bar: 'bg-sky-500', hex: '#4a9edd' },
  Draft: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-400', bar: 'bg-rose-500', hex: '#d45d79' },
}
const MODELS = [
  { id: 'claude', name: 'Claude', icon: '🟣' },
  { id: 'gpt4', name: 'GPT-4o', icon: '🟢' },
]

export default function Sofia({ user, onLogout }) {
  const supabase = getSupabase()

  // Core state
  const [prompts, setPrompts] = useState([])
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [customCategories, setCustomCategories] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  // Navigation
  const [view, setView] = useState('inbox')
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Prompt creation
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [newPromptTitle, setNewPromptTitle] = useState('')
  const [newPromptText, setNewPromptText] = useState('')
  const [selectedModel, setSelectedModel] = useState('claude')
  const [processing, setProcessing] = useState(null)

  // Chat mode
  const [showChat, setShowChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  // Edit mode
  const [editingEntry, setEditingEntry] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('')

  // Modals
  const [showSettings, setShowSettings] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectIcon, setNewProjectIcon] = useState('📁')
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📌')
  const [newCatColor, setNewCatColor] = useState('#8a8478')
  const [assignProjectEntry, setAssignProjectEntry] = useState(null)

  // Voice
  const [isListening, setIsListening] = useState(false)

  // Notifications
  const [notification, setNotification] = useState(null)

  // ─── ALL CATEGORIES (default + custom) ───
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories.map(c => c.name)]
  const getCatIcon = (cat) => DEFAULT_ICONS[cat] || customCategories.find(c => c.name === cat)?.icon || '📌'
  const getCatColor = (cat) => DEFAULT_COLORS[cat] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-400', bar: 'bg-gray-500', hex: customCategories.find(c => c.name === cat)?.color || '#8a8478' }

  // ─── LOAD DATA ───
  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: p }, { data: e }, { data: pr }, { data: cc }] = await Promise.all([
      supabase.from('prompts').select('*').order('created_at', { ascending: false }),
      supabase.from('entries').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('custom_categories').select('*').order('created_at', { ascending: true }),
    ])
    setPrompts(p || [])
    setEntries(e || [])
    setProjects(pr || [])
    setCustomCategories(cc || [])
    setLoading(false)
  }

  function notify(msg, type = 'success') {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }

  // ─── SUBMIT PROMPT ───
  async function submitPrompt() {
    if (!newPromptText.trim()) return
    const body = newPromptText.trim()
    const isDump = body.startsWith('#dump')
    const isChallenge = body.startsWith('#challenge')
    const cleanBody = body.replace(/^#(dump|challenge)\s*/i, '')
    const title = newPromptTitle.trim() || cleanBody.slice(0, 60) + (cleanBody.length > 60 ? '...' : '')
    const mode = isDump ? 'braindump' : isChallenge ? 'challenge' : 'standard'

    const { data: prompt, error } = await supabase
      .from('prompts')
      .insert({ user_id: user.id, title, body: cleanBody, status: 'New', model: selectedModel, mode })
      .select().single()

    if (error) { notify('Failed to create prompt', 'error'); return }

    setPrompts(prev => [prompt, ...prev])
    setNewPromptText('')
    setNewPromptTitle('')
    setShowNewPrompt(false)
    notify(isDump ? 'Brain dump submitted — parsing ideas...' : isChallenge ? 'Challenge mode — analyzing...' : 'Prompt submitted — processing...')
    processPrompt(prompt, mode)
  }

  // ─── PROCESS PROMPT ───
  async function processPrompt(prompt, mode = 'standard') {
    if (prompt.status === 'Processing' || prompt.status === 'Completed') return
    setProcessing(prompt.id)
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, status: 'Processing' } : p))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ promptId: prompt.id, promptBody: prompt.body, model: prompt.model || selectedModel, mode }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { entries: newEntries, category } = await res.json()

      setEntries(prev => [...(newEntries || []), ...prev])
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, status: 'Completed', processed_at: new Date().toISOString() } : p))
      notify(newEntries?.length > 1 ? `Brain dump: ${newEntries.length} entries created` : `Classified as ${category}`)
    } catch (err) {
      console.error(err)
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, status: 'Failed' } : p))
      notify('Processing failed — you can retry', 'error')
    }
    setProcessing(null)
  }

  // ─── CHAT ───
  async function sendChat() {
    if (!chatInput.trim() || !selectedEntry) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: msg, created_at: new Date().toISOString() }])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ entryId: selectedEntry.id, message: msg, model: selectedModel }),
      })
      if (!res.ok) throw new Error('Chat failed')
      const { message: saved } = await res.json()
      setMessages(prev => [...prev, saved])
    } catch (err) {
      notify('Chat failed', 'error')
    }
    setChatLoading(false)
  }

  async function loadMessages(entryId) {
    const { data } = await supabase.from('messages').select('*').eq('entry_id', entryId).order('created_at', { ascending: true })
    setMessages(data || [])
  }

  useEffect(() => { if (showChat && selectedEntry) loadMessages(selectedEntry.id) }, [showChat, selectedEntry?.id])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ─── PIN / STAR ───
  async function togglePin(id) {
    const entry = entries.find(e => e.id === id)
    await supabase.from('entries').update({ pinned: !entry.pinned }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, pinned: !e.pinned } : e))
  }

  async function toggleStar(id) {
    const entry = entries.find(e => e.id === id)
    await supabase.from('entries').update({ starred: !entry.starred }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e))
  }

  // ─── PROJECTS ───
  async function createProject() {
    if (!newProjectName.trim()) return
    const { data, error } = await supabase.from('projects').insert({
      user_id: user.id, name: newProjectName.trim(), icon: newProjectIcon,
    }).select().single()
    if (data) { setProjects(prev => [data, ...prev]); notify('Project created') }
    setNewProjectName('')
    setShowProjectModal(false)
  }

  async function assignToProject(entryId, projectId) {
    await supabase.from('entries').update({ project_id: projectId }).eq('id', entryId)
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, project_id: projectId } : e))
    setAssignProjectEntry(null)
    notify('Entry added to project')
  }

  async function deleteProject(id) {
    await supabase.from('entries').update({ project_id: null }).eq('project_id', id)
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setEntries(prev => prev.map(e => e.project_id === id ? { ...e, project_id: null } : e))
    if (view === `project-${id}`) setView('all')
    notify('Project deleted')
  }

  // ─── CUSTOM CATEGORIES ───
  async function addCategory() {
    if (!newCatName.trim()) return
    const { data, error } = await supabase.from('custom_categories').insert({
      user_id: user.id, name: newCatName.trim(), icon: newCatIcon, color: newCatColor,
    }).select().single()
    if (error) { notify(error.message, 'error'); return }
    if (data) { setCustomCategories(prev => [...prev, data]); notify('Category added') }
    setNewCatName('')
  }

  async function removeCategory(id) {
    await supabase.from('custom_categories').delete().eq('id', id)
    setCustomCategories(prev => prev.filter(c => c.id !== id))
  }

  // ─── ARCHIVE / DELETE ───
  async function archivePrompt(id) {
    await supabase.from('prompts').update({ status: 'Archived' }).eq('id', id)
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, status: 'Archived' } : p))
  }

  async function deleteEntry(id) {
    await supabase.from('messages').delete().eq('entry_id', id)
    await supabase.from('entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelectedEntry(null)
  }

  async function saveEdit() {
    if (!editingEntry) return
    const tags = extractTags(editContent)
    const summary = generateSummary(editContent)
    await supabase.from('entries').update({ content: editContent, category: editCategory, tags, summary }).eq('id', editingEntry)
    setEntries(prev => prev.map(e => e.id === editingEntry ? { ...e, content: editContent, category: editCategory, tags, summary } : e))
    setEditingEntry(null)
    notify('Entry updated')
  }

  // ─── VOICE INPUT ───
  function startVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      notify('Voice input not supported in this browser', 'error'); return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    let finalTranscript = ''
    recognition.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setNewPromptText(finalTranscript + interim)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => { setIsListening(false); notify('Voice error', 'error') }
    recognition.start()
    setIsListening(true)
    setShowNewPrompt(true)
    // Store ref to stop later
    window._sofiaRecognition = recognition
  }

  function stopVoice() {
    window._sofiaRecognition?.stop()
    setIsListening(false)
  }

  // ─── NOTION SYNC ───
  async function syncToNotion(entryId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notion-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ entryId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      notify('Synced to Notion!')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  // ─── EXPORT ───
  async function exportEntry(entryId, format) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ entryId, format }),
    })
    const { markdown, title } = await res.json()
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
    notify('Exported as Markdown')
  }

  async function exportPDF(entryId) {
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return
    // Open print dialog for PDF
    const printWindow = window.open('', '_blank')
    const date = new Date(entry.created_at).toLocaleDateString()
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${entry.title}</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;color:#2c2a25;line-height:1.7}
h1{font-size:1.8em;margin-bottom:0.3em}h2{font-size:1.3em;margin-top:1.5em}h3{font-size:1.1em}
.meta{color:#8a8478;font-size:0.85em;margin-bottom:1.5em;padding-bottom:1em;border-bottom:1px solid #e0dbd3}
blockquote{border-left:3px solid #b08540;padding-left:1em;color:#5a5347;font-style:italic}
code{background:#f0ece4;padding:0.2em 0.4em;border-radius:3px;font-size:0.9em}
pre{background:#1a1a2e;color:#e0e0e0;padding:1em;border-radius:8px;overflow:auto}
ul,ol{padding-left:1.5em}li{margin-bottom:0.3em}</style></head>
<body><h1>${entry.title}</h1><div class="meta">${entry.category} · ${date}${entry.tags?.length ? ' · ' + entry.tags.map(t=>'#'+t).join(' ') : ''}</div>
${entry.summary ? '<blockquote>'+entry.summary+'</blockquote>' : ''}
${simpleMarkdownToHtml(entry.content)}
<hr style="margin-top:2em;border:none;border-top:1px solid #e0dbd3"><p style="color:#b0a898;font-size:0.8em">Exported from Sofia Knowledge System</p>
</body></html>`)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
    notify('PDF print dialog opened')
  }

  function simpleMarkdownToHtml(md) {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
  }

  // ─── RELATED ENTRIES ───
  function getRelatedEntries(entry) {
    if (!entry) return []
    const entryTags = new Set(entry.tags || [])
    const words = new Set(entry.content?.toLowerCase().split(/\s+/).filter(w => w.length > 5).slice(0, 30) || [])
    return entries
      .filter(e => e.id !== entry.id)
      .map(e => {
        let score = 0
        const eTags = new Set(e.tags || [])
        for (const t of entryTags) { if (eTags.has(t)) score += 3 }
        if (e.category === entry.category) score += 1
        if (e.project_id && e.project_id === entry.project_id) score += 2
        const eWords = new Set(e.content?.toLowerCase().split(/\s+/).filter(w => w.length > 5).slice(0, 30) || [])
        for (const w of words) { if (eWords.has(w)) score += 0.5 }
        return { ...e, _score: score }
      })
      .filter(e => e._score > 2)
      .sort((a, b) => b._score - a._score)
      .slice(0, 5)
  }

  // ─── HELPERS ───
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

  // ─── FILTERED DATA ───
  const filteredEntries = (() => {
    let filtered = entries
    if (view === 'starred') filtered = filtered.filter(e => e.starred)
    else if (view.startsWith('project-')) filtered = filtered.filter(e => e.project_id === view.replace('project-', ''))
    else if (allCategories.includes(view)) filtered = filtered.filter(e => e.category === view)
    else if (view !== 'all' && view !== 'inbox' && view !== 'archive' && view !== 'settings') return []

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(e => e.title?.toLowerCase().includes(q) || e.content?.toLowerCase().includes(q) || e.tags?.some(t => t.includes(q)))
    }
    // Pinned first, then by date
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.created_at) - new Date(a.created_at)
    })
  })()

  const categoryCounts = allCategories.reduce((acc, c) => { acc[c] = entries.filter(e => e.category === c).length; return acc }, {})
  const inboxCount = prompts.filter(p => ['New', 'Processing', 'Failed'].includes(p.status)).length
  const starredCount = entries.filter(e => e.starred).length

  // ─── LOADING ───
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center"><div className="text-4xl font-serif text-ink-500 mb-2">Sofia</div><div className="text-cream-600 text-sm">Loading your knowledge base...</div></div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // ENTRY DETAIL VIEW (with chat, export, connections)
  // ═══════════════════════════════════════
  if (selectedEntry && !editingEntry) {
    const entry = entries.find(e => e.id === selectedEntry.id) || selectedEntry
    const sourcePrompt = prompts.find(p => p.id === entry.source_prompt_id)
    const cc = getCatColor(entry.category)
    const related = getRelatedEntries(entry)
    const project = projects.find(p => p.id === entry.project_id)

    return (
      <div className="min-h-screen bg-cream-100 flex flex-col lg:flex-row">
        {/* Main entry */}
        <div className={`flex-1 overflow-auto ${showChat ? 'lg:border-r lg:border-cream-300' : ''}`}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <button onClick={() => { setSelectedEntry(null); setShowChat(false) }} className="text-cream-600 text-sm mb-4 hover:text-cream-800">← Back</button>

            <article className="bg-white rounded-xl p-5 sm:p-8 shadow-sm border border-cream-300">
              {/* Top bar: category, pin, star */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`${cc.bg} ${cc.text} px-3 py-1 rounded-full text-xs font-semibold`}>{getCatIcon(entry.category)} {entry.category}</span>
                {project && <span className="bg-cream-200 text-cream-700 px-2 py-1 rounded-full text-xs">{project.icon} {project.name}</span>}
                {entry.model && entry.model !== 'claude' && <span className="text-xs text-cream-500">via {MODELS.find(m => m.id === entry.model)?.name || entry.model}</span>}
                <span className="text-cream-500 text-xs">{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => togglePin(entry.id)} className={`text-lg px-1 ${entry.pinned ? '' : 'opacity-30 hover:opacity-60'}`} title="Pin">{entry.pinned ? '📌' : '📌'}</button>
                  <button onClick={() => toggleStar(entry.id)} className={`text-lg px-1 ${entry.starred ? '' : 'opacity-30 hover:opacity-60'}`} title="Star">{entry.starred ? '⭐' : '☆'}</button>
                </div>
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl text-ink-500 mt-2 mb-4 leading-tight">{entry.title}</h1>

              {entry.tags?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-5">
                  {entry.tags.map(t => <span key={t} className="bg-cream-200 text-cream-700 px-2 py-0.5 rounded text-xs">#{t}</span>)}
                </div>
              )}

              {entry.summary && (
                <div className="bg-cream-50 rounded-lg p-4 mb-5 border-l-[3px] border-gold-500">
                  <div className="text-[11px] font-semibold text-gold-500 mb-1 uppercase tracking-wider">Summary</div>
                  <div className="text-cream-700 text-sm leading-relaxed">{entry.summary}</div>
                </div>
              )}

              <div className="border-t border-cream-300 pt-5"><Markdown content={entry.content} /></div>

              {sourcePrompt && (
                <div className="mt-8 pt-4 border-t border-cream-300">
                  <div className="text-[11px] font-semibold text-cream-500 uppercase tracking-wider mb-2">Original Prompt</div>
                  <div className="bg-cream-50 rounded-lg p-4 text-cream-700 text-sm leading-relaxed italic">{sourcePrompt.body}</div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-cream-300">
                <button onClick={() => { setShowChat(!showChat) }} className="bg-ink-500 text-white px-3 py-2 rounded-lg text-xs font-medium">💬 Chat</button>
                <button onClick={() => { setEditingEntry(entry.id); setEditContent(entry.content); setEditCategory(entry.category) }} className="bg-cream-200 text-cream-800 px-3 py-2 rounded-lg text-xs font-medium">✏️ Edit</button>
                <button onClick={() => setAssignProjectEntry(entry.id)} className="bg-cream-200 text-cream-800 px-3 py-2 rounded-lg text-xs font-medium">📁 Project</button>
                <button onClick={() => exportEntry(entry.id, 'md')} className="bg-cream-200 text-cream-800 px-3 py-2 rounded-lg text-xs font-medium">📥 Export MD</button>
                <button onClick={() => exportPDF(entry.id)} className="bg-cream-200 text-cream-800 px-3 py-2 rounded-lg text-xs font-medium">📄 Export PDF</button>
                <button onClick={() => syncToNotion(entry.id)} className="bg-cream-200 text-cream-800 px-3 py-2 rounded-lg text-xs font-medium">📓 Notion</button>
                <button onClick={() => { if (confirm('Delete?')) deleteEntry(entry.id) }} className="border border-red-300 text-red-500 px-3 py-2 rounded-lg text-xs font-medium">🗑️ Delete</button>
              </div>
            </article>

            {/* Related Entries */}
            {related.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-cream-600 uppercase tracking-wider mb-3">🔗 Related Entries</h3>
                <div className="grid gap-2">
                  {related.map(r => (
                    <div key={r.id} onClick={() => { setSelectedEntry(r); setShowChat(false) }}
                      className="bg-white rounded-lg p-3 border border-cream-300 cursor-pointer hover:shadow-sm transition-all flex items-center gap-3">
                      <span className="text-lg">{getCatIcon(r.category)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink-500 truncate">{r.title}</div>
                        <div className="text-xs text-cream-500">{r.category} · {new Date(r.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assign to Project Modal */}
            {assignProjectEntry && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setAssignProjectEntry(null) }}>
                <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl">
                  <h3 className="font-serif text-lg text-ink-500 mb-3">Assign to Project</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <button onClick={() => assignToProject(assignProjectEntry, null)} className="w-full text-left p-2 rounded-lg hover:bg-cream-100 text-sm text-cream-600">No Project</button>
                    {projects.map(p => (
                      <button key={p.id} onClick={() => assignToProject(assignProjectEntry, p.id)}
                        className="w-full text-left p-2 rounded-lg hover:bg-cream-100 text-sm">{p.icon} {p.name}</button>
                    ))}
                  </div>
                  <button onClick={() => setAssignProjectEntry(null)} className="mt-3 w-full border border-cream-300 text-cream-600 py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 border-cream-300 flex flex-col h-[50vh] lg:h-screen lg:sticky lg:top-0">
            <div className="px-4 py-3 border-b border-cream-300 flex items-center justify-between">
              <span className="font-semibold text-sm text-ink-500">💬 Chat about this entry</span>
              <button onClick={() => setShowChat(false)} className="text-cream-500 text-lg">×</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-ink-500 text-white' : 'bg-cream-100 text-cream-900'}`}>
                    {m.role === 'assistant' ? <Markdown content={m.content} /> : m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start"><div className="bg-cream-100 rounded-xl px-4 py-2 text-sm text-cream-500">Sofia is thinking...</div></div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-cream-300 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                placeholder="Ask a follow-up..." className="flex-1 px-3 py-2 rounded-lg border border-cream-300 text-sm" />
              <button onClick={sendChat} disabled={chatLoading} className="bg-ink-500 text-white px-3 py-2 rounded-lg text-sm font-medium">Send</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════
  // EDIT VIEW
  // ═══════════════════════════════════════
  if (editingEntry) {
    return (
      <div className="min-h-screen bg-cream-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <button onClick={() => setEditingEntry(null)} className="text-cream-600 text-sm mb-4">← Cancel</button>
          <div className="bg-white rounded-xl p-5 sm:p-8 shadow-sm border border-cream-300">
            <h2 className="font-serif text-2xl text-ink-500 mb-5">Edit Entry</h2>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-cream-600 uppercase tracking-wider mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {allCategories.map(c => (
                  <button key={c} onClick={() => setEditCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${editCategory === c ? `${getCatColor(c).bg} ${getCatColor(c).text} ${getCatColor(c).border}` : 'border-cream-300 text-cream-600'}`}>
                    {getCatIcon(c)} {c}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
              className="w-full min-h-[350px] p-4 rounded-lg border border-cream-300 font-mono text-sm leading-relaxed resize-y bg-cream-50" />
            <div className="flex gap-3 mt-4">
              <button onClick={saveEdit} className="bg-ink-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm">Save</button>
              <button onClick={() => setEditingEntry(null)} className="border border-cream-400 text-cream-600 px-5 py-2.5 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════
  return (
    <div className="min-h-screen bg-cream-100 flex">
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg text-sm font-medium text-white shadow-lg animate-fade-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-ink-500'}`}>{notification.msg}</div>
      )}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ─── SIDEBAR ─── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-ink-500 text-cream-100 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="font-serif text-2xl text-cream-200">Sofia</div>
          <div className="text-[10px] text-cream-100/40 mt-0.5 uppercase tracking-[0.12em]">Knowledge System</div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          <SidebarBtn icon="📥" label="Inbox" badge={inboxCount} active={view === 'inbox'} onClick={() => { setView('inbox'); setSidebarOpen(false) }} />
          <SidebarBtn icon="⭐" label="Starred" count={starredCount} active={view === 'starred'} onClick={() => { setView('starred'); setSidebarOpen(false) }} />

          <div className="px-3 pt-4 pb-1 text-[10px] font-semibold text-cream-100/30 uppercase tracking-[0.12em]">Categories</div>
          {DEFAULT_CATEGORIES.map(c => (
            <SidebarBtn key={c} icon={DEFAULT_ICONS[c]} label={c + 's'} count={categoryCounts[c]} active={view === c} onClick={() => { setView(c); setSidebarOpen(false); setSelectedEntry(null) }} />
          ))}
          {customCategories.map(c => (
            <SidebarBtn key={c.id} icon={c.icon} label={c.name} count={categoryCounts[c.name]} active={view === c.name} onClick={() => { setView(c.name); setSidebarOpen(false); setSelectedEntry(null) }} />
          ))}

          {projects.length > 0 && (
            <>
              <div className="px-3 pt-4 pb-1 text-[10px] font-semibold text-cream-100/30 uppercase tracking-[0.12em]">Projects</div>
              {projects.map(p => (
                <SidebarBtn key={p.id} icon={p.icon} label={p.name} count={entries.filter(e => e.project_id === p.id).length}
                  active={view === `project-${p.id}`} onClick={() => { setView(`project-${p.id}`); setSidebarOpen(false) }} />
              ))}
            </>
          )}

          <div className="h-px bg-white/[0.06] mx-3 my-2" />
          <SidebarBtn icon="📚" label="All Entries" count={entries.length} active={view === 'all'} onClick={() => { setView('all'); setSidebarOpen(false) }} />
          <SidebarBtn icon="🗄️" label="Archive" active={view === 'archive'} onClick={() => { setView('archive'); setSidebarOpen(false) }} />
          <SidebarBtn icon="⚙️" label="Settings" active={view === 'settings'} onClick={() => { setView('settings'); setSidebarOpen(false) }} />
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] text-cream-100/30 truncate">{user.email}</span>
            <button onClick={onLogout} className="text-[11px] text-cream-100/40 hover:text-cream-200">Logout</button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-4 sm:px-6 py-3 flex items-center gap-3 border-b border-cream-300 bg-cream-100/80 backdrop-blur-sm sticky top-0 z-20">
          <button className="lg:hidden text-cream-700 text-xl" onClick={() => setSidebarOpen(true)}>☰</button>
          <h1 className="font-serif text-lg sm:text-xl text-ink-500 flex-shrink-0">
            {view === 'inbox' ? 'Inbox' : view === 'archive' ? 'Archive' : view === 'all' ? 'All Entries' : view === 'starred' ? 'Starred' : view === 'settings' ? 'Settings' : view.startsWith('project-') ? projects.find(p => p.id === view.replace('project-',''))?.name || 'Project' : `${view}s`}
          </h1>
          <div className="flex-1 max-w-md">
            <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-cream-300 bg-white text-sm" />
          </div>
          <button onClick={startVoice} className={`px-2 py-2 rounded-lg text-sm ${isListening ? 'bg-red-500 text-white' : 'bg-cream-200 text-cream-700'}`} title="Voice input">
            🎙️
          </button>
          <button onClick={() => setShowNewPrompt(true)} className="bg-ink-500 text-cream-200 px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap">
            <span className="sm:hidden">+</span><span className="hidden sm:inline">+ New Prompt</span>
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">

          {/* ─── NEW PROMPT MODAL ─── */}
          {showNewPrompt && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setShowNewPrompt(false); stopVoice() } }}>
              <div className="bg-white rounded-2xl p-5 sm:p-7 w-full max-w-xl shadow-2xl animate-fade-up">
                <h2 className="font-serif text-xl sm:text-2xl text-ink-500 mb-4">New Prompt</h2>

                {/* Model selector */}
                <div className="flex gap-2 mb-3">
                  {MODELS.map(m => (
                    <button key={m.id} onClick={() => setSelectedModel(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${selectedModel === m.id ? 'border-ink-500 bg-ink-500 text-white' : 'border-cream-300 text-cream-600'}`}>
                      {m.icon} {m.name}
                    </button>
                  ))}
                </div>

                <input type="text" placeholder="Title (optional)" value={newPromptTitle} onChange={e => setNewPromptTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-cream-300 text-sm mb-3" />
                <textarea placeholder="What's on your mind?&#10;&#10;Prefixes:&#10;#dump — brain dump (splits into multiple entries)&#10;#challenge — devil's advocate mode"
                  value={newPromptText} onChange={e => setNewPromptText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitPrompt() }}
                  className="w-full min-h-[160px] p-4 rounded-lg border border-cream-300 text-sm leading-relaxed resize-y" autoFocus />

                {isListening && (
                  <div className="flex items-center gap-2 mt-2 text-red-500 text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Listening... <button onClick={stopVoice} className="underline">Stop</button>
                  </div>
                )}

                <div className="flex justify-between items-center mt-4">
                  <span className="text-xs text-cream-500">⌘/Ctrl+Enter to submit · #dump · #challenge</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowNewPrompt(false); stopVoice() }} className="border border-cream-400 px-4 py-2 rounded-lg text-sm text-cream-600">Cancel</button>
                    <button onClick={submitPrompt} disabled={!newPromptText.trim()}
                      className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${newPromptText.trim() ? 'bg-ink-500' : 'bg-cream-400 cursor-default'}`}>Submit</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── SETTINGS VIEW ─── */}
          {view === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Projects */}
              <div className="bg-white rounded-xl p-5 border border-cream-300">
                <h3 className="font-serif text-lg text-ink-500 mb-4">📁 Projects</h3>
                <div className="flex gap-2 mb-3">
                  <input value={newProjectIcon} onChange={e => setNewProjectIcon(e.target.value)} className="w-12 text-center px-2 py-2 rounded-lg border border-cream-300 text-lg" maxLength={2} />
                  <input placeholder="Project name" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-cream-300 text-sm" onKeyDown={e => { if (e.key === 'Enter') createProject() }} />
                  <button onClick={createProject} className="bg-ink-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Add</button>
                </div>
                {projects.length === 0 && <p className="text-cream-500 text-sm">No projects yet.</p>}
                {projects.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-cream-200 last:border-0">
                    <span className="text-sm">{p.icon} {p.name} <span className="text-cream-500">({entries.filter(e => e.project_id === p.id).length} entries)</span></span>
                    <button onClick={() => { if (confirm('Delete project?')) deleteProject(p.id) }} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                ))}
              </div>

              {/* Custom Categories */}
              <div className="bg-white rounded-xl p-5 border border-cream-300">
                <h3 className="font-serif text-lg text-ink-500 mb-4">🏷️ Custom Categories</h3>
                <div className="flex gap-2 mb-3">
                  <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} className="w-12 text-center px-2 py-2 rounded-lg border border-cream-300 text-lg" maxLength={2} />
                  <input placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-cream-300 text-sm" onKeyDown={e => { if (e.key === 'Enter') addCategory() }} />
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-10 h-10 rounded-lg border border-cream-300 cursor-pointer" />
                  <button onClick={addCategory} className="bg-ink-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Add</button>
                </div>
                <div className="text-xs text-cream-500 mb-3">Default categories: {DEFAULT_CATEGORIES.join(', ')}</div>
                {customCategories.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-cream-200 last:border-0">
                    <span className="text-sm flex items-center gap-2">{c.icon} {c.name} <span className="w-3 h-3 rounded-full" style={{ background: c.color }} /></span>
                    <button onClick={() => removeCategory(c.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                ))}
              </div>

              {/* Notion Config Info */}
              <div className="bg-white rounded-xl p-5 border border-cream-300">
                <h3 className="font-serif text-lg text-ink-500 mb-2">📓 Notion Sync</h3>
                <p className="text-sm text-cream-600 leading-relaxed">To enable Notion sync, add these environment variables in Vercel:</p>
                <div className="bg-cream-50 rounded-lg p-3 mt-2 font-mono text-xs space-y-1">
                  <div><strong>NOTION_API_KEY</strong> — from notion.so/my-integrations</div>
                  <div><strong>NOTION_DATABASE_ID</strong> — the ID from your Notion database URL</div>
                </div>
                <p className="text-xs text-cream-500 mt-2">Create an integration, share your database with it, then add the keys.</p>
              </div>

              {/* AI Models Info */}
              <div className="bg-white rounded-xl p-5 border border-cream-300">
                <h3 className="font-serif text-lg text-ink-500 mb-2">🤖 AI Models</h3>
                <p className="text-sm text-cream-600 leading-relaxed">Claude is enabled by default. To add GPT-4o, add this in Vercel environment variables:</p>
                <div className="bg-cream-50 rounded-lg p-3 mt-2 font-mono text-xs">
                  <div><strong>OPENAI_API_KEY</strong> — from platform.openai.com/api-keys</div>
                </div>
              </div>
            </div>
          )}

          {/* ─── INBOX VIEW ─── */}
          {view === 'inbox' && (
            <>
              {prompts.filter(p => p.status !== 'Archived').length === 0 ? (
                <EmptyState icon="📭" title="Your inbox is empty" subtitle="Submit a prompt, brain dump (#dump), or challenge (#challenge)."
                  action={() => setShowNewPrompt(true)} actionLabel="+ New Prompt" />
              ) : (
                <div className="flex flex-col gap-2">
                  {prompts.filter(p => p.status !== 'Archived').map(p => (
                    <div key={p.id} className="bg-white rounded-xl p-4 border border-cream-300 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink-500 truncate flex items-center gap-2">
                          {p.mode === 'braindump' && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">DUMP</span>}
                          {p.mode === 'challenge' && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">CHALLENGE</span>}
                          {p.title}
                        </div>
                        <div className="text-xs text-cream-500 flex items-center gap-2 mt-1">
                          <StatusBadge status={p.status} />
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                          {p.model && p.model !== 'claude' && <span>via {p.model}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {(p.status === 'New' || p.status === 'Failed') && (
                          <button onClick={() => processPrompt(p, p.mode)} disabled={processing === p.id}
                            className={`bg-gold-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium ${processing === p.id ? 'opacity-50' : ''}`}>
                            {processing === p.id ? 'Processing...' : p.status === 'Failed' ? 'Retry' : 'Process'}
                          </button>
                        )}
                        {p.status === 'Completed' && (
                          <button onClick={() => { const entry = entries.find(e => e.source_prompt_id === p.id); if (entry) setSelectedEntry(entry) }}
                            className="border border-gold-500 text-gold-500 px-3 py-1.5 rounded-lg text-xs font-medium">View</button>
                        )}
                        <button onClick={() => archivePrompt(p.id)} className="border border-cream-400 text-cream-600 px-3 py-1.5 rounded-lg text-xs">Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── ARCHIVE ─── */}
          {view === 'archive' && (
            <>
              {prompts.filter(p => p.status === 'Archived').length === 0 ? (
                <EmptyState icon="🗄️" title="No archived prompts" />
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

          {/* ─── ENTRY LIST (categories, all, starred, projects) ─── */}
          {(allCategories.includes(view) || view === 'all' || view === 'starred' || view.startsWith('project-')) && (
            <>
              {view.startsWith('project-') && (
                <div className="mb-4 flex items-center gap-2">
                  <button onClick={() => { if (confirm('Delete this project?')) deleteProject(view.replace('project-','')) }}
                    className="text-xs text-red-400 border border-red-300 px-2 py-1 rounded">Delete Project</button>
                </div>
              )}
              {filteredEntries.length === 0 ? (
                <EmptyState icon={view === 'starred' ? '⭐' : view === 'all' ? '📚' : getCatIcon(view)}
                  title={searchQuery ? 'No results' : view === 'starred' ? 'No starred entries' : 'No entries yet'}
                  subtitle={searchQuery ? `Nothing matches "${searchQuery}"` : 'Submit a prompt to get started.'} />
              ) : (
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {filteredEntries.map(entry => {
                    const cc = getCatColor(entry.category)
                    return (
                      <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                        className="bg-white rounded-xl p-4 border border-cream-300 cursor-pointer hover:shadow-md hover:border-cream-400 transition-all relative overflow-hidden group">
                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${cc.bar}`} />
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[11px] font-semibold ${cc.text} uppercase tracking-wide`}>{getCatIcon(entry.category)} {entry.category}</span>
                          {entry.pinned && <span className="text-xs">📌</span>}
                          {entry.starred && <span className="text-xs">⭐</span>}
                          <span className="text-[11px] text-cream-500 ml-auto">{new Date(entry.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="font-serif text-base text-ink-500 mb-1 leading-snug group-hover:text-gold-600 transition-colors">{entry.title}</div>
                        {entry.summary && <div className="text-xs text-cream-600 leading-relaxed line-clamp-3">{entry.summary}</div>}
                        {entry.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {entry.tags.slice(0, 3).map(t => <span key={t} className="bg-cream-200 text-cream-600 px-1.5 py-0.5 rounded text-[10px]">#{t}</span>)}
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

      {processing && (
        <div className="fixed bottom-5 right-5 bg-ink-500 text-cream-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-xl z-50">
          <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />Sofia is thinking...
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───
function SidebarBtn({ icon, label, count, badge, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between mb-0.5 transition-all ${active ? 'bg-gold-500/15 text-amber-200' : 'text-cream-100/50 hover:bg-white/[0.05] hover:text-cream-100/70'}`}>
      <span className="truncate">{icon} {label}</span>
      {badge > 0 && <span className="bg-gold-500 text-white rounded-full px-2 py-0.5 text-[11px] font-bold ml-1">{badge}</span>}
      {count > 0 && !badge && <span className="text-[11px] text-cream-100/30 ml-1">{count}</span>}
    </button>
  )
}

function StatusBadge({ status }) {
  const s = { New: 'bg-cream-200 text-cream-700', Processing: 'bg-amber-100 text-amber-700', Completed: 'bg-green-100 text-green-700', Failed: 'bg-red-100 text-red-700', Archived: 'bg-gray-100 text-gray-500' }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${s[status] || s.New}`}>{status === 'Processing' && '⏳ '}{status}</span>
}

function EmptyState({ icon, title, subtitle, action, actionLabel }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-3">{icon}</div>
      <div className="font-serif text-xl text-ink-500 mb-1">{title}</div>
      {subtitle && <div className="text-cream-600 text-sm mb-5">{subtitle}</div>}
      {action && <button onClick={action} className="bg-ink-500 text-cream-200 px-5 py-2.5 rounded-lg font-semibold text-sm">{actionLabel}</button>}
    </div>
  )
}
