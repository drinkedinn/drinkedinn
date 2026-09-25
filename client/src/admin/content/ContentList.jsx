// src/admin/content/ContentList.jsx
// Recent posts, and the one action that takes one down.
//
// Contract — server/routes/admin.js:
//   GET /api/admin/posts?page=N   (requirePermission 'content.read')
//     → { posts: [...], total, page }, 30 rows per page, newest first.
//       Each row: { id, content, drink, location, image_url, created_at,
//                   user_id, name, avatar, cheer_count, comment_count,
//                   report_count }
//       report_count counts rows in `reports` with target_type='post', so it
//       is the whole history for that post — not a slice of a queue.
//   DELETE /api/admin/posts/:id   (requirePermission 'content.remove')
//     'content.remove' is in HIGH_IMPACT, so adminAuth rejects the call with
//     400 unless the body carries a `reason` of 8+ characters. The reason is
//     written to admin_audit by auditAdmin, which is mounted on the whole
//     /api/admin chain in app.js.
//
// The endpoint takes no filter arguments. The filters below therefore run over
// the 30 rows of the current page, and the UI says so rather than implying it
// searched the platform.

import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api';
import Avatar from '../../components/Avatar';
import {
  C, Card, Badge, Notice, ErrorBanner, EmptyState, Loading,
  labelStyle, selectStyle, actionBtn, pagerBtn, thStyle, tdStyle,
  fmtDateTime, fmtCount, plainPreview, parseDbDate, apiError,
} from './ui';
import { PERMS } from './permissions';
import usePanelPermissions from './usePanelPermissions';
import RemoveReasonDialog from './RemoveReasonDialog';
import PostDetail from './PostDetail';

const PAGE_SIZE = 30; // LIMIT 30 in routes/admin.js

const DATE_WINDOWS = [
  { id: 'any', label: 'Any date',      days: null },
  { id: '1',   label: 'Last 24 hours', days: 1 },
  { id: '7',   label: 'Last 7 days',   days: 7 },
  { id: '30',  label: 'Last 30 days',  days: 30 },
];

const hasImage = (post) => !!String(post?.image_url || '').trim();
const reportCount = (post) => {
  const n = Number(post?.report_count);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function ContentList({ permissions = null, role = null }) {
  const perms = usePanelPermissions({ permissions, role });
  const mayRead = perms.can(PERMS.contentRead);
  const mayRemove = perms.can(PERMS.contentRemove);

  const [page, setPage]       = useState(1);
  const [posts, setPosts]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [imageFilter, setImageFilter]   = useState('any');
  const [reportFilter, setReportFilter] = useState('any');
  const [dateFilter, setDateFilter]     = useState('any');

  const [detail, setDetail]           = useState(null);
  const [removing, setRemoving]       = useState(null);
  const [removeBusy, setRemoveBusy]   = useState(false);
  const [removeError, setRemoveError] = useState('');

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/admin/posts', { params: { page } });
      const data = r?.data || {};
      const list = Array.isArray(data.posts) ? data.posts.filter(Boolean) : [];
      setPosts(list);
      setTotal(Number(data.total) || 0);
      // A removal can empty the last page. Step back rather than stranding the
      // operator on a blank screen.
      if (list.length === 0 && page > 1) setPage((p) => Math.max(1, p - 1));
    } catch (e) {
      setPosts([]);
      setError(apiError(e, 'Could not load posts.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { if (mayRead) load(); }, [mayRead, load]);

  // Keep the open detail view in step with a refreshed list, so its counts and
  // report total are not a stale copy from before the last reload.
  useEffect(() => {
    setDetail((d) => (d ? posts.find((p) => p.id === d.id) || null : null));
  }, [posts]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const days = DATE_WINDOWS.find((w) => w.id === dateFilter)?.days ?? null;
    const cutoff = days ? Date.now() - days * 86400000 : null;
    return posts.filter((p) => {
      if (cutoff != null) {
        const d = parseDbDate(p.created_at);
        if (!d || d.getTime() < cutoff) return false;
      }
      if (imageFilter === 'with' && !hasImage(p)) return false;
      if (imageFilter === 'without' && hasImage(p)) return false;
      if (reportFilter === 'with' && reportCount(p) === 0) return false;
      if (reportFilter === 'without' && reportCount(p) > 0) return false;
      return true;
    });
  }, [posts, dateFilter, imageFilter, reportFilter]);

  const filtersActive = dateFilter !== 'any' || imageFilter !== 'any' || reportFilter !== 'any';
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reportedOnPage = useMemo(() => posts.filter((p) => reportCount(p) > 0).length, [posts]);

  // ── Remove ─────────────────────────────────────────────────────────────────
  const confirmRemove = async (reason) => {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError('');
    try {
      // axios puts `data` in the request body for DELETE and sets a JSON
      // content type, which is what lib/jsonBody.js needs in order to parse it
      // — and what requirePermission('content.remove') reads the reason from.
      await api.delete(`/admin/posts/${removing.id}`, { data: { reason } });
      setRemoving(null);
      setDetail(null);
      await load();
    } catch (e) {
      setRemoveError(apiError(e, 'Could not remove that post.'));
    } finally {
      setRemoveBusy(false);
    }
  };

  // ── Permission wall ────────────────────────────────────────────────────────
  if (!perms.ready) return <Loading label="Checking your permissions…" />;

  if (!mayRead) {
    return (
      <EmptyState
        icon="🔒"
        title="Content is not part of your role"
        hint={perms.source === 'failed'
          ? `Your permissions could not be read, so nothing is shown. ${perms.error}`
          : `Viewing posts needs the ${PERMS.contentRead} permission${perms.role ? `, and the ${perms.role} role does not have it` : ''}. Ask an owner if you need it.`}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <Notice icon="🛡️">
        Posts here are <strong>public content</strong>. This console never renders private messages, and post text is
        always shown as plain text — never as markup.{' '}
        {mayRemove
          ? 'A removal is permanent, needs a written reason, and is recorded in the admin audit log against your account.'
          : `Your role can read this list but not remove posts (${PERMS.contentRemove}), so no removal controls are shown.`}
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
            <select id="filter-image" value={imageFilter} onChange={(e) => setImageFilter(e.target.value)} style={{ ...selectStyle, minWidth: 160 }}>
              <option value="any">Any</option>
              <option value="with">Has an image</option>
              <option value="without">Text only</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-reports" style={labelStyle}>Reports</label>
            <select id="filter-reports" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ ...selectStyle, minWidth: 160 }}>
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
            <div style={{ color: C.textFaint, fontSize: 11.5 }}>
              {fmtCount(total)} posts on the platform · {reportedOnPage} reported here
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 11.5, color: C.textFaint, lineHeight: 1.6 }}>
          Filters run on the {PAGE_SIZE} posts loaded for this page — <code>/admin/posts</code> takes no filter
          arguments, so a reported post on page 4 will not surface on page 1. Use the Reports queue when you need
          every reported post at once.
        </div>
      </Card>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* ── Table ── */}
      {loading ? (
        <Loading label="Loading posts…" />
      ) : error ? null : posts.length === 0 ? (
        <EmptyState icon="🗂️" title="No posts" hint="Nothing has been posted yet, or this page is past the end of the list." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No posts match these filters"
          hint={`None of the ${posts.length} posts on this page match. Clear the filters, or move to another page.`}
        />
      ) : (
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
                  const reports = reportCount(p);
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
                            <div style={{ fontWeight: 600, color: C.text }}>{plainPreview(p.name, 32) || 'Unknown'}</div>
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
                          {p.drink ? <Badge label={plainPreview(p.drink, 18)} color={C.amber} bg={C.amber + '22'} /> : null}
                          {p.location ? <Badge label={`📍 ${plainPreview(p.location, 28)}`} color={C.teal} bg={C.teal + '22'} /> : null}
                          {hasImage(p) ? <Badge label="🖼 Image" color={C.purple} bg={C.purple + '22'} title="Opens unloaded — the console does not fetch member images automatically" /> : null}
                        </div>
                      </td>

                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.textMuted, fontSize: 12.5 }}>
                        🥂 {fmtCount(p.cheer_count)} &nbsp; 💬 {fmtCount(p.comment_count)}
                      </td>

                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {p.report_count == null ? (
                          <span style={{ color: C.textFaint, fontSize: 12 }} title="This response carried no report count">unknown</span>
                        ) : reports === 0 ? (
                          <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>
                        ) : (
                          <Badge label={`🚩 ${fmtCount(reports)}`} color={C.red} bg={C.red + '22'} title={`${reports} report(s) against this post`} />
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
      )}

      {detail && (
        <PostDetail
          post={detail}
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
