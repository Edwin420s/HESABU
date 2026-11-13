import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, action, helpText }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="page-header">
      <div>
        <div className="flex items-center gap-2">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {helpText && (
            <button
              type="button"
              className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 mb-1.5 transition cursor-pointer"
              onClick={() => setShowHelp(!showHelp)}
            >
              <HelpCircle size={11} />
              <span>{showHelp ? 'Hide guide' : 'What is this?'}</span>
            </button>
          )}
        </div>
        <h1>{title}</h1>
        {description && <p className="subtle">{description}</p>}
        {showHelp && helpText && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900 mt-2.5 leading-relaxed">
            💡 {helpText}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
