// components/TodoPanel.jsx
// Sofia V2.1 — Todo Priority Panel
// This sits at the VERY TOP of the left sidebar, above categories

'use client';
import { useState, useEffect } from 'react';
import { Check, Clock, ChevronDown, ChevronUp, AlertTriangle, Circle } from 'lucide-react';

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', icon: '🔴', bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-800', badge: 'bg-red-500 text-white' },
  high:   { label: 'High',   icon: '🟠', bg: 'bg-orange-50', border: 'border-l-orange-400', text: 'text-orange-800', badge: 'bg-orange-400 text-white' },
  medium: { label: 'Medium', icon: '🟡', bg: 'bg-yellow-50', border: 'border-l-yellow-400', text: 'text-yellow-800', badge: 'bg-yellow-500 text-white' },
  low:    { label: 'Low',    icon: '🔵', bg: 'bg-blue-50', border: 'border-l-blue-400', text: 'text-blue-800', badge: 'bg-blue-400 text-white' },
};

export default function TodoPanel({ entries, onToggleComplete, onSelectEntry }) {
  const [expanded, setExpanded] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Filter and sort todos
  const allTodos = (entries || []).filter(e => e.template_type === 'todo');
  const activeTodos = allTodos.filter(e => !e.todo_completed);
  const completedTodos = allTodos.filter(e => e.todo_completed);

  // Sort: urgent first, then high, medium, low. Within same priority, earliest due date first.
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedActive = [...activeTodos].sort((a, b) => {
    const pA = priorityOrder[a.todo_priority] ?? 3;
    const pB = priorityOrder[b.todo_priority] ?? 3;
    if (pA !== pB) return pA - pB;
    // Then by due date (nulls last)
    if (a.todo_due_date && b.todo_due_date) return new Date(a.todo_due_date) - new Date(b.todo_due_date);
    if (a.todo_due_date) return -1;
    if (b.todo_due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const urgentCount = activeTodos.filter(t => t.todo_priority === 'urgent').length;
  const overdueCount = activeTodos.filter(t => {
    if (!t.todo_due_date) return false;
    return new Date(t.todo_due_date) < new Date(new Date().toDateString());
  }).length;

  function formatDueDate(dateStr) {
    if (!dateStr) return null;
    const due = new Date(dateStr);
    const today = new Date(new Date().toDateString());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, className: 'text-red-600 font-semibold' };
    if (diff === 0) return { label: 'Today', className: 'text-orange-600 font-semibold' };
    if (diff === 1) return { label: 'Tomorrow', className: 'text-yellow-600' };
    if (diff <= 7) return { label: `${diff}d`, className: 'text-slate-600' };
    return { label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), className: 'text-slate-500' };
  }

  if (allTodos.length === 0) return null; // Don't render if no todos

  return (
    <div className="mb-4 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white hover:from-slate-700 hover:to-slate-600 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">☑️</span>
          <span className="font-semibold text-sm tracking-wide">TODOS</span>
          <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
            {activeTodos.length} active
          </span>
          {urgentCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {urgentCount} urgent
            </span>
          )}
          {overdueCount > 0 && (
            <span className="bg-red-700 text-white text-xs px-2 py-0.5 rounded-full">
              {overdueCount} overdue
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {sortedActive.length === 0 && (
            <div className="px-4 py-6 text-center text-slate-400 text-sm">
              All clear! No active todos.
            </div>
          )}

          {sortedActive.map(todo => {
            const priority = PRIORITY_CONFIG[todo.todo_priority] || PRIORITY_CONFIG.medium;
            const dueInfo = formatDueDate(todo.todo_due_date);

            return (
              <div
                key={todo.id}
                className={`flex items-start gap-3 px-4 py-3 ${priority.bg} border-l-4 ${priority.border} hover:brightness-95 transition-all group`}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleComplete(todo.id, true); }}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-slate-400 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-all flex-shrink-0"
                >
                  <Check size={12} className="text-transparent group-hover:text-green-500" />
                </button>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectEntry(todo)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{priority.icon}</span>
                    <span className={`text-sm font-medium ${priority.text} truncate`}>
                      {todo.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${priority.badge}`}>
                      {priority.label}
                    </span>
                    {todo.category && (
                      <span className="text-xs text-slate-500">{todo.category}</span>
                    )}
                    {dueInfo && (
                      <span className={`text-xs flex items-center gap-1 ${dueInfo.className}`}>
                        <Clock size={10} />
                        {dueInfo.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Completed toggle */}
          {completedTodos.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-all"
              >
                {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {completedTodos.length} completed
              </button>

              {showCompleted && completedTodos.map(todo => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 opacity-60 hover:opacity-80 transition-all"
                >
                  <button
                    onClick={() => onToggleComplete(todo.id, false)}
                    className="w-5 h-5 rounded bg-green-500 flex items-center justify-center flex-shrink-0"
                  >
                    <Check size={12} className="text-white" />
                  </button>
                  <span className="text-sm text-slate-500 line-through truncate">{todo.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
