// src/admin/content/ImagePreview.jsx
// Member-supplied images, shown only when an admin asks for them.
//
// An <img> pointing at a member-supplied URL is a request the console makes to
// whatever host that URL names: it hands over the admin's IP and tells that
// host exactly when a moderator looked. Auto-loading every thumbnail in a list
// turns the moderation queue into a notification service for anyone who can
// post a link. So nothing loads until someone clicks, the URL is shown first
// in plain text, and the referrer is withheld when it does load.

import { useState } from 'react';
import { C, actionBtn, plainPreview } from './ui';

export default function ImagePreview({ url, label = 'image', maxHeight = 320 }) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const clean = String(url || '').trim();

  if (!clean) {
    return <span style={{ color: C.textFaint, fontSize: 12.5 }}>none</span>;
  }

  return (
    <div>
      <div style={{
        fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: C.textMuted,
        wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 8,
      }}>
        {plainPreview(clean, 160)}
      </div>

      {!shown ? (
        <>
          <button type="button" onClick={() => { setShown(true); setFailed(false); }} style={actionBtn(C.accentHi)}>
            Load {label}
          </button>
          <div style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.6, marginTop: 6 }}>
            Not loaded yet. Loading it fetches the file from wherever it is hosted, which tells that host
            a moderator opened this item.
          </div>
        </>
      ) : failed ? (
        <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
          That image could not be loaded — the link may be dead or blocked.{' '}
          <button type="button" onClick={() => { setFailed(false); setShown(false); }} style={{ ...actionBtn(C.textMuted), marginTop: 6 }}>
            Reset
          </button>
        </div>
      ) : (
        <>
          <img
            src={clean}
            alt={`Member-supplied ${label}`}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            style={{
              maxWidth: '100%', maxHeight, borderRadius: 10,
              border: `1px solid ${C.border}`, display: 'block', objectFit: 'contain',
            }}
          />
          <button type="button" onClick={() => setShown(false)} style={{ ...actionBtn(C.textMuted), marginTop: 8 }}>
            Hide {label}
          </button>
        </>
      )}
    </div>
  );
}
