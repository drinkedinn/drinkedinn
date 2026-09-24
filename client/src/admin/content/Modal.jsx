// src/admin/content/Modal.jsx
// Dialog shell: labelled, escapable, focus-trapped, and it gives focus back to
// whatever opened it. Used for the post/place detail views and as the base for
// the removal confirmation.

import { useEffect, useRef } from 'react';
import { C } from './ui';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, subtitle, onClose, children, footer, width = 680, dismissOnBackdrop = true }) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const titleId = useRef('modal-title-' + Math.random().toString(36).slice(2, 9)).current;

  useEffect(() => {
    returnFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    const node = panelRef.current;
    if (node) {
      const first = node.querySelector(FOCUSABLE);
      (first || node).focus?.();
    }
    return () => {
      try { returnFocusRef.current?.focus?.(); } catch { /* element may be gone */ }
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const node = panelRef.current;
    if (!node) return;
    // Not offsetParent: everything in here sits inside a position:fixed
    // overlay, where that check is unreliable.
    const items = Array.from(node.querySelectorAll(FOCUSABLE))
      .filter((el) => !el.disabled && !el.hasAttribute('hidden'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      onMouseDown={(e) => { if (dismissOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,10,15,0.72)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '48px 20px', overflowY: 'auto',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', maxWidth: width, background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', outline: 'none',
          fontFamily: "'Inter', 'SF Pro Display', sans-serif",
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>{title}</h2>
            {subtitle && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 18, padding: 4, lineHeight: 1, fontFamily: 'inherit' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>{children}</div>

        {footer && (
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
