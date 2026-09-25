// client/src/admin/platform/AppHealth.jsx
//
// Two checks, because they answer different questions:
//
//   GET /api/health                 (public, unauthenticated) — "can the API
//       actually serve?" It replies 503 with status:'degraded' and a SCRUBBED
//       reason when the database probe fails or times out at 3s.
//   GET /api/admin/command/health   (needs health.read) — the component view:
//       db reachable, and whether uploads are on durable storage or local disk.
//
// Nothing here is per-user. These are service checks; no profile, message or
// content data is read to build this strip.

import { useCallback, useEffect, useRef, useState } from 'react';
import { C, btn, formatWhen, MONO } from './theme';
import { Card, Note, ErrorBlock, Mono } from './ui';
import { makeCan } from './perms';
import { adminHealth, publicHealth } from './flagsApi';
import { apiError } from './errors';

const REFRESH_MS = 30_000;

const TONE = {
  good:    { color: C.green,     bg: C.green + '18' },
  bad:     { color: C.red,       bg: C.red + '18' },
  warn:    { color: C.amber,     bg: C.amber + '18' },
  unknown: { color: C.textMuted, bg: C.border },
};

function StatusTile({ icon, label, value, detail, tone = 'unknown' }) {
  const t = TONE[tone] || TONE.unknown;
  return (
    <Card style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }} aria-hidden="true">
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: t.color, marginTop: 3, lineHeight: 1.2 }}>{value}</div>
        {detail && <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 4, lineHeight: 1.5, wordBreak: 'break-word' }}>{detail}</div>}
      </div>
    </Card>
  );
}

function dbTone(v)  { return v === 'ok' ? 'good' : v === 'error' ? 'bad' : 'unknown'; }
function dbLabel(v) { return v === 'ok' ? 'Reachable' : v === 'error' ? 'Unreachable' : 'Unknown'; }

function storageView(r2) {
  if (r2 === 'ok') return { tone: 'good', value: 'Durable', detail: 'Object storage (R2) is configured. Uploads survive a redeploy.' };
  if (r2 === 'local-disk') return { tone: 'warn', value: 'Local disk', detail: 'Uploads are written to the instance disk and are lost when it is replaced.' };
  return { tone: 'unknown', value: 'Unknown', detail: 'The server could not load its storage module to say.' };
}

export default function AppHealth({ permissions }) {
  const { can, mayAttempt, known } = makeCan(permissions);
  // Ask for the detailed check unless we positively know the role lacks it: a
  // 403 on a GET is cheap and its message is shown, whereas failing closed on a
  // shell that passed nothing would hide the whole strip with no explanation.
  const mayReadHealth = mayAttempt('health.read');
  // Only true when we were TOLD the role lacks it — never on a guess.
  const deniedHealth  = known && !can('health.read');

  const [pub, setPub]           = useState(null);
  const [pubError, setPubError] = useState(null);
  const [adm, setAdm]           = useState(null);
  const [admError, setAdmError] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [auto, setAuto]         = useState(true);
  const [showRaw, setShowRaw]   = useState(false);

  // Re-armed on every mount: React 18 StrictMode remounts in development, and a
  // cleanup-only ref would stay false, silently dropping every state update.
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    // A request begun before the unmount must not block the remount's load().
    inFlight.current = false;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (alive.current) setLoading(true);

    // Settled, not all: a 403 on the admin check must not blank the public one.
    const [p, a] = await Promise.allSettled([
      publicHealth(),
      mayReadHealth ? adminHealth() : Promise.reject({ __skipped: true }),
    ]);

    if (alive.current) {
      if (p.status === 'fulfilled') { setPub(p.value); setPubError(null); }
      else { setPub(null); setPubError(apiError(p.reason, 'Could not reach the API health check at all.')); }

      if (a.status === 'fulfilled') { setAdm(a.value); setAdmError(null); }
      else if (a.reason?.__skipped) { setAdm(null); setAdmError(null); }
      else { setAdm(null); setAdmError(apiError(a.reason, 'Could not load the admin health check.')); }

      setLoading(false);
    }
    inFlight.current = false;
  }, [mayReadHealth]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => { load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [auto, load]);

  const degraded  = pub?.status === 'degraded';
  const serving   = pub?.status === 'ok';
  const pubWhen   = formatWhen(pub?.ts);
  const admWhen   = formatWhen(adm?.checked_at);
  // The admin check probes the database directly; the public one is the outside
  // view. Prefer the admin answer, fall back to the public one.
  const dbState   = adm?.db || pub?.db || 'unknown';
  const storage   = storageView(adm?.r2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>App health</h2>
        <span style={{ fontSize: 11.5, color: C.textFaint }}>
          {loading ? 'Checking…' : admWhen || pubWhen ? `Checked ${(admWhen || pubWhen).rel}` : 'Not checked yet'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <input
              id="health-auto"
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: C.accent, cursor: 'pointer' }}
            />
            <label htmlFor="health-auto" style={{ fontSize: 11.5, color: C.textMuted, cursor: 'pointer' }}>
              Re-check every 30s
            </label>
          </div>
          <button type="button" onClick={load} disabled={loading} style={btn('ghost', loading)}>
            {loading ? 'Checking…' : 'Check now'}
          </button>
        </div>
      </div>

      {degraded && (
        <Card style={{ padding: '16px 18px', background: C.red + '14', borderColor: C.red + '55' }} role="alert">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }} aria-hidden="true">🔴</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.red }}>Degraded — the API cannot serve normally</div>
              <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 6, lineHeight: 1.6 }}>
                The public health check returned <Mono>degraded</Mono>. Reason given:
              </div>
              <div style={{ marginTop: 8, background: C.bg, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {pub?.error || 'No reason was given.'}
              </div>
              <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 8, lineHeight: 1.55 }}>
                This message is redacted by the server before it leaves — the public check is unauthenticated, so connection
                strings and tokens are stripped. It may therefore be less specific than the real error.
              </div>
            </div>
          </div>
        </Card>
      )}

      {pubError && <ErrorBlock message={pubError} onRetry={load} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        <StatusTile
          icon={serving ? '🟢' : degraded ? '🔴' : '⏳'}
          label="Serving"
          value={loading && !pub ? 'Checking…' : serving ? 'OK' : degraded ? 'Degraded' : pubError ? 'Unreachable' : 'Unknown'}
          detail={pubWhen ? `Reported ${pubWhen.rel}` : pubError ? 'No answer from /api/health.' : null}
          tone={serving ? 'good' : degraded || pubError ? 'bad' : 'unknown'}
        />

        <StatusTile
          icon="🗄️"
          label="Database"
          value={loading && !adm && !pub ? 'Checking…' : dbLabel(dbState)}
          detail={adm
            ? 'Probed directly by the admin health check.'
            : deniedHealth
              ? 'From the public check only — the direct probe needs health.read.'
              : admError
                ? 'From the public check only; the admin probe did not answer.'
                : 'From the public check only.'}
          tone={dbTone(dbState)}
        />

        <StatusTile
          icon="📦"
          label="Upload storage"
          value={adm ? storage.value : loading ? 'Checking…' : 'Unknown'}
          // Only the admin check reports storage, so when it did not answer say
          // WHY it did not rather than blaming the server's storage module.
          detail={adm
            ? storage.detail
            : deniedHealth
              ? 'Only the admin health check reports this, and that needs health.read.'
              : admError
                ? 'The admin health check did not answer — see the error below.'
                : loading
                  ? null
                  : 'The admin health check has not answered yet.'}
          tone={adm ? storage.tone : 'unknown'}
        />

        <StatusTile
          icon="⚙️"
          label="Runtime"
          value={pub?.runtime ? (pub.runtime === 'workers' ? 'Workers' : pub.runtime === 'node' ? 'Node' : String(pub.runtime)) : loading ? 'Checking…' : 'Unknown'}
          detail={pubWhen ? `Server clock: ${pubWhen.abs}` : null}
          tone="unknown"
        />
      </div>

      {admError && <ErrorBlock message={admError} onRetry={load} />}

      {deniedHealth && (
        <Note icon="🔒" tone="blue">
          Your role cannot read the detailed health check, so only the public <Mono>/api/health</Mono> result is shown above.
          The direct database probe and the upload-storage line need <Mono>health.read</Mono>.
        </Note>
      )}

      {adm?.db_error && (
        <Card style={{ padding: '14px 18px', background: C.amber + '0f', borderColor: C.amber + '44' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 15 }} aria-hidden="true">⚠️</span>
            <div style={{ fontSize: 12.5, color: C.textMuted, flex: 1, minWidth: 0, lineHeight: 1.6 }}>
              The admin check also returned a raw database error. Unlike the public one it is <strong style={{ color: C.text }}>not redacted</strong>,
              so it can contain a connection URL or an embedded token — read it, do not paste it into a ticket or chat.
            </div>
            <button type="button" onClick={() => setShowRaw((s) => !s)} aria-expanded={showRaw} style={btn('ghost')}>
              {showRaw ? 'Hide' : 'Show'}
            </button>
          </div>
          {showRaw && (
            <div style={{ marginTop: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {adm.db_error}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
