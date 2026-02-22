// components/TemplateSelector.jsx
// Sofia V2.1 — Template picker for the input area

'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

export default function TemplateSelector({ templates, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = templates.find(t => t.slug === selected) || templates[0];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all text-sm"
      >
        <span className="text-lg">{current.icon}</span>
        <span className="font-medium text-slate-700">{current.name}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
              Choose a template
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {templates.map(tmpl => (
              <button
                key={tmpl.slug}
                onClick={() => { onSelect(tmpl.slug); setOpen(false); }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  selected === tmpl.slug
                    ? 'bg-indigo-50 border border-indigo-200'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span className="text-xl mt-0.5">{tmpl.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800">{tmpl.name}</div>
                  <div className="text-xs text-slate-500 truncate">{tmpl.description}</div>
                </div>
                {selected === tmpl.slug && (
                  <span className="text-indigo-500 text-xs font-semibold mt-1">Active</span>
                )}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <div className="text-xs text-slate-400 px-2">
              Tip: Type <code className="bg-slate-200 px-1 rounded">#todo</code>, <code className="bg-slate-200 px-1 rounded">#deal</code>, <code className="bg-slate-200 px-1 rounded">#music</code> etc. to auto-select
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
