// src/admin/content/DuplicateGroups.jsx
// Surfaces likely-duplicate venues. It cannot fix them: there is no merge
// endpoint on the server, and this panel does not invent one. What it can do is
// name the rows precisely enough that a person can merge them by hand and know
// which one to keep (the one holding the visits and the stories).

import { useState } from 'react';
import { C, Card, Badge, actionBtn, thStyle, tdStyle, fmtDate, fmtCount, plainPreview } from './ui';
import { duplicateNote } from './duplicates';

function Group({ group, canEdit, onOpen }) {
  const [copied, setCopied]   = useState(false);
  const [showNote, setShowNote] = useState(false);
  const note = duplicateNote(group);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (no permission, insecure context) — show the text
      // instead of failing silently.
      setShowNote(true);
    }
  };

  const keeper = group.places.reduce(
    (best, p) => ((Number(p.visit_count) || 0) + (Number(p.story_count) || 0)) >
                 ((Number(best.visit_count) || 0) + (Number(best.story_count) || 0)) ? p : best,
    group.places[0]
  );

  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{plainPreview(group.label, 60)}</span>
        <span style={{ color: C.textFaint, fontSize: 12 }}>
          {group.city ? plainPreview(group.city, 40) : 'city not set'}
        </span>
        <Badge label={`${group.places.length} rows`} color={C.amber} bg={C.amber + '22'} />
        <Badge
          label={group.confidence === 'likely' ? 'Likely duplicate' : 'Possible duplicate'}
          color={group.confidence === 'likely' ? C.red : C.textMuted}
          bg={group.confidence === 'likely' ? C.red + '22' : C.border}
        />
        {group.mixedCountry && (
          <Badge label={`Different countries: ${group.countries.join(', ')}`} color={C.purple} bg={C.purple + '22'} />
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['ID', 'Name as stored', 'City', 'Country', 'Visits', 'Stories', 'Added by', 'Added', ''].map((h, i) => (
                <th key={h + i} scope="col" style={{ ...thStyle, padding: '8px 12px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.places.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ ...tdStyle, padding: '8px 12px', color: C.textFaint }}>#{p.id}</td>
                <td style={{ ...tdStyle, padding: '8px 12px' }}>
                  {plainPreview(p.name, 48) || <span style={{ color: C.textFaint }}>(unnamed)</span>}
                  {p.id === keeper?.id && group.places.length > 1 && (
                    <span style={{ marginLeft: 8 }}><Badge label="most activity" color={C.green} bg={C.green + '22'} /></span>
                  )}
                </td>
                <td style={{ ...tdStyle, padding: '8px 12px', color: C.textMuted }}>{p.city || '—'}</td>
                <td style={{ ...tdStyle, padding: '8px 12px', color: C.textMuted }}>{p.country || '—'}</td>
                <td style={{ ...tdStyle, padding: '8px 12px' }}>{fmtCount(p.visit_count)}</td>
                <td style={{ ...tdStyle, padding: '8px 12px' }}>{fmtCount(p.story_count)}</td>
                <td style={{ ...tdStyle, padding: '8px 12px', color: C.textFaint }}>
                  {p.created_by != null ? `User #${p.created_by}` : '—'}
                </td>
                <td style={{ ...tdStyle, padding: '8px 12px', color: C.textFaint, whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                <td style={{ ...tdStyle, padding: '8px 12px' }}>
                  <button type="button" onClick={() => onOpen(p.id)} style={actionBtn(C.accentHi)}>Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.6, flex: 1, minWidth: 220 }}>
          {canEdit
            ? 'Merging is manual — the API has no merge endpoint, so nothing here can do it for you. Copy these details into the handover so visits and stories are not stranded on the row that gets dropped.'
            : 'Merging is manual, happens outside this console, and is a places.edit job your role does not hold. Copy the details and pass the ids to someone who does.'}
        </div>
        {/* Copying is not a server action and reveals nothing that is not
            already on screen, so it is offered whatever the role — the note
            above says who can act on it. */}
        <button type="button" onClick={copy} style={actionBtn(copied ? C.green : C.textMuted)}>
          {copied ? '✓ Copied' : 'Copy details'}
        </button>
      </div>

      {showNote && (
        <div style={{ marginTop: 10 }}>
          <label htmlFor={`note-${group.key}`} style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>
            Copy this by hand — the clipboard was not available.
          </label>
          <textarea
            id={`note-${group.key}`}
            readOnly
            value={note}
            rows={Math.min(10, group.places.length + 3)}
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '10px 12px', color: C.textMuted, fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace',
              boxSizing: 'border-box', resize: 'vertical',
            }}
          />
        </div>
      )}
    </Card>
  );
}

export default function DuplicateGroups({ groups, canEdit, onOpen }) {
  if (!groups || groups.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map((g) => (
        <Group key={g.key} group={g} canEdit={canEdit} onOpen={onOpen} />
      ))}
    </div>
  );
}
