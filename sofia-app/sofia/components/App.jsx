'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, Star, Pin, Trash2, MessageSquare, ChevronDown, ChevronUp,
  Mic, MicOff, Download, Upload, Clock, Filter, X, FolderOpen, Tag,
  ExternalLink, RefreshCw, Check, AlertTriangle, Sparkles, Send,
  Volume2, FileText, MoreHorizontal, Edit3, Archive
} from 'lucide-react';
import TemplateSelector from '../components/TemplateSelector';
import TemplateForm from '../components/TemplateForm';
import TodoPanel from '../components/TodoPanel';
import { DEFAULT_TEMPLATES, detectTemplatePrefix } from '../lib/templates';

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

const CATEGORIES = [
  'personal', 'health', 'fitness', 'family', 'work', 'music',
  'ideas', 'ghent', 'NYC', 'travel/food', 'books', 'oligarch novel'
];

const CATEGORY_COLORS = {
  personal:        { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300' },
  health:          { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  fitness:         { bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-300' },
  family:          { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300' },
  work:            { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  music:           { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  ideas:           { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300' },
  ghent:           { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300' },
  NYC:             { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  'travel/food':   { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
  books:           { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  'oligarch novel':{ bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
};

const TEMPLATE_ICONS = {
  'freeform': '✏️',
  'todo': '☑️',
  'deal-concept': '⚡',
  'music-idea': '🎸',
  'shopping-list': '🛒',
  'deep-thought': '🧠',
  'book-note': '📚',
  'ghent-project': '🏠',
  'recipe-restaurant': '🍽️',
};

// ─── MAIN APP COMPONENT ──────────────────────────────────────────────────────

export default function SofiaApp() {
  // ── Core State ──
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [input, setInput] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);

  // ── Filters & Search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, confidence

  // ── Template State (V2.1 NEW) ──
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState('freeform');
  const [templateData, setTemplateData] = useState({});
  const [currentTemplateConfig, setCurrentTemplateConfig] = useState(null);

  // ── Chat Mode ──
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatProcessing, setChatProcessing] = useState(false);

  // ── Voice Input ──
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // ── Model Selection ──
  const [selectedModel, setSelectedModel] = useState('claude');

  // ── Projects ──
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  // ── UI State ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const inputRef = useRef(null);

  // ─── DATA FETCHING ────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/entries');
      const data = await res.json();
      if (data.entries) setEntries(data.entries);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch templates from Supabase (V2.1 NEW)
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates?.length > 0) setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates, using defaults:', error);
    }
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchTemplates();
    fetchProjects();
  }, [fetchEntries, fetchTemplates, fetchProjects]);

  // Update current template config when selection changes (V2.1 NEW)
  useEffect(() => {
    const tmpl = templates.find(t => t.slug === selectedTemplate);
    setCurrentTemplateConfig(tmpl || null);
    setTemplateData({});
  }, [selectedTemplate, templates]);

  // ─── INPUT HANDLERS ───────────────────────────────────────────────────────

  function handleInputChange(e) {
    const value = e.target.value;
    setInput(value);

    // Auto-detect template prefix (V2.1 NEW)
    const detected = detectTemplatePrefix(value);
    if (detected) {
      setSelectedTemplate(detected.slug);
      setInput(detected.cleanedInput);
    }
  }

  // ─── SUBMIT / PROCESS ─────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e?.preventDefault();
    const trimmed = input.trim();
    const hasTemplateData = Object.keys(templateData).length > 0 &&
      Object.values(templateData).some(v => v);

    if (!trimmed && !hasTemplateData) return;

    // Check for special prefixes (existing V2 features)
    if (trimmed.startsWith('#dump ')) {
      return handleBrainDump(trimmed.slice(6));
    }
    if (trimmed.startsWith('#challenge ')) {
      return handleChallenge(trimmed.slice(11));
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          template_type: selectedTemplate,
          template_data: selectedTemplate !== 'freeform' ? templateData : null,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setInput('');
        setSelectedTemplate('freeform');
        setTemplateData({});
        fetchEntries();
      } else {
        alert('Processing error: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to process entry');
    } finally {
      setProcessing(false);
    }
  }

  // Handle template form submission (V2.1 NEW)
  async function handleTemplateSubmit(data) {
    setTemplateData(data);
    // Build a content string from the template data for the API
    const contentParts = Object.entries(data)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    setInput(contentParts.join('\n'));

    // Submit after state update
    setProcessing(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentParts.join('\n'),
          template_type: selectedTemplate,
          template_data: data,
          model: selectedModel,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setInput('');
        setSelectedTemplate('freeform');
        setTemplateData({});
        fetchEntries();
      } else {
        alert('Processing error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Template submit error:', error);
    } finally {
      setProcessing(false);
    }
  }

  // ─── BRAIN DUMP (existing V2) ─────────────────────────────────────────────

  async function handleBrainDump(content) {
    setProcessing(true);
    try {
      const res = await fetch('/api/process/dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, model: selectedModel }),
      });
      const data = await res.json();
      if (data.success) {
        setInput('');
        fetchEntries();
      }
    } catch (error) {
      console.error('Brain dump error:', error);
    } finally {
      setProcessing(false);
    }
  }

  // ─── CHALLENGE MODE (existing V2) ─────────────────────────────────────────

  async function handleChallenge(content) {
    setProcessing(true);
    try {
      const res = await fetch('/api/process/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, model: selectedModel }),
      });
      const data = await res.json();
      if (data.success) {
        setInput('');
        fetchEntries();
      }
    } catch (error) {
      console.error('Challenge error:', error);
    } finally {
      setProcessing(false);
    }
  }

  // ─── TODO TOGGLE (V2.1 NEW) ──────────────────────────────────────────────

  async function handleToggleTodo(id, completed) {
    // Optimistic update
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, todo_completed: completed, todo_completed_at: completed ? new Date().toISOString() : null } : e
    ));

    try {
      await fetch('/api/todos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed }),
      });
    } catch (error) {
      console.error('Todo toggle error:', error);
      fetchEntries(); // Revert on error
    }
  }

  // ─── ENTRY ACTIONS ────────────────────────────────────────────────────────

  async function handlePin(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    try {
      await fetch('/api/entries/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pinned: !entry.pinned }),
      });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, pinned: !e.pinned } : e));
    } catch (error) { console.error('Pin error:', error); }
  }

  async function handleStar(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    try {
      await fetch('/api/entries/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, starred: !entry.starred }),
      });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));
    } catch (error) { console.error('Star error:', error); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await fetch('/api/entries/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setEntries(prev => prev.filter(e => e.id !== id));
      if (selectedEntry?.id === id) setSelectedEntry(null);
    } catch (error) { console.error('Delete error:', error); }
  }

  async function handleReview(id) {
    try {
      await fetch('/api/entries/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reviewed: true }),
      });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, reviewed: true } : e));
    } catch (error) { console.error('Review error:', error); }
  }

  // ─── CHAT MODE ────────────────────────────────────────────────────────────

  async function handleChatSend() {
    if (!chatInput.trim() || !selectedEntry) return;
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setChatProcessing(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: selectedEntry.id,
          message: userMessage,
          history: chatMessages,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (data.response) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error: could not get response.' }]);
    } finally {
      setChatProcessing(false);
    }
  }

  // ─── VOICE INPUT ──────────────────────────────────────────────────────────

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  // ─── EXPORT / IMPORT ─────────────────────────────────────────────────────

  function handleExport() {
    const data = JSON.stringify({ entries, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sofia-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── COMPUTED / FILTERED DATA ─────────────────────────────────────────────

  const filteredEntries = entries.filter(entry => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        entry.title?.toLowerCase().includes(q) ||
        entry.summary?.toLowerCase().includes(q) ||
        entry.raw_content?.toLowerCase().includes(q) ||
        entry.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
    if (showReviewQueue && entry.reviewed) return false;
    if (showPinnedOnly && !entry.pinned) return false;
    if (showStarredOnly && !entry.starred) return false;
    if (selectedProject && entry.project_id !== selectedProject) return false;
    return true;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    // Pinned always first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Then sort
    if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
    return 0;
  });

  // Stats
  const stats = {
    total: entries.length,
    needsReview: entries.filter(e => !e.reviewed && e.confidence < 0.7).length,
    highConfidence: entries.filter(e => e.confidence >= 0.8).length,
    reviewed: entries.filter(e => e.reviewed).length,
    activeTodos: entries.filter(e => e.template_type === 'todo' && !e.todo_completed).length,
  };

  // Category counts
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = entries.filter(e => e.category === cat).length;
    return acc;
  }, {});

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🧠</div>
          <div className="text-slate-600 font-medium">Loading Sofia...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══ HEADER ═══ */}
      <header className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧠</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Sofia</h1>
                <p className="text-xs text-indigo-300">Your Second Brain</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Model Selector */}
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:border-indigo-400"
              >
                <option value="claude" className="text-black">Claude</option>
                <option value="gpt4o" className="text-black">GPT-4o</option>
              </select>

              {/* Export */}
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <Download size={14} />
                Export
              </button>

              {/* Stats Badge */}
              <div className="flex items-center gap-2 text-sm">
                <span className="bg-indigo-500/30 px-2 py-1 rounded">{stats.total} entries</span>
                {stats.activeTodos > 0 && (
                  <span className="bg-red-500/30 px-2 py-1 rounded">{stats.activeTodos} todos</span>
                )}
                {stats.needsReview > 0 && (
                  <span className="bg-amber-500/30 px-2 py-1 rounded">{stats.needsReview} to review</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ INPUT AREA ═══ */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          {/* Template Selector Row (V2.1 NEW) */}
          <div className="flex items-center gap-3 mb-3">
            <TemplateSelector
              templates={templates}
              selected={selectedTemplate}
              onSelect={setSelectedTemplate}
            />

            {selectedTemplate !== 'freeform' && (
              <button
                onClick={() => { setSelectedTemplate('freeform'); setTemplateData({}); }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-all"
              >
                <X size={12} />
                Back to freeform
              </button>
            )}

            {/* Voice Input */}
            <button
              onClick={toggleVoice}
              className={`ml-auto p-2 rounded-lg transition-all ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>

          {/* Freeform Input (shown when freeform template selected) */}
          {selectedTemplate === 'freeform' && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Capture anything... or type #todo, #deal, #music, #shop, #deep, #book, #ghent, #food"
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
                disabled={processing}
              />
              <button
                type="submit"
                disabled={processing || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2"
              >
                {processing ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
              </button>
            </form>
          )}

          {/* Structured Template Form (V2.1 NEW — shown for non-freeform templates) */}
          {selectedTemplate !== 'freeform' && currentTemplateConfig && (
            <TemplateForm
              template={currentTemplateConfig}
              onDataChange={setTemplateData}
              onSubmit={handleTemplateSubmit}
              isProcessing={processing}
            />
          )}

          {/* Hint text */}
          {selectedTemplate === 'freeform' && (
            <div className="mt-2 text-xs text-slate-400">
              Prefixes: <code className="bg-slate-100 px-1 rounded">#dump</code> brain dump ·{' '}
              <code className="bg-slate-100 px-1 rounded">#challenge</code> devil&apos;s advocate ·{' '}
              Or pick a template above for structured input
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAIN CONTENT AREA ═══ */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="flex gap-6">

          {/* ─── LEFT SIDEBAR ─── */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {/* ★ TODO PANEL — ALWAYS ON TOP (V2.1 NEW) ★ */}
            <TodoPanel
              entries={entries}
              onToggleComplete={handleToggleTodo}
              onSelectEntry={(entry) => { setSelectedEntry(entry); setChatMode(false); setChatMessages([]); }}
            />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Toggles */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowReviewQueue(!showReviewQueue)}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                  showReviewQueue ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <AlertTriangle size={12} />
                Review ({stats.needsReview})
              </button>
              <button
                onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                  showPinnedOnly ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <Pin size={12} />
                Pinned
              </button>
              <button
                onClick={() => setShowStarredOnly(!showStarredOnly)}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                  showStarredOnly ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <Star size={12} />
                Starred
              </button>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="confidence">Highest confidence</option>
            </select>

            {/* Categories */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Categories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all ${
                    categoryFilter === 'all' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All ({entries.length})
                </button>
                {CATEGORIES.map(cat => {
                  const count = categoryCounts[cat] || 0;
                  const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.personal;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat === categoryFilter ? 'all' : cat)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all flex items-center justify-between ${
                        categoryFilter === cat ? `${colors.bg} ${colors.text} font-medium` : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {count > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          categoryFilter === cat ? colors.text : 'text-slate-400 bg-slate-100'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Projects */}
            {projects.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Projects</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedProject(null)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all ${
                      !selectedProject ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All projects
                  </button>
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProject(project.id === selectedProject ? null : project.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all flex items-center gap-2 ${
                        selectedProject === project.id ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FolderOpen size={12} />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── ENTRIES LIST (CENTER) ─── */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            <div className="text-xs text-slate-500 mb-3">
              {sortedEntries.length} {sortedEntries.length === 1 ? 'entry' : 'entries'}
              {searchQuery && ` matching "${searchQuery}"`}
              {categoryFilter !== 'all' && ` in ${categoryFilter}`}
            </div>

            {sortedEntries.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <div className="text-slate-500">No entries found</div>
                <div className="text-sm text-slate-400 mt-1">
                  {entries.length === 0
                    ? 'Capture your first thought above!'
                    : 'Try adjusting your filters'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEntries.map(entry => {
                  const colors = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.personal;
                  const isSelected = selectedEntry?.id === entry.id;
                  const templateIcon = TEMPLATE_ICONS[entry.template_type] || '✏️';
                  const isTodo = entry.template_type === 'todo';

                  return (
                    <div
                      key={entry.id}
                      onClick={() => { setSelectedEntry(entry); setChatMode(false); setChatMessages([]); }}
                      className={`bg-white rounded-xl shadow-sm border p-4 cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
                      } ${isTodo && entry.todo_completed ? 'opacity-50' : ''}`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {/* Template icon */}
                            <span className="text-sm" title={entry.template_type}>{templateIcon}</span>
                            {entry.pinned && <Pin size={12} className="text-blue-500 flex-shrink-0" />}
                            {entry.starred && <Star size={12} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                            <h3 className={`font-semibold text-slate-800 text-sm truncate ${isTodo && entry.todo_completed ? 'line-through' : ''}`}>
                              {entry.title}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{entry.summary}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100" style={{ opacity: isSelected ? 1 : undefined }}>
                          {isTodo && !entry.todo_completed && (
                            <button
                              onClick={e => { e.stopPropagation(); handleToggleTodo(entry.id, true); }}
                              className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-all"
                              title="Complete todo"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); handlePin(entry.id); }}
                            className={`p-1.5 rounded-lg transition-all ${entry.pinned ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-400'}`}
                          >
                            <Pin size={14} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleStar(entry.id); }}
                            className={`p-1.5 rounded-lg transition-all ${entry.starred ? 'bg-yellow-50 text-yellow-600' : 'hover:bg-slate-100 text-slate-400'}`}
                          >
                            <Star size={14} className={entry.starred ? 'fill-yellow-500' : ''} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Bottom row: metadata */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                          {entry.category}
                        </span>
                        {isTodo && entry.todo_priority && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.todo_priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            entry.todo_priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            entry.todo_priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.todo_priority}
                          </span>
                        )}
                        {isTodo && entry.todo_due_date && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(entry.todo_due_date).toLocaleDateString()}
                          </span>
                        )}
                        {entry.confidence != null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            entry.confidence >= 0.8 ? 'bg-green-50 text-green-600' :
                            entry.confidence >= 0.5 ? 'bg-yellow-50 text-yellow-600' :
                            'bg-red-50 text-red-600'
                          }`}>
                            {Math.round(entry.confidence * 100)}%
                          </span>
                        )}
                        {!entry.reviewed && entry.confidence < 0.7 && (
                          <button
                            onClick={e => { e.stopPropagation(); handleReview(entry.id); }}
                            className="text-xs text-amber-600 hover:text-amber-700 underline"
                          >
                            Mark reviewed
                          </button>
                        )}
                        {entry.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs text-slate-400">#{tag}</span>
                        ))}
                        <span className="text-xs text-slate-400 ml-auto">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── RIGHT DETAIL PANEL ─── */}
          <div className="w-96 flex-shrink-0">
            {selectedEntry ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden sticky top-4">
                {/* Detail Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{TEMPLATE_ICONS[selectedEntry.template_type] || '✏️'}</span>
                    <h2 className="font-bold text-lg truncate">{selectedEntry.title}</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="capitalize">{selectedEntry.category}</span>
                    <span>·</span>
                    <span>{new Date(selectedEntry.created_at).toLocaleString()}</span>
                    {selectedEntry.template_type !== 'freeform' && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{selectedEntry.template_type.replace('-', ' ')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Detail Body */}
                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Summary</h4>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedEntry.summary}</p>
                  </div>

                  {/* Template Data (V2.1 NEW) */}
                  {selectedEntry.template_data && Object.keys(selectedEntry.template_data).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Structured Data</h4>
                      <div className="space-y-1">
                        {Object.entries(selectedEntry.template_data)
                          .filter(([_, v]) => v)
                          .map(([key, value]) => (
                            <div key={key} className="flex gap-2 text-sm">
                              <span className="text-slate-500 capitalize flex-shrink-0">{key.replace(/_/g, ' ')}:</span>
                              <span className="text-slate-700">{value}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Original Input */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Original Input</h4>
                    <p className="text-sm text-slate-500 bg-slate-50 rounded p-2 whitespace-pre-wrap">{selectedEntry.raw_content}</p>
                  </div>

                  {/* Tags */}
                  {selectedEntry.tags?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedEntry.tags.map(tag => (
                          <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Research */}
                  {selectedEntry.ai_research && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">
                        <Sparkles size={12} className="inline mr-1" />
                        AI Research
                      </h4>
                      {selectedEntry.ai_research.key_findings?.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {selectedEntry.ai_research.key_findings.map((finding, i) => (
                            <p key={i} className="text-sm text-slate-600 pl-3 border-l-2 border-indigo-200">
                              {finding}
                            </p>
                          ))}
                        </div>
                      )}
                      {selectedEntry.ai_research.links?.length > 0 && (
                        <div className="space-y-1">
                          {selectedEntry.ai_research.links.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 truncate"
                            >
                              <ExternalLink size={10} />
                              {link}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Chat Mode Toggle */}
                <div className="border-t border-slate-200">
                  <button
                    onClick={() => { setChatMode(!chatMode); setChatMessages([]); }}
                    className={`w-full px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                      chatMode ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <MessageSquare size={14} />
                    {chatMode ? 'Close Chat' : 'Chat about this entry'}
                  </button>

                  {/* Chat Interface */}
                  {chatMode && (
                    <div className="border-t border-slate-200">
                      <div className="h-48 overflow-y-auto p-3 space-y-2 bg-slate-50">
                        {chatMessages.length === 0 && (
                          <div className="text-xs text-slate-400 text-center py-4">
                            Ask follow-up questions about this entry...
                          </div>
                        )}
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`text-sm p-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-indigo-100 text-indigo-800 ml-8'
                              : 'bg-white text-slate-700 mr-8 border border-slate-200'
                          }`}>
                            {msg.content}
                          </div>
                        ))}
                        {chatProcessing && (
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <RefreshCw size={10} className="animate-spin" />
                            Thinking...
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 p-3 bg-white">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                          placeholder="Ask a follow-up..."
                          className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                          disabled={chatProcessing}
                        />
                        <button
                          onClick={handleChatSend}
                          disabled={chatProcessing || !chatInput.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white p-2 rounded-lg transition-all"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center sticky top-4">
                <div className="text-4xl mb-3">👈</div>
                <div className="text-slate-500 text-sm">Select an entry to see details</div>
                <div className="text-slate-400 text-xs mt-1">
                  or capture a new thought above
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
