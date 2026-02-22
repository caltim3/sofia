// components/TemplateForm.jsx
// Sofia V2.1 — Dynamic form that renders structured fields for each template

'use client';
import { useState, useEffect } from 'react';

export default function TemplateForm({ template, onDataChange, onSubmit, isProcessing }) {
  const [formData, setFormData] = useState({});
  const fields = template?.fields ? (typeof template.fields === 'string' ? JSON.parse(template.fields) : template.fields) : [];

  // Reset form when template changes
  useEffect(() => {
    const defaults = {};
    fields.forEach(field => {
      if (field.default) defaults[field.key] = field.default;
    });
    setFormData(defaults);
    onDataChange(defaults);
  }, [template?.slug]);

  function handleChange(key, value) {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    onDataChange(updated);
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Validate required fields
    const missing = fields.filter(f => f.required && !formData[f.key]);
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    onSubmit(formData);
  }

  if (!fields || fields.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(field => (
          <div
            key={field.key}
            className={`${field.type === 'textarea' ? 'md:col-span-2' : ''}`}
          >
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>

            {field.type === 'text' && (
              <input
                type="text"
                value={formData[field.key] || ''}
                onChange={e => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all"
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                value={formData[field.key] || ''}
                onChange={e => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all resize-y"
              />
            )}

            {field.type === 'select' && (
              <select
                value={formData[field.key] || field.default || ''}
                onChange={e => handleChange(field.key, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 bg-white transition-all"
              >
                <option value="">Select...</option>
                {(field.options || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === 'date' && (
              <input
                type="date"
                value={formData[field.key] || ''}
                onChange={e => handleChange(field.key, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 transition-all"
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <span className="animate-spin">⏳</span>
            Processing...
          </>
        ) : (
          <>
            <span>{template?.icon || '✏️'}</span>
            Capture {template?.name || 'Entry'}
          </>
        )}
      </button>
    </form>
  );
}
