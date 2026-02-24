'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, Star, Pin, Trash2, MessageSquare, ChevronDown, ChevronUp,
  Mic, MicOff, Download, Upload, Clock, Filter, X, FolderOpen, Tag,
  ExternalLink, RefreshCw, Check, AlertTriangle, Sparkles, Send,
  Volume2, FileText, MoreHorizontal, Edit3, Archive, Moon, Sun, Palette
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

// ─── THEME SYSTEM ─────────────────────────────────────────────────────────────

const THEMES = {
  light: {
    name: 'Light',
    icon: '☀️',
    // Page
    pageBg: 'bg-slate-50',
    // Header
    headerBg: 'bg-gradient-to-r from-slate-900 to-indigo-900',
    headerText: 'text-white',
    headerSub: 'text-indigo-300',
    headerSelect: 'bg-white/10 text-white border-white/20',
    headerBtn: 'bg-white/10 hover:bg-white/20 text-white',
    headerBadge: 'bg-indigo-500/30',
    headerBadgeAlt: 'bg-red-500/30',
    headerBadgeWarn: 'bg-amber-500/30',
    // Input area
    inputWrap: 'bg-white border-slate-200',
    inputField: 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 bg-white text-slate-800 placeholder-slate-400',
    inputBtn: 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white',
    inputHint: 'text-slate-400',
    inputCode: 'bg-slate-100',
    // Sidebar
    sidebarCard: 'bg-white border-slate-200',
    sidebarTitle: 'text-slate-500',
    sidebarItem: 'text-slate-600 hover:bg-slate-50',
    sidebarItemActive: 'bg-indigo-100 text-indigo-700',
    sidebarCount: 'text-slate-400 bg-slate-100',
    searchBg: 'bg-white border-slate-300 text-slate-800 placeholder-slate-400',
    searchIcon: 'text-slate-400',
    filterOff: 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
    filterReview: 'bg-amber-100 text-amber-700 border-amber-300',
    filterPin: 'bg-blue-100 text-blue-700 border-blue-300',
    filterStar: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    selectBg: 'bg-white border-slate-200 text-slate-600',
    // Cards
    cardBg: 'bg-white border-slate-200 hover:shadow-md',
    cardBgSelected: 'border-indigo-400 ring-2 ring-indigo-100',
    cardTitle: 'text-slate-800',
    cardSummary: 'text-slate-500',
    cardDate: 'text-slate-400',
    cardAction: 'text-slate-400',
    cardActionHover: 'hover:bg-slate-100',
    // Detail panel
    detailHeaderBg: 'bg-gradient-to-r from-slate-800 to-slate-700',
    detailHeaderText: 'text-white',
    detailHeaderSub: 'text-slate-300',
    detailBg: 'bg-white border-slate-200',
    detailLabel: 'text-slate-500',
    detailText: 'text-slate-700',
    detailQuote: 'bg-slate-50 text-slate-500',
    detailTag: 'bg-slate-100 text-slate-600',
    detailResearch: 'border-indigo-200',
    detailLink: 'text-indigo-600',
    // Chat
    chatBg: 'bg-slate-50',
    chatToggle: 'bg-slate-50 text-slate-700 hover:bg-slate-100',
    chatToggleActive: 'bg-indigo-600 text-white',
    chatUser: 'bg-indigo-100 text-indigo-800',
    chatAssistant: 'bg-white text-slate-700 border-slate-200',
    chatInput: 'border-slate-300 focus:border-indigo-500 bg-white text-slate-800',
    chatSend: 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white',
    chatHint: 'text-slate-400',
    // Empty states
    emptyText: 'text-slate-500',
    emptySub: 'text-slate-400',
    // Confidence colors
    confHigh: 'bg-green-50 text-green-600',
    confMed: 'bg-yellow-50 text-yellow-600',
    confLow: 'bg-red-50 text-red-600',
    // Todo priority
    todoUrgent: 'bg-red-100 text-red-700',
    todoHigh: 'bg-orange-100 text-orange-700',
    todoMedium: 'bg-yellow-100 text-yellow-700',
    todoLow: 'bg-blue-100 text-blue-700',
    // Voice
    voiceOff: 'bg-slate-100 text-slate-500 hover:bg-slate-200',
    voiceOn: 'bg-red-100 text-red-600',
    // Misc
    border: 'border-slate-200',
    divider: 'border-slate-200',
    reviewLink: 'text-amber-600 hover:text-amber-700',
  },
  midnight: {
    name: 'Midnight',
    icon: '🌙',
    pageBg: 'bg-[#0f1219]',
    headerBg: 'bg-gradient-to-r from-[#161b2e] to-[#1a2540]',
    headerText: 'text-slate-100',
    headerSub: 'text-blue-400',
    headerSelect: 'bg-white/5 text-slate-200 border-white/10',
    headerBtn: 'bg-white/5 hover:bg-white/10 text-slate-200',
    headerBadge: 'bg-blue-500/20',
    headerBadgeAlt: 'bg-red-500/20',
    headerBadgeWarn: 'bg-amber-500/20',
    inputWrap: 'bg-[#181d2a] border-[#2a3040]',
    inputField: 'border-[#2a3040] focus:border-blue-500 focus:ring-blue-900/30 bg-[#12161f] text-slate-200 placeholder-slate-500',
    inputBtn: 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white',
    inputHint: 'text-slate-500',
    inputCode: 'bg-[#1e2433]',
    sidebarCard: 'bg-[#181d2a] border-[#2a3040]',
    sidebarTitle: 'text-slate-400',
    sidebarItem: 'text-slate-400 hover:bg-[#1e2433]',
    sidebarItemActive: 'bg-blue-900/30 text-blue-400',
    sidebarCount: 'text-slate-500 bg-[#1e2433]',
    searchBg: 'bg-[#12161f] border-[#2a3040] text-slate-200 placeholder-slate-500',
    searchIcon: 'text-slate-500',
    filterOff: 'bg-[#181d2a] text-slate-400 border-[#2a3040] hover:border-[#3a4560]',
    filterReview: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    filterPin: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
    filterStar: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
    selectBg: 'bg-[#12161f] border-[#2a3040] text-slate-300',
    cardBg: 'bg-[#181d2a] border-[#2a3040] hover:border-[#3a4560]',
    cardBgSelected: 'border-blue-500 ring-2 ring-blue-900/30',
    cardTitle: 'text-slate-200',
    cardSummary: 'text-slate-400',
    cardDate: 'text-slate-500',
    cardAction: 'text-slate-500',
    cardActionHover: 'hover:bg-[#1e2433]',
    detailHeaderBg: 'bg-gradient-to-r from-[#161b2e] to-[#1a2540]',
    detailHeaderText: 'text-slate-100',
    detailHeaderSub: 'text-slate-400',
    detailBg: 'bg-[#181d2a] border-[#2a3040]',
    detailLabel: 'text-slate-400',
    detailText: 'text-slate-300',
    detailQuote: 'bg-[#12161f] text-slate-400',
    detailTag: 'bg-[#1e2433] text-slate-400',
    detailResearch: 'border-blue-800/40',
    detailLink: 'text-blue-400',
    chatBg: 'bg-[#12161f]',
    chatToggle: 'bg-[#12161f] text-slate-400 hover:bg-[#1e2433]',
    chatToggleActive: 'bg-blue-600 text-white',
    chatUser: 'bg-blue-900/30 text-blue-300',
    chatAssistant: 'bg-[#1e2433] text-slate-300 border-[#2a3040]',
    chatInput: 'border-[#2a3040] focus:border-blue-500 bg-[#12161f] text-slate-200',
    chatSend: 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white',
    chatHint: 'text-slate-500',
    emptyText: 'text-slate-400',
    emptySub: 'text-slate-500',
    confHigh: 'bg-green-900/20 text-green-400',
    confMed: 'bg-yellow-900/20 text-yellow-400',
    confLow: 'bg-red-900/20 text-red-400',
    todoUrgent: 'bg-red-900/25 text-red-400',
    todoHigh: 'bg-orange-900/25 text-orange-400',
    todoMedium: 'bg-yellow-900/25 text-yellow-400',
    todoLow: 'bg-blue-900/25 text-blue-400',
    voiceOff: 'bg-[#1e2433] text-slate-400 hover:bg-[#2a3040]',
    voiceOn: 'bg-red-900/30 text-red-400',
    border: 'border-[#2a3040]',
    divider: 'border-[#2a3040]',
    reviewLink: 'text-amber-400 hover:text-amber-300',
  },
  forest: {
    name: 'Forest',
    icon: '🌲',
    pageBg: 'bg-[#0d1410]',
    headerBg: 'bg-gradient-to-r from-[#111f18] to-[#152420]',
    headerText: 'text-emerald-50',
    headerSub: 'text-emerald-400',
    headerSelect: 'bg-white/5 text-emerald-100 border-white/10',
    headerBtn: 'bg-white/5 hover:bg-white/10 text-emerald-100',
    headerBadge: 'bg-emerald-500/20',
    headerBadgeAlt: 'bg-red-500/20',
    headerBadgeWarn: 'bg-amber-500/20',
    inputWrap: 'bg-[#131f19] border-[#1e3328]',
    inputField: 'border-[#1e3328] focus:border-emerald-500 focus:ring-emerald-900/30 bg-[#0d1810] text-emerald-100 placeholder-emerald-700',
    inputBtn: 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white',
    inputHint: 'text-emerald-700',
    inputCode: 'bg-[#162820]',
    sidebarCard: 'bg-[#131f19] border-[#1e3328]',
    sidebarTitle: 'text-emerald-500',
    sidebarItem: 'text-emerald-400/70 hover:bg-[#162820]',
    sidebarItemActive: 'bg-emerald-900/30 text-emerald-400',
    sidebarCount: 'text-emerald-600 bg-[#162820]',
    searchBg: 'bg-[#0d1810] border-[#1e3328] text-emerald-100 placeholder-emerald-700',
    searchIcon: 'text-emerald-600',
    filterOff: 'bg-[#131f19] text-emerald-500 border-[#1e3328] hover:border-[#2a4a38]',
    filterReview: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    filterPin: 'bg-teal-900/20 text-teal-400 border-teal-800/30',
    filterStar: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
    selectBg: 'bg-[#0d1810] border-[#1e3328] text-emerald-300',
    cardBg: 'bg-[#131f19] border-[#1e3328] hover:border-[#2a4a38]',
    cardBgSelected: 'border-emerald-500 ring-2 ring-emerald-900/30',
    cardTitle: 'text-emerald-100',
    cardSummary: 'text-emerald-400/70',
    cardDate: 'text-emerald-600',
    cardAction: 'text-emerald-600',
    cardActionHover: 'hover:bg-[#162820]',
    detailHeaderBg: 'bg-gradient-to-r from-[#111f18] to-[#152420]',
    detailHeaderText: 'text-emerald-50',
    detailHeaderSub: 'text-emerald-400/70',
    detailBg: 'bg-[#131f19] border-[#1e3328]',
    detailLabel: 'text-emerald-500',
    detailText: 'text-emerald-200',
    detailQuote: 'bg-[#0d1810] text-emerald-400/70',
    detailTag: 'bg-[#162820] text-emerald-400',
    detailResearch: 'border-emerald-800/40',
    detailLink: 'text-emerald-400',
    chatBg: 'bg-[#0d1810]',
    chatToggle: 'bg-[#0d1810] text-emerald-400/70 hover:bg-[#162820]',
    chatToggleActive: 'bg-emerald-600 text-white',
    chatUser: 'bg-emerald-900/30 text-emerald-300',
    chatAssistant: 'bg-[#162820] text-emerald-200 border-[#1e3328]',
    chatInput: 'border-[#1e3328] focus:border-emerald-500 bg-[#0d1810] text-emerald-100',
    chatSend: 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white',
    chatHint: 'text-emerald-600',
    emptyText: 'text-emerald-400/70',
    emptySub: 'text-emerald-600',
    confHigh: 'bg-green-900/20 text-green-400',
    confMed: 'bg-yellow-900/20 text-yellow-400',
    confLow: 'bg-red-900/20 text-red-400',
    todoUrgent: 'bg-red-900/25 text-red-400',
    todoHigh: 'bg-orange-900/25 text-orange-400',
    todoMedium: 'bg-yellow-900/25 text-yellow-400',
    todoLow: 'bg-teal-900/25 text-teal-400',
    voiceOff: 'bg-[#162820] text-emerald-500 hover:bg-[#1e3328]',
    voiceOn: 'bg-red-900/30 text-red-400',
    border: 'border-[#1e3328]',
    divider: 'border-[#1e3328]',
    reviewLink: 'text-amber-400 hover:text-amber-300',
  },
  ember: {
    name: 'Ember',
    icon: '🔥',
    pageBg: 'bg-[#141210]',
    headerBg: 'bg-gradient-to-r from-[#1f1812] to-[#241c14]',
    headerText: 'text-orange-50',
    headerSub: 'text-orange-400',
    headerSelect: 'bg-white/5 text-orange-100 border-white/10',
    headerBtn: 'bg-white/5 hover:bg-white/10 text-orange-100',
    headerBadge: 'bg-orange-500/20',
    headerBadgeAlt: 'bg-red-500/20',
    headerBadgeWarn: 'bg-amber-500/20',
    inputWrap: 'bg-[#1c1814] border-[#332a20]',
    inputField: 'border-[#332a20] focus:border-orange-500 focus:ring-orange-900/30 bg-[#161310] text-orange-100 placeholder-orange-800/60',
    inputBtn: 'bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white',
    inputHint: 'text-orange-800/60',
    inputCode: 'bg-[#221c16]',
    sidebarCard: 'bg-[#1c1814] border-[#332a20]',
    sidebarTitle: 'text-orange-500/70',
    sidebarItem: 'text-orange-300/60 hover:bg-[#221c16]',
    sidebarItemActive: 'bg-orange-900/20 text-orange-400',
    sidebarCount: 'text-orange-600 bg-[#221c16]',
    searchBg: 'bg-[#161310] border-[#332a20] text-orange-100 placeholder-orange-800/60',
    searchIcon: 'text-orange-600',
    filterOff: 'bg-[#1c1814] text-orange-400/60 border-[#332a20] hover:border-[#4a3c2c]',
    filterReview: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    filterPin: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
    filterStar: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
    selectBg: 'bg-[#161310] border-[#332a20] text-orange-300',
    cardBg: 'bg-[#1c1814] border-[#332a20] hover:border-[#4a3c2c]',
    cardBgSelected: 'border-orange-500 ring-2 ring-orange-900/30',
    cardTitle: 'text-orange-100',
    cardSummary: 'text-orange-300/60',
    cardDate: 'text-orange-600',
    cardAction: 'text-orange-600',
    cardActionHover: 'hover:bg-[#221c16]',
    detailHeaderBg: 'bg-gradient-to-r from-[#1f1812] to-[#241c14]',
    detailHeaderText: 'text-orange-50',
    detailHeaderSub: 'text-orange-400/70',
    detailBg: 'bg-[#1c1814] border-[#332a20]',
    detailLabel: 'text-orange-500/70',
    detailText: 'text-orange-200',
    detailQuote: 'bg-[#161310] text-orange-300/60',
    detailTag: 'bg-[#221c16] text-orange-400',
    detailResearch: 'border-orange-800/40',
    detailLink: 'text-orange-400',
    chatBg: 'bg-[#161310]',
    chatToggle: 'bg-[#161310] text-orange-400/60 hover:bg-[#221c16]',
    chatToggleActive: 'bg-orange-600 text-white',
    chatUser: 'bg-orange-900/25 text-orange-300',
    chatAssistant: 'bg-[#221c16] text-orange-200 border-[#332a20]',
    chatInput: 'border-[#332a20] focus:border-orange-500 bg-[#161310] text-orange-100',
    chatSend: 'bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white',
    chatHint: 'text-orange-600',
    emptyText: 'text-orange-400/60',
    emptySub: 'text-orange-600',
    confHigh: 'bg-green-900/20 text-green-400',
    confMed: 'bg-yellow-900/20 text-yellow-400',
    confLow: 'bg-red-900/20 text-red-400',
    todoUrgent: 'bg-red-900/25 text-red-400',
    todoHigh: 'bg-orange-900/25 text-orange-400',
    todoMedium: 'bg-yellow-900/25 text-yellow-400',
    todoLow: 'bg-blue-900/25 text-blue-400',
    voiceOff: 'bg-[#221c16] text-orange-500 hover:bg-[#332a20]',
    voiceOn: 'bg-red-900/30 text-red-400',
    border: 'border-[#332a20]',
    divider: 'border-[#332a20]',
    reviewLink: 'text-amber-400 hover:text-amber-300',
  },
};

const CATEGORY_COLORS_BY_THEME = {
  light: {
    personal:        { bg: 'bg-slate-100',   text: 'text-slate-700' },
    health:          { bg: 'bg-green-100',   text: 'text-green-700' },
    fitness:         { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    family:          { bg: 'bg-pink-100',    text: 'text-pink-700' },
    work:            { bg: 'bg-blue-100',    text: 'text-blue-700' },
    music:           { bg: 'bg-purple-100',  text: 'text-purple-700' },
    ideas:           { bg: 'bg-amber-100',   text: 'text-amber-700' },
    ghent:           { bg: 'bg-teal-100',    text: 'text-teal-700' },
    NYC:             { bg: 'bg-orange-100',  text: 'text-orange-700' },
    'travel/food':   { bg: 'bg-red-100',     text: 'text-red-700' },
    books:           { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
    'oligarch novel':{ bg: 'bg-yellow-100',  text: 'text-yellow-700' },
  },
  midnight: {
    personal:        { bg: 'bg-slate-800/40',   text: 'text-slate-300' },
    health:          { bg: 'bg-green-900/30',   text: 'text-green-400' },
    fitness:         { bg: 'bg-emerald-900/30', text: 'text-emerald-400' },
    family:          { bg: 'bg-pink-900/30',    text: 'text-pink-400' },
    work:            { bg: 'bg-blue-900/30',    text: 'text-blue-400' },
    music:           { bg: 'bg-purple-900/30',  text: 'text-purple-400' },
    ideas:           { bg: 'bg-amber-900/30',   text: 'text-amber-400' },
    ghent:           { bg: 'bg-teal-900/30',    text: 'text-teal-400' },
    NYC:             { bg: 'bg-orange-900/30',  text: 'text-orange-400' },
    'travel/food':   { bg: 'bg-red-900/30',     text: 'text-red-400' },
    books:           { bg: 'bg-indigo-900/30',  text: 'text-indigo-400' },
    'oligarch novel':{ bg: 'bg-yellow-900/30',  text: 'text-yellow-400' },
  },
};
// Forest and Ember use same dark palette as midnight
CATEGORY_COLORS_BY_THEME.forest = CATEGORY_COLORS_BY_THEME.midnight;
CATEGORY_COLORS_BY_THEME.ember = CATEGORY_COLORS_BY_THEME.midnight;

const TEMPLATE_ICONS = {
  'freeform': '✏️', 'todo': '☑️', 'deal-concept': '⚡',
  'music-idea': '🎸', 'shopping-list': '🛒', 'deep-thought': '🧠',
  'book-note': '📚', 'ghent-project': '🏠', 'recipe-restaurant': '🍽️',
};

// ─── MAIN APP COMPONENT ──────────────────────────────────────────────────────

export default function SofiaApp() {
  // ── Core State ──
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [input, setInput] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);

  // ── Theme ──
  const [theme, setTheme] = useState('light');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const t = THEMES[theme];

  // ── Filters & Search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // ── Template State ──
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

  // ── UI ──
  const inputRef = useRef(null);

  // ─── PERSIST THEME ──────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('sofia-theme');
    if (saved && THEMES[saved]) setTheme(saved);
  }, []);

  function changeTheme(newTheme) {
    setTheme(newTheme);
    localStorage.setItem('sofia-theme', newTheme);
    setShowThemePicker(false);
  }

  // ─── DATA FETCHING ──────────────────────────────────────────────────────

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

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates?.length > 0) setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates, using defaults:', error);
    }
  }, []);

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

  useEffect(() => {
    const tmpl = templates.find(t => t.slug === selectedTemplate);
    setCurrentTemplateConfig(tmpl || null);
    setTemplateData({});
  }, [selectedTemplate, templates]);

  // ─── INPUT HANDLERS ─────────────────────────────────────────────────────

  function handleInputChange(e) {
    const value = e.target.value;
    setInput(value);
    const detected = detectTemplatePrefix(value);
    if (detected) {
      setSelectedTemplate(detected.slug);
      setInput(detected.cleanedInput);
    }
  }

  // ─── SUBMIT / PROCESS ──────────────────────────────────────────────────

  async function handleSubmit(e) {
    e?.preventDefault();
    const trimmed = input.trim();
    const hasTemplateData = Object.keys(templateData).length > 0 &&
      Object.values(templateData).some(v => v);
    if (!trimmed && !hasTemplateData) return;

    if (trimmed.startsWith('#dump ')) return handleBrainDump(trimmed.slice(6));
    if (trimmed.startsWith('#challenge ')) return handleChallenge(trimmed.slice(11));

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
        if (data.entry) setEntries(prev => [data.entry, ...prev]);
        else fetchEntries();
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

  async function handleTemplateSubmit(data) {
    setTemplateData(data);
    const contentParts = Object.entries(data).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`);
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
        if (result.entry) setEntries(prev => [result.entry, ...prev]);
        else fetchEntries();
      } else {
        alert('Processing error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Template submit error:', error);
    } finally {
      setProcessing(false);
    }
  }

  // ─── BRAIN DUMP / CHALLENGE ─────────────────────────────────────────────

  async function handleBrainDump(content) {
    setProcessing(true);
    try {
      const res = await fetch('/api/process/dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, model: selectedModel }),
      });
      const data = await res.json();
      if (data.success) { setInput(''); fetchEntries(); }
    } catch (error) { console.error('Brain dump error:', error); }
    finally { setProcessing(false); }
  }

  async function handleChallenge(content) {
    setProcessing(true);
    try {
      const res = await fetch('/api/process/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, model: selectedModel }),
      });
      const data = await res.json();
      if (data.success) { setInput(''); fetchEntries(); }
    } catch (error) { console.error('Challenge error:', error); }
    finally { setProcessing(false); }
  }

  // ─── TODO TOGGLE ────────────────────────────────────────────────────────

  async function handleToggleTodo(id, completed) {
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
      fetchEntries();
    }
  }

  // ─── ENTRY ACTIONS ──────────────────────────────────────────────────────

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

  // ─── CHAT MODE ──────────────────────────────────────────────────────────

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
          context: {
            title: selectedEntry.title,
            summary: selectedEntry.summary,
            category: selectedEntry.category,
            raw_content: selectedEntry.raw_content,
          },
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (data.response) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (data.error || 'no response') }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error: could not get response.' }]);
    } finally {
      setChatProcessing(false);
    }
  }

  // ─── VOICE INPUT ────────────────────────────────────────────────────────

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

  // ─── EXPORT ─────────────────────────────────────────────────────────────

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

  // ─── COMPUTED DATA ──────────────────────────────────────────────────────

  const filteredEntries = entries.filter(entry => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = entry.title?.toLowerCase().includes(q) ||
        entry.summary?.toLowerCase().includes(q) ||
        entry.raw_content?.toLowerCase().includes(q) ||
        entry.tags?.some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
    if (showReviewQueue && entry.reviewed) return false;
    if (showPinnedOnly && !entry.pinned) return false;
    if (showStarredOnly && !entry.starred) return false;
    if (selectedProject && entry.project_id !== selectedProject) return false;
    return true;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
    return 0;
  });

  const stats = {
    total: entries.length,
    needsReview: entries.filter(e => !e.reviewed && e.confidence < 0.7).length,
    activeTodos: entries.filter(e => e.template_type === 'todo' && !e.todo_completed).length,
  };

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = entries.filter(e => e.category === cat).length;
    return acc;
  }, {});

  const catColors = CATEGORY_COLORS_BY_THEME[theme] || CATEGORY_COLORS_BY_THEME.light;

  // ─── RENDER ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`min-h-screen ${t.pageBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🧠</div>
          <div className={`${t.emptyText} font-medium`}>Loading Sofia...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.pageBg}`}>
      {/* ═══ HEADER ═══ */}
      <header className={`${t.headerBg} shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧠</span>
              <div>
                <h1 className={`text-xl font-bold tracking-tight ${t.headerText}`}>Sofia</h1>
                <p className={`text-xs ${t.headerSub}`}>Your Second Brain</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all ${t.headerBtn}`}
                  title="Change theme"
                >
                  <Palette size={14} />
                  {THEMES[theme].icon}
                </button>
                {showThemePicker && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[160px]">
                    {Object.entries(THEMES).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => changeTheme(key)}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-all ${
                          theme === key ? 'font-semibold text-indigo-600' : 'text-slate-700'
                        }`}
                      >
                        <span>{val.icon}</span>
                        <span>{val.name}</span>
                        {theme === key && <Check size={14} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model Selector */}
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className={`text-sm px-3 py-1.5 rounded-lg border focus:outline-none ${t.headerSelect}`}
              >
                <option value="claude" className="text-black">Claude</option>
                <option value="gpt4o" className="text-black">GPT-4o</option>
              </select>

              {/* Export */}
              <button onClick={handleExport} className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all ${t.headerBtn}`}>
                <Download size={14} /> Export
              </button>

              {/* Stats */}
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-1 rounded ${t.headerBadge} ${t.headerText}`}>{stats.total} entries</span>
                {stats.activeTodos > 0 && (
                  <span className={`px-2 py-1 rounded ${t.headerBadgeAlt} ${t.headerText}`}>{stats.activeTodos} todos</span>
                )}
                {stats.needsReview > 0 && (
                  <span className={`px-2 py-1 rounded ${t.headerBadgeWarn} ${t.headerText}`}>{stats.needsReview} to review</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ INPUT AREA ═══ */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className={`rounded-xl shadow-sm border p-4 ${t.inputWrap}`}>
          <div className="flex items-center gap-3 mb-3">
            <TemplateSelector templates={templates} selected={selectedTemplate} onSelect={setSelectedTemplate} />
            {selectedTemplate !== 'freeform' && (
              <button onClick={() => { setSelectedTemplate('freeform'); setTemplateData({}); }}
                className={`text-xs flex items-center gap-1 transition-all ${t.inputHint} hover:opacity-80`}>
                <X size={12} /> Back to freeform
              </button>
            )}
            <button onClick={toggleVoice}
              className={`ml-auto p-2 rounded-lg transition-all ${isListening ? `${t.voiceOn} animate-pulse` : t.voiceOff}`}>
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>

          {selectedTemplate === 'freeform' && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input ref={inputRef} type="text" value={input} onChange={handleInputChange}
                placeholder="Capture anything... or type #todo, #deal, #music, #shop, #deep, #book, #ghent, #food"
                className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all text-sm ${t.inputField}`}
                disabled={processing} />
              <button type="submit" disabled={processing || !input.trim()}
                className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${t.inputBtn}`}>
                {processing ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
              </button>
            </form>
          )}

          {selectedTemplate !== 'freeform' && currentTemplateConfig && (
            <TemplateForm template={currentTemplateConfig} onDataChange={setTemplateData} onSubmit={handleTemplateSubmit} isProcessing={processing} />
          )}

          {selectedTemplate === 'freeform' && (
            <div className={`mt-2 text-xs ${t.inputHint}`}>
              Prefixes: <code className={`px-1 rounded ${t.inputCode}`}>#dump</code> brain dump ·{' '}
              <code className={`px-1 rounded ${t.inputCode}`}>#challenge</code> devil&apos;s advocate ·{' '}
              Or pick a template above
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="flex gap-6">

          {/* ─── LEFT SIDEBAR ─── */}
          <div className="w-72 flex-shrink-0 space-y-4">
            <TodoPanel entries={entries} onToggleComplete={handleToggleTodo}
              onSelectEntry={(entry) => { setSelectedEntry(entry); setChatMode(false); setChatMessages([]); }} />

            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.searchIcon}`} size={16} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none ${t.searchBg}`} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className={`absolute right-2 top-1/2 -translate-y-1/2 ${t.searchIcon} hover:opacity-80`}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter toggles */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowReviewQueue(!showReviewQueue)}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 border transition-all ${showReviewQueue ? t.filterReview : t.filterOff}`}>
                <AlertTriangle size={12} /> Review ({stats.needsReview})
              </button>
              <button onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 border transition-all ${showPinnedOnly ? t.filterPin : t.filterOff}`}>
                <Pin size={12} /> Pinned
              </button>
              <button onClick={() => setShowStarredOnly(!showStarredOnly)}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 border transition-all ${showStarredOnly ? t.filterStar : t.filterOff}`}>
                <Star size={12} /> Starred
              </button>
            </div>

            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none ${t.selectBg}`}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="confidence">Highest confidence</option>
            </select>

            {/* Categories */}
            <div className={`rounded-lg shadow-sm border p-3 ${t.sidebarCard}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${t.sidebarTitle}`}>Categories</h3>
              <div className="space-y-1">
                <button onClick={() => setCategoryFilter('all')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all ${categoryFilter === 'all' ? t.sidebarItemActive : t.sidebarItem}`}>
                  All ({entries.length})
                </button>
                {CATEGORIES.map(cat => {
                  const count = categoryCounts[cat] || 0;
                  const cc = catColors[cat] || catColors.personal;
                  return (
                    <button key={cat} onClick={() => setCategoryFilter(cat === categoryFilter ? 'all' : cat)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all flex items-center justify-between ${
                        categoryFilter === cat ? `${cc.bg} ${cc.text} font-medium` : t.sidebarItem
                      }`}>
                      <span className="truncate">{cat}</span>
                      {count > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${categoryFilter === cat ? cc.text : t.sidebarCount}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Projects */}
            {projects.length > 0 && (
              <div className={`rounded-lg shadow-sm border p-3 ${t.sidebarCard}`}>
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${t.sidebarTitle}`}>Projects</h3>
                <div className="space-y-1">
                  <button onClick={() => setSelectedProject(null)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all ${!selectedProject ? t.sidebarItemActive : t.sidebarItem}`}>
                    All projects
                  </button>
                  {projects.map(project => (
                    <button key={project.id} onClick={() => setSelectedProject(project.id === selectedProject ? null : project.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-all flex items-center gap-2 ${
                        selectedProject === project.id ? t.sidebarItemActive : t.sidebarItem
                      }`}>
                      <FolderOpen size={12} />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── ENTRIES LIST ─── */}
          <div className="flex-1 min-w-0">
            <div className={`text-xs mb-3 ${t.cardDate}`}>
              {sortedEntries.length} {sortedEntries.length === 1 ? 'entry' : 'entries'}
              {searchQuery && ` matching "${searchQuery}"`}
              {categoryFilter !== 'all' && ` in ${categoryFilter}`}
            </div>

            {sortedEntries.length === 0 ? (
              <div className={`rounded-xl shadow-sm border p-12 text-center ${t.cardBg}`}>
                <div className="text-4xl mb-3">📭</div>
                <div className={t.emptyText}>No entries found</div>
                <div className={`text-sm mt-1 ${t.emptySub}`}>
                  {entries.length === 0 ? 'Capture your first thought above!' : 'Try adjusting your filters'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEntries.map(entry => {
                  const cc = catColors[entry.category] || catColors.personal;
                  const isSelected = selectedEntry?.id === entry.id;
                  const templateIcon = TEMPLATE_ICONS[entry.template_type] || '✏️';
                  const isTodo = entry.template_type === 'todo';

                  return (
                    <div key={entry.id}
                      onClick={() => { setSelectedEntry(entry); setChatMode(false); setChatMessages([]); }}
                      className={`rounded-xl shadow-sm border p-4 cursor-pointer transition-all ${t.cardBg} ${
                        isSelected ? t.cardBgSelected : ''
                      } ${isTodo && entry.todo_completed ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm" title={entry.template_type}>{templateIcon}</span>
                            {entry.pinned && <Pin size={12} className="text-blue-500 flex-shrink-0" />}
                            {entry.starred && <Star size={12} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                            <h3 className={`font-semibold text-sm truncate ${t.cardTitle} ${isTodo && entry.todo_completed ? 'line-through' : ''}`}>
                              {entry.title}
                            </h3>
                          </div>
                          <p className={`text-xs line-clamp-2 ${t.cardSummary}`}>{entry.summary}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" style={{ opacity: isSelected ? 1 : 0.4 }}>
                          {isTodo && !entry.todo_completed && (
                            <button onClick={e => { e.stopPropagation(); handleToggleTodo(entry.id, true); }}
                              className={`p-1.5 rounded-lg ${t.cardAction} hover:text-green-500 ${t.cardActionHover} transition-all`} title="Complete todo">
                              <Check size={14} />
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); handlePin(entry.id); }}
                            className={`p-1.5 rounded-lg transition-all ${entry.pinned ? 'text-blue-500' : `${t.cardAction} ${t.cardActionHover}`}`}>
                            <Pin size={14} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleStar(entry.id); }}
                            className={`p-1.5 rounded-lg transition-all ${entry.starred ? 'text-yellow-500' : `${t.cardAction} ${t.cardActionHover}`}`}>
                            <Star size={14} className={entry.starred ? 'fill-yellow-500' : ''} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                            className={`p-1.5 rounded-lg ${t.cardAction} hover:text-red-500 ${t.cardActionHover} transition-all`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cc.bg} ${cc.text}`}>{entry.category}</span>
                        {isTodo && entry.todo_priority && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.todo_priority === 'urgent' ? t.todoUrgent :
                            entry.todo_priority === 'high' ? t.todoHigh :
                            entry.todo_priority === 'medium' ? t.todoMedium : t.todoLow
                          }`}>{entry.todo_priority}</span>
                        )}
                        {isTodo && entry.todo_due_date && (
                          <span className={`text-xs flex items-center gap-1 ${t.cardDate}`}>
                            <Clock size={10} /> {new Date(entry.todo_due_date).toLocaleDateString()}
                          </span>
                        )}
                        {entry.confidence != null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            entry.confidence >= 0.8 ? t.confHigh :
                            entry.confidence >= 0.5 ? t.confMed : t.confLow
                          }`}>{Math.round(entry.confidence * 100)}%</span>
                        )}
                        {!entry.reviewed && entry.confidence < 0.7 && (
                          <button onClick={e => { e.stopPropagation(); handleReview(entry.id); }}
                            className={`text-xs underline ${t.reviewLink}`}>Mark reviewed</button>
                        )}
                        {entry.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className={`text-xs ${t.cardDate}`}>#{tag}</span>
                        ))}
                        <span className={`text-xs ml-auto ${t.cardDate}`}>{new Date(entry.created_at).toLocaleDateString()}</span>
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
              <div className={`rounded-xl shadow-sm border overflow-hidden sticky top-4 ${t.detailBg}`}>
                <div className={`p-4 ${t.detailHeaderBg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{TEMPLATE_ICONS[selectedEntry.template_type] || '✏️'}</span>
                    <h2 className={`font-bold text-lg truncate ${t.detailHeaderText}`}>{selectedEntry.title}</h2>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${t.detailHeaderSub}`}>
                    <span className="capitalize">{selectedEntry.category}</span>
                    <span>·</span>
                    <span>{new Date(selectedEntry.created_at).toLocaleString()}</span>
                    {selectedEntry.template_type !== 'freeform' && (
                      <><span>·</span><span className="capitalize">{selectedEntry.template_type.replace('-', ' ')}</span></>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div>
                    <h4 className={`text-xs font-semibold uppercase mb-1 ${t.detailLabel}`}>Summary</h4>
                    <p className={`text-sm whitespace-pre-wrap ${t.detailText}`}>{selectedEntry.summary}</p>
                  </div>

                  {selectedEntry.template_data && Object.keys(selectedEntry.template_data).length > 0 && (
                    <div>
                      <h4 className={`text-xs font-semibold uppercase mb-1 ${t.detailLabel}`}>Structured Data</h4>
                      <div className="space-y-1">
                        {Object.entries(selectedEntry.template_data).filter(([_, v]) => v).map(([key, value]) => (
                          <div key={key} className="flex gap-2 text-sm">
                            <span className={`capitalize flex-shrink-0 ${t.detailLabel}`}>{key.replace(/_/g, ' ')}:</span>
                            <span className={t.detailText}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className={`text-xs font-semibold uppercase mb-1 ${t.detailLabel}`}>Original Input</h4>
                    <p className={`text-sm rounded p-2 whitespace-pre-wrap ${t.detailQuote}`}>{selectedEntry.raw_content}</p>
                  </div>

                  {selectedEntry.tags?.length > 0 && (
                    <div>
                      <h4 className={`text-xs font-semibold uppercase mb-1 ${t.detailLabel}`}>Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedEntry.tags.map(tag => (
                          <span key={tag} className={`text-xs px-2 py-0.5 rounded ${t.detailTag}`}>#{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedEntry.ai_research && (
                    <div>
                      <h4 className={`text-xs font-semibold uppercase mb-1 ${t.detailLabel}`}>
                        <Sparkles size={12} className="inline mr-1" /> AI Research
                      </h4>
                      {selectedEntry.ai_research.key_findings?.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {selectedEntry.ai_research.key_findings.map((finding, i) => (
                            <p key={i} className={`text-sm pl-3 border-l-2 ${t.detailResearch} ${t.detailText}`}>{finding}</p>
                          ))}
                        </div>
                      )}
                      {selectedEntry.ai_research.links?.length > 0 && (
                        <div className="space-y-1">
                          {selectedEntry.ai_research.links.map((link, i) => (
                            <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                              className={`text-xs hover:underline flex items-center gap-1 truncate ${t.detailLink}`}>
                              <ExternalLink size={10} /> {link}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Chat Mode */}
                <div className={`border-t ${t.divider}`}>
                  <button onClick={() => { setChatMode(!chatMode); setChatMessages([]); }}
                    className={`w-full px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                      chatMode ? t.chatToggleActive : t.chatToggle
                    }`}>
                    <MessageSquare size={14} /> {chatMode ? 'Close Chat' : 'Chat about this entry'}
                  </button>

                  {chatMode && (
                    <div className={`border-t ${t.divider}`}>
                      <div className={`h-48 overflow-y-auto p-3 space-y-2 ${t.chatBg}`}>
                        {chatMessages.length === 0 && (
                          <div className={`text-xs text-center py-4 ${t.chatHint}`}>Ask follow-up questions about this entry...</div>
                        )}
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`text-sm p-2 rounded-lg ${
                            msg.role === 'user' ? `${t.chatUser} ml-8` : `${t.chatAssistant} mr-8 border`
                          }`}>{msg.content}</div>
                        ))}
                        {chatProcessing && (
                          <div className={`text-xs flex items-center gap-1 ${t.chatHint}`}>
                            <RefreshCw size={10} className="animate-spin" /> Thinking...
                          </div>
                        )}
                      </div>
                      <div className={`flex gap-2 p-3 ${t.inputWrap}`}>
                        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                          placeholder="Ask a follow-up..."
                          className={`flex-1 text-sm px-3 py-2 border rounded-lg focus:outline-none ${t.chatInput}`}
                          disabled={chatProcessing} />
                        <button onClick={handleChatSend} disabled={chatProcessing || !chatInput.trim()}
                          className={`p-2 rounded-lg transition-all ${t.chatSend}`}>
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`rounded-xl shadow-sm border p-8 text-center sticky top-4 ${t.cardBg}`}>
                <div className="text-4xl mb-3">👈</div>
                <div className={`text-sm ${t.emptyText}`}>Select an entry to see details</div>
                <div className={`text-xs mt-1 ${t.emptySub}`}>or capture a new thought above</div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Click-away for theme picker */}
      {showThemePicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
      )}
    </div>
  );
}
