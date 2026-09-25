// client/src/admin/people/PeopleList.jsx
// The member table. Search, page, open one.
//
// It shows what GET /api/admin/users actually returns and says out loud what it
// does not return. A column of em-dashes labelled "Country" would look like
// data; a sentence saying the API has no country field is the truth.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '../../components/Avatar';
import { listMembers, errMessage } from './peopleApi';
import { C, card, th, td, input, pagerBtn, btn, fmtDate, fmtNum } from './ui';

const PAGE_SIZE = 30;

function Flags({ member }) {
  const flags = [];
  if (member?.verified) flags.push({ k: 'Verified', fg: C.accentHi, bg: C.accent + '22' });
  if (member?.premium) flags.push({ k: 'Premium', fg: C.amber, bg: C.amber + '22' });
  flags.unshift(member?.onboarded
    ? { k: 'Onboarded', fg: C.green, bg: C.green + '22' }
    : { k: 'Setup pending', fg: C.textMuted, bg: C.border });
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {flags.map((f) => (
        <span key={f.k} style={{ background: f.bg, color: f.fg, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
          {f.k}
        </span>
      ))}
    </div>
  );
}

export default function PeopleList({ can = () => false, onSelect, selectedId = null, refreshToken = 0 }) {
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const liveRef = useRef(true);

  useEffect(() => () => { liveRef.current = false; }, []);

  // Debounce so a five-letter name is one query, not five.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(term.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const load = useCallback((signal) => {
    setLoading(true);
    setError('');
    return listMembers({ page, search, signal })
      .then((d) => {
        if (!liveRef.current || signal?.aborted) return;
        setRows(d.users);
        setTotal(d.total);
        setLoading(false);
      })
      .catch((e) => {
        if (!liveRef.current || signal?.aborted || e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return;
        setRows([]);
        setTotal(0);
        setError(errMessage(e, 'Could not load members.'));
        setLoading(false);
      });
  }, [page, search]);

  useEffect(() => {
    liveRef.current = true;
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, refreshToken, reloadTick]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const canRead = can('users.read');
  const headers = useMemo(() => ['Member', 'Email', 'Joined', 'Activity', 'Account', ''], []);

  if (!canRead) {
    return (
      <div style={card({ padding: 28, textAlign: 'center' })}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Members are not visible to your role</div>
        <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6 }}>
          Viewing the member list needs <code style={{ color: C.accentHi }}>users.read</code>
          {' '}— your role does not have it.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search + count */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
          <label htmlFor="people-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
            Search members by name or email
          </label>
          <input
            id="people-search"
            type="search"
            placeholder="Search by name or email…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            style={{ ...input, width: '100%' }}
          />
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginLeft: 'auto' }}>
          {loading ? 'Loading…' : `${fmtNum(total)} ${total === 1 ? 'member' : 'members'}${search ? ' matching' : ''}`}
        </div>
      </div>

      {/* What this table cannot tell you */}
      <div style={card({ padding: '12px 16px', marginBottom: 14, borderColor: C.border, background: C.card })}>
        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.65 }}>
          <strong style={{ color: C.text }}>What this list does not know.</strong>{' '}
          <code style={{ color: C.accentHi }}>GET /admin/users</code> returns identity, join date, the
          verified/premium/badge flags and post, cheer and connection counts — nothing else. Country,
          enforcement state (suspended / banned) and reports-received are <em>not</em> in the response,
          so they are not shown rather than shown as blanks. Search matches name, email or title.
          Email addresses are personal data; read access on this route is not itself audited today,
          writes are.
        </div>
      </div>

      <div style={card()}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              Members, newest first
            </caption>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {headers.map((h, i) => (
                  <th key={h || `col-${i}`} scope="col" style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={headers.length} style={{ ...td, textAlign: 'center', color: C.textMuted, padding: '36px 16px' }}>Loading members…</td></tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={headers.length} style={{ ...td, padding: '32px 16px', textAlign: 'center' }}>
                    <div role="alert" style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>
                    <button type="button" onClick={() => setReloadTick((t) => t + 1)} style={btn({ tone: 'neutral', size: 'md' })}>
                      Try again
                    </button>
                  </td>
                </tr>
              )}

              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={headers.length} style={{ ...td, padding: '36px 16px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                    {search ? `No member matches “${search}”.` : 'No members yet.'}
                  </td>
                </tr>
              )}

              {rows.map((m, i) => {
                const selected = selectedId != null && String(selectedId) === String(m?.id);
                return (
                  <tr
                    key={m?.id ?? `row-${i}`}
                    style={{ borderBottom: `1px solid ${C.border}`, background: selected ? C.accentSoft : 'transparent' }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = C.cardHover; }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={m?.avatar} name={m?.name || 'Member'} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {m?.name || `Member #${m?.id ?? '?'}`}
                            {m?.verified ? <span title="Verified" style={{ color: C.accentHi, fontSize: 14 }}>✓</span> : null}
                            {m?.badge ? <span title="Badge" style={{ fontSize: 12 }}>{m.badge}</span> : null}
                          </div>
                          <div style={{ color: C.textFaint, fontSize: 11 }}>
                            #{m?.id ?? '?'}{m?.title ? ` · ${String(m.title).slice(0, 38)}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...td, color: C.textMuted, fontSize: 12, wordBreak: 'break-all' }}>{m?.email || '—'}</td>
                    <td style={{ ...td, color: C.textFaint, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(m?.created_at)}</td>
                    <td style={{ ...td, color: C.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>
                      <span style={{ color: C.text, fontWeight: 700 }}>{fmtNum(m?.post_count)}</span> posts
                      {' · '}{fmtNum(m?.cheer_count)} cheers
                      {' · '}{fmtNum(m?.connection_count)} connections
                    </td>
                    <td style={td}><Flags member={m} /></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button type="button" onClick={() => onSelect?.(m)} style={btn({ tone: selected ? 'primary' : 'neutral' })}>
                        {selected ? 'Open ›' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 16 }}>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} style={pagerBtn(page <= 1 || loading)}>
              ← Prev
            </button>
            <span style={{ color: C.textMuted, fontSize: 13 }}>Page {page} of {lastPage}</span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= lastPage || loading} style={pagerBtn(page >= lastPage || loading)}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
