// src/admin/content/ContentList.jsx
// Recent posts, and the one action that takes one down.
//
// Contract: GET /api/admin/posts?page=N → { posts, total, page }, 30 per page.
// Each post row is { id, content, drink, location, created_at, user_id, name,
// avatar, cheer_count, comment_count } — there is no image field and no report
// count in that response, so this panel says so rather than inventing either.
// Report counts are derived from GET /api/reports (the 50 most recent), and
// the image filter stays disabled until the endpoint actually returns one.

import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api';
import Avatar from '../../components/Avatar';
import {
  C, Card, Badge, Notice, ErrorBanner, EmptyState, Loading,
  labelStyle, selectStyle, actionBtn, pagerBtn, thStyle, tdStyle,
  fmtDateTime, fmtCount, plainPreview, parseDbDate, apiError,
} from './ui';
import { can, hasPermissionSource, PERMS } from './permissions';
import RemoveReasonDialog from './RemoveReasonDialog';
import PostDetail from './PostDetail';

const PAGE_SIZE = 30;

const DATE_WINDOWS = [
  { id: 'any',  label: 'Any date',      days: null },
  { id: '1',    label: 'Last 24 hours', days: 1 },
  { id: '7',    label: 'Last 7 days',   days: 7 },
  { id: '30',   label: 'Last 30 days',  days: 30 },
];

export default function ContentList({ permissions, role }) {
  const [page, setPage]       = useState(1);
  const [posts, setPosts]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // null = the reports queue could not be read. Unknown is not the same as zero.
  const [reports, setReports]         = useState(null);
  const [reportsError, setReportsError] = useState('');

  const [imageFilter, setImageFilter]   = useState('any');
  const [reportFilter, setReportFilter] = useState('any');
  const [dateFilter, setDateFilter]     = useState('any');

  const [detail, setDetail]         = useState(null);
  const [removing, setRemoving]     = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const mayRead   = can(permissions, PERMS.contentRead);
  const mayRemove = can(permissions, PERMS.contentRemove);
  const permsKnown = hasPermissionSource(permissions);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/admin/posts?page=${page}`);
      const data = r?.data || {};
      const list = Array.isArray(data.posts) ? data.posts.filter(Boolean) : [];
      setPosts(list);
      setTotal(Number(data.total) || 0);
      // A removal can empty the last page. Step back rather than stranding the
      // operator on a blank screen with a live Next button.
      if (list.length === 0 && page > 1) setPage((p) => Math.max(1, p - 1));
    } catch (e) {
      setPosts([]);
      setError(apiError(e, 'Could not load posts.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadReports = useCallback(async () => {
    try {
      const r = await api.get('/reports');
      setReports(Array.isArray(r?.data) ? r.data.filter(Boolean) : []);
      setReportsError('');
    } catch (e) {
      setReports(null);
      setReportsError(apiError(e, 'Report counts are unavailable right now.'));
    }
  }, []);

  useEffect(() => { if (mayRead) load(); }, [mayRead, load]);
  useEffect(() => { if (mayRead) loadReports(); }, [mayRead, loadReports]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const reportsById = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(reports)) return map;
    for (const r of reports) {
      // Strictly post-targeted reports. The endpoint aliases target_id as
      // post_id for every row, so trusting post_id alone would pin a report
      // about a *user* onto whichever post shares that id.
      if (r?.target_type !== 'post' || r?.target_id == null) continue;
      const key = String(r.target_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return map;
  }, [reports]);

  const reportsFor = useCallback((id) => reportsById.get(String(id)) || [], [reportsById]);

  // The list endpoint does not select posts.image_url. Rather than shipping a
  // filter that silently matches nothing, detect whether the field is there.
  const imageFieldAvailable = useMemo(
    () => posts.some((p) => Object.prototype.hasOwnProperty.call(p, 'image_url')),
    [posts]
  );
  const reportsAvailable = Array.isArray(reports);

  // A filter whose data went away must not sit there looking applied.
  useEffect(() => { if (!imageFieldAvailable && imageFilter !== 'any') setImageFilter('any'); }, [imageFieldAvailable, imageFilter]);
  useEffect(() => { if (!reportsAvailable && reportFilter !== 'any') setReportFilter('any'); }, [reportsAvailable, reportFilter]);

  const visible = useMemo(() => {
    const days = DATE_WINDOWS.find((w) => w.id === dateFilter)?.days ?? null;
    const cutoff = days ? Date.now() - days * 86400000 : null;
    return posts.filter((p) => {
      if (cutoff != null) {
        const d = parseDbDate(p.created_at);
        if (!d || d.getTime() < cutoff) return false;
      }
      if (imageFieldAvailable && imageFilter !== 'any') {
        const hasImage = !!String(p.image_url || '').trim();
        if (imageFilter === 'with' && !hasImage) return false;
        if (imageFilter === 'without' && hasImage) return false;
      }
      if (reportsAvailable && reportFilter !== 'any') {
        const n = reportsFor(p.id).length;
        if (reportFilter === 'with' && n === 0) return false;
        if (reportFilter === 'without' && n > 0) return false;
      }
      return true;
    });
  }, [posts, dateFilter, imageFilter, imageFieldAvailable, reportFilter, reportsAvailable, reportsFor]);

  const filtersActive = dateFilter !== 'any' || imageFilter !== 'any' || reportFilter !== 'any';
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Remove ──────────────────────────────────────────────────────────────────
  const confirmRemove = async (reason) => {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError('');
    try {
      // The reason travels in the body as `reason` — the shape
      // middleware/adminAuth.requirePermission reads, and the shape
      // auditAdmin records, so this call is already correct for the day
      // /api/admin moves onto the audited admin chain (it is not on it yet;
      // today only /api/admin/{roles,moderation,flags,command} are).
      // Until then this console is what enforces "no removal without a reason".
      await api.delete(`/admin/posts/${removing.id}`, { data: { reason } });
      setRemoving(null);
      setDetail(null);
      await load();
      await loadReports();
    } catch (e) {
      setRemoveError(apiError(e, 'Could not remove that post.'));
    } finally {
      setRemoveBusy(false);
    }
  };

  // ── Permission wall ─────────────────────────────────────────────────────────
  if (!mayRead) {
    return (
      <EmptyState
        icon="🔒"
        title="Content is not part of your role"
        hint={permsKnown
          ? `Viewing posts needs the ${PERMS.contentRead} permission${role ? `, and the ${role} role does not have it` : ''}. Ask an owner if you need it.`
          : 'The admin shell did not pass a permission set to this panel, so it cannot confirm you hold content.read. Nothing is shown until it does.'}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <Notice icon="🛡️">
        Posts here are <strong>public content</strong>. This console never renders private messages, and post text is
        always shown as plain text — never as markup.{' '}
        {mayRemove
          ? 'A removal needs a written reason, is permanent, and is attributed to your admin account.'
          : 'Your role can read this list but not remove posts, so no removal controls are shown.'}
      </Notice>

      {/* ── Filters ── */}
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="filter-date" style={labelStyle}>Posted</label>
            <select id="filter-date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ ...selectStyle, minWidth: 160 }}>
              {DATE_WINDOWS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="filter-image" style={labelStyle}>Image</label>
            <select
              id="filter-image"
              value={imageFilter}
              onChange={(e) => setImageFilter(e.target.value)}
              disabled={!imageFieldAvailable}
              aria-describedby={imageFieldAvailable ? undefined : 'filter-image-help'}
              style={{ ...selectStyle, minWidth: 160, opacity: imageFieldAvailable ? 1 : 0.5, cursor: imageFieldAvailable ? 'pointer' : 'not-allowed' }}
            >
              <option value="any">Any</option>
              <option value="with">Has an image</option>
              <option value="without">Text only</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-reports" style={labelStyle}>Reports</label>
            <select
              id="filter-reports"
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
              disabled={!reportsAvailable}
              style={{ ...selectStyle, minWidth: 160, opacity: reportsAvailable ? 1 : 0.5, cursor: reportsAvailable ? 'pointer' : 'not-allowed' }}
            >
              <option value="any">Any</option>
              <option value="with">Reported</option>
              <option value="without">Not reported</option>
            </select>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={() => { setDateFilter('any'); setImageFilter('any'); setReportFilter('any'); }}
              style={actionBtn(C.textMuted)}
            >
              Clear filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: C.textMuted, textAlign: 'right', lineHeight: 1.6 }}>
            <div><strong style={{ color: C.text }}>{visible.length}</strong> shown of {posts.length} on this page</div>
            <div style={{ color: C.textFaint, fontSize: 11.5 }}>{fmtCount(total)} posts on the platform</div>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 11.5, color: C.textFaint, lineHeight: 1.6 }}>
          Filters run on the {PAGE_SIZE} posts loaded for this page — <code>/admin/posts</code> takes no filter
          arguments, so a match on page 4 will not surface on page 1.
          {!imageFieldAvailable && (
            <span id="filter-image-help"> The image filter is off because the posts endpoint does not return an image field.</span>
          )}
          {!reportsAvailable && ' Report data is unavailable, so the report filter is off and counts read “unknown”.'}
          {reportsAvailable && ' Report counts cover the 50 most recent reports only.'}
        </div>
      </Card>

      {reportsError && <ErrorBanner message={reportsError} onRetry={loadReports} />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* ── Table ── */}
      {loading ? (
        <Loading label="Loading posts…" />
      ) : !error && posts.length === 0 ? (
        <EmptyState icon="🗂️" title="No posts" hint="Nothing has been posted yet, or this page is past the end of the list." />
      ) : !error && visible.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No posts match these filters"
          hint={`None of the ${posts.length} posts on this page match. Clear the filters, or move to another page.`}
        />
      ) : !error ? (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <caption style={{ captionSide: 'top', textAlign: 'left', padding: '12px 16px 0', color: C.textFaint, fontSize: 11.5 }}>
                Recent posts, newest first.
              </caption>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Author', 'Posted', 'Content', 'Engagement', 'Reports', 'Actions'].map((h) => (
                    <th key={h} scope="col" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const rs = reportsFor(p.id);
                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar src={p.avatar} name={p.name || 'User'} size={34} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: C.text }}>{p.name || 'Unknown'}</div>
                            <div style={{ color: C.textFaint, fontSize: 11 }}>User #{p.user_id ?? '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ ...tdStyle, color: C.textFaint, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(p.created_at)}
                      </td>

                      <td style={{ ...tdStyle, maxWidth: 420 }}>
                        <div style={{ color: C.textMuted, fontSize: 12.5, lineHeight: 1.55, wordBreak: 'break-word' }}>
                          {plainPreview(p.content, 160) || <span style={{ color: C.textFaint }}>(no text)</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          {p.drink ? <Badge label={p.drink} color={C.amber} bg={C.amber + '22'} /> : null}
                          {p.location ? <Badge label={`📍 ${plainPreview(p.location, 28)}`} color={C.teal} bg={C.teal + '22'} /> : null}
                          {imageFieldAvailable && String(p.image_url || '').trim()
                            ? <Badge label="🖼 Image" color={C.purple} bg={C.purple + '22'} />
                            : null}
                        </div>
                      </td>

                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.textMuted, fontSize: 12.5 }}>
                        🥂 {fmtCount(p.cheer_count)} &nbsp; 💬 {fmtCount(p.comment_count)}
                      </td>

                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {!reportsAvailable ? (
                          <span style={{ color: C.textFaint, fontSize: 12 }} title="The reports queue could not be read">unknown</span>
                        ) : rs.length === 0 ? (
                          <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>
                        ) : (
                          <Badge label={`🚩 ${rs.length}`} color={C.red} bg={C.red + '22'} title={`${rs.length} report(s) in the 50 most recent`} />
                        )}
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setDetail(p)} style={actionBtn(C.accentHi)}>
                            View in context
                          </button>
                          {mayRemove && (
                            <button
                              type="button"
                              onClick={() => { setRemoveError(''); setRemoving(p); }}
                              style={actionBtn(C.red)}
                            >
                              Remove…
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 16 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pagerBtn(page <= 1)}>
                ← Prev
              </button>
              <span style={{ color: C.textMuted, fontSize: 13 }}>Page {page} of {lastPage}</span>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= lastPage} style={pagerBtn(page >= lastPage)}>
                Next →
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {detail && (
        <PostDetail
          post={detail}
          reports={reportsFor(detail.id)}
          reportsAvailable={reportsAvailable}
          canRemove={mayRemove}
          onRemove={(p) => { setDetail(null); setRemoveError(''); setRemoving(p); }}
          onClose={() => setDetail(null)}
        />
      )}

      {removing && mayRemove && (
        <RemoveReasonDialog
          post={removing}
          submitting={removeBusy}
          error={removeError}
          onCancel={() => { if (!removeBusy) { setRemoving(null); setRemoveError(''); } }}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}
