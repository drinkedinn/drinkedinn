// client/src/admin/command/AuditRow.jsx
// One audit entry: the summary row, plus the expanded panel showing the
// scrubbed request body exactly as adminAuth.safeBody() recorded it.

import { C, MONO, clockTime, shortDate, fullStamp } from './theme';
import { Badge } from './ui';

const VERBS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

const VERB_COLOUR = {
  DELETE: C.red,
  PUT: C.amber,
  PATCH: C.amber,
  POST: C.accentHi,
};

/** Split "DELETE /api/admin/users/:id" into its verb and path. */
export function splitAction(action) {
  const raw = String(action ?? '').trim();
  if (!raw) return { verb: null, path: '—' };
  const gap = raw.indexOf(' ');
  if (gap === -1) return { verb: null, path: raw };
  const verb = raw.slice(0, gap).toUpperCase();
  if (!VERBS.has(verb)) return { verb: null, path: raw };
  return { verb, path: raw.slice(gap + 1) || '—' };
}

// Fields the audit MIDDLEWARE writes. Anything else in `detail` came from the
// older lib/audit.js call sites, which store a free-form object.
const MIDDLEWARE_KEYS = new Set(['role', 'status', 'ok', 'reason', 'body', 'ms']);

/**
 * Did middleware/adminAuth write this row?
 *
 * `ok` is the tell: the middleware always writes it as a boolean, and no
 * lib/audit.js call site passes one. Keying off `status` instead would be
 * wrong — routes/brands.js stores a brand's state under that same name.
 */
function isMiddlewareEntry(detail) {
  return typeof detail?.ok === 'boolean' || typeof detail?.ms === 'number';
}

/**
 * The HTTP status of an entry, or null.
 *
 * Deliberately requires a NUMBER. Two writers put rows in this table:
 * middleware/adminAuth stores `status: res.statusCode` (a number), while the
 * older lib/audit.js call sites store whatever the handler passed — and
 * routes/brands.js passes `detail: { status: 'active' }`, a brand's state.
 * Coercing that with Number() would be harmless today only by luck; a row
 * carrying `status: '403'` as domain data would be shown as a refusal that
 * never happened.
 */
export function httpStatusOf(detail) {
  return typeof detail?.status === 'number' && Number.isFinite(detail.status) ? detail.status : null;
}

/**
 * Was this action refused? `detail.ok` is written by the audit middleware from
 * the real response status, so it is the truth; the numeric status is the
 * fallback. Entries with neither are reported as unknown rather than guessed
 * at — an audit viewer that invents an outcome is worse than one that admits
 * it cannot tell.
 */
export function outcomeOf(row) {
  const detail = row?.detail;
  const status = httpStatusOf(detail);
  if (detail?.ok === false || (status != null && status >= 400)) {
    return { kind: 'refused', status };
  }
  if (detail?.ok === true || (status != null && status < 400)) {
    return { kind: 'ok', status };
  }
  return { kind: 'unknown', status: null };
}

export function actorLabel(row) {
  const name = typeof row?.actor_name === 'string' ? row.actor_name.trim() : '';
  if (name) return name;
  const id = row?.actor_id;
  if (id === 0 || id === '0') return 'System / unauthenticated';
  return id != null ? `Deleted admin #${id}` : 'Unknown actor';
}

const cell = (extra = {}) => ({ padding: '9px 14px', fontSize: 12.5, color: C.text, verticalAlign: 'top', ...extra });

export default function AuditRow({ row, expanded, onToggle, columnCount, domId }) {
  const outcome = outcomeOf(row);
  const refused = outcome.kind === 'refused';
  const { verb, path } = splitAction(row?.action);
  const detail = row?.detail || null;
  const reason = typeof detail?.reason === 'string' && detail.reason.trim() ? detail.reason.trim() : null;
  // The id comes from the caller's row key: audit ids are unique in practice,
  // but aria-controls pointing at a duplicated id is a silent a11y break.
  const detailId = `di-audit-detail-${domId || row?.id || 'row'}`;

  const target = row?.target_id != null && String(row.target_id) !== ''
    ? `${row.target_type || 'id'} ${row.target_id}`
    : null;

  const rowBg = refused ? C.red + '0e' : 'transparent';

  return (
    <>
      <tr
        style={{ borderBottom: expanded ? 'none' : `1px solid ${C.border}`, background: rowBg }}
        onMouseEnter={(e) => { e.currentTarget.style.background = refused ? C.red + '1c' : C.cardHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}
      >
        {/* When */}
        <td style={cell({ borderLeft: `3px solid ${refused ? C.red : 'transparent'}`, whiteSpace: 'nowrap' })}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <button
              type="button"
              className="di-cmd-focus"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={expanded ? detailId : undefined}
              aria-label={`${expanded ? 'Hide' : 'Show'} recorded request for ${verb || ''} ${path} at ${fullStamp(row?.created_at)}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted,
                fontSize: 11, padding: '2px 4px', lineHeight: 1, flexShrink: 0, fontFamily: 'inherit',
              }}
            >
              {expanded ? '▾' : '▸'}
            </button>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                {clockTime(row?.created_at)}
              </div>
              <div style={{ fontSize: 10.5, color: C.textFaint }}>{shortDate(row?.created_at)}</div>
            </div>
          </div>
        </td>

        {/* Who */}
        <td style={cell()}>
          <div style={{ fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{actorLabel(row)}</div>
          <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 2 }}>
            {detail?.role ? detail.role : <span title="No role recorded on this entry">role not recorded</span>}
          </div>
        </td>

        {/* Action */}
        <td style={cell()}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
            {verb && (
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
                color: VERB_COLOUR[verb] || C.textMuted,
                background: (VERB_COLOUR[verb] || C.textMuted) + '22',
                border: `1px solid ${(VERB_COLOUR[verb] || C.textMuted)}44`,
                borderRadius: 5, padding: '1px 5px', flexShrink: 0,
              }}>{verb}</span>
            )}
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.textMuted, wordBreak: 'break-all' }}>{path}</span>
          </div>
        </td>

        {/* Target */}
        <td style={cell({ whiteSpace: 'nowrap' })}>
          {target
            ? <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.text }}>{target}</span>
            : <span style={{ color: C.textFaint }} title="This route had no :id parameter">—</span>}
        </td>

        {/* Outcome */}
        <td style={cell({ whiteSpace: 'nowrap' })}>
          {outcome.kind === 'refused' && (
            <Badge label={`✕ Refused${outcome.status ? ` · ${outcome.status}` : ''}`} color={C.red} bg={C.red + '22'} title="The server rejected this action" />
          )}
          {outcome.kind === 'ok' && (
            <Badge label={`✓ OK${outcome.status ? ` · ${outcome.status}` : ''}`} color={C.green} bg={C.green + '22'} />
          )}
          {outcome.kind === 'unknown' && (
            <Badge label="? Unknown" color={C.textMuted} bg={C.border} title="This entry has no readable detail, so the outcome could not be determined" />
          )}
        </td>

        {/* Reason */}
        <td style={cell({ maxWidth: 260 })}>
          {reason
            ? <span style={{ color: C.text, lineHeight: 1.45 }}>{reason}</span>
            : <span style={{ color: C.textFaint }} title="Only high-impact actions are required to carry a typed reason">—</span>}
        </td>
      </tr>

      {expanded && (
        <tr id={detailId} style={{ borderBottom: `1px solid ${C.border}`, background: rowBg }}>
          <td colSpan={columnCount} style={{ padding: '0 14px 16px', borderLeft: `3px solid ${refused ? C.red : 'transparent'}` }}>
            <AuditDetail row={row} outcome={outcome} />
          </td>
        </tr>
      )}
    </>
  );
}

function AuditDetail({ row, outcome }) {
  const detail = row?.detail && typeof row.detail === 'object' ? row.detail : null;
  const body = detail && typeof detail.body === 'object' && detail.body !== null ? detail.body : null;
  const entries = body ? Object.entries(body) : [];

  // Rows written by the older lib/audit.js helper (user.delete, brand.review,
  // creative.review) have no `body` — their payload sits at the top level of
  // `detail`. Without this they expanded to "no body recorded", quietly hiding
  // the only thing those entries actually say.
  //
  // On a legacy row EVERY top-level key is payload, including one named
  // `status`: brand.review stores the brand's new state there. Filtering by
  // name alone would have swallowed the single field that entry exists to
  // record.
  const legacyEntry = detail != null && !isMiddlewareEntry(detail);
  const legacy = !detail
    ? []
    : legacyEntry
      ? Object.entries(detail)
      : Object.entries(detail).filter(([k]) => !MIDDLEWARE_KEYS.has(k));

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px 18px' }}>
        <Field label="Entry" value={row?.id != null ? `#${row.id}` : '—'} mono />
        <Field label="Recorded at" value={fullStamp(row?.created_at)} />
        <Field label="Actor" value={row?.actor_email || (row?.actor_id != null ? `user #${row.actor_id}` : '—')} mono />
        <Field label="Role at the time" value={detail?.role || 'not recorded'} />
        <Field label="Status" value={outcome.status != null ? String(outcome.status) : 'not recorded'} mono />
        <Field label="Took" value={Number.isFinite(Number(detail?.ms)) ? `${Number(detail.ms)} ms` : 'not recorded'} mono />
      </dl>

      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          Recorded request body
        </div>

        {detail == null ? (
          <div style={{ fontSize: 12, color: C.textFaint }}>
            This entry's detail could not be read — it was stored as something other than valid JSON.
          </div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: 12, color: C.textFaint }}>
            No body was recorded for this request.
            {legacyEntry && legacy.length > 0
              ? ' This entry predates the current audit middleware — what it did record is below.'
              : ''}
          </div>
        ) : (
          <KeyValues entries={entries} />
        )}

        {legacy.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              {legacyEntry ? 'What the route recorded' : 'Other recorded fields'}
            </div>
            <KeyValues entries={legacy} />
            {legacyEntry && (
              <div style={{ marginTop: 8, fontSize: 10.5, color: C.amber, lineHeight: 1.6 }}>
                Written by the older audit helper, which does not scrub or truncate, and whose field names mean
                whatever the route meant by them — a <code>status</code> here is not an HTTP status.
              </div>
            )}
          </div>
        )}

        {!legacyEntry && (
          <div style={{ marginTop: 12, fontSize: 10.5, color: C.textFaint, lineHeight: 1.6 }}>
            Bodies are scrubbed on the server before they are stored: anything whose key looks like a password,
            token, secret or key is written as <code style={{ color: C.amber }}>[redacted]</code>, nested objects
            are collapsed to <code>[object]</code>, and string values are cut at 200 characters. What you see here
            is the whole of what was kept.
          </div>
        )}
      </div>
    </div>
  );
}

const KeyValues = ({ entries }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {entries.map(([k, v]) => (
      <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
        <span style={{ fontFamily: MONO, color: C.textMuted, minWidth: 120, flexShrink: 0, wordBreak: 'break-all' }}>{k}</span>
        <span style={{
          fontFamily: MONO, color: v === '[redacted]' ? C.amber : C.text,
          wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.5,
        }}>
          {formatValue(v)}
        </span>
      </div>
    ))}
  </div>
);

function formatValue(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return v === '' ? '(empty string)' : v;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

const Field = ({ label, value, mono = false }) => (
  <div>
    <dt style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</dt>
    <dd style={{ margin: '3px 0 0', fontSize: 12, color: C.text, fontFamily: mono ? MONO : 'inherit', wordBreak: 'break-word' }}>{value}</dd>
  </div>
);
