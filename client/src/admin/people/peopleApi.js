// client/src/admin/people/peopleApi.js
// Every network call the People panel makes, in one place, so the exact server
// contract is auditable without reading three components.
//
// Contracts (read from the server, not assumed):
//   GET    /api/admin/users?page&search   → { users: [...], total, page }
//          user row: id, name, email, title, avatar, onboarded, created_at,
//                    badge, verified, premium, post_count, connection_count,
//                    cheer_count            ← that is the WHOLE row
//   DELETE /api/admin/users/:id           → { ok: true }
//   PUT    /api/admin/users/:id/verify    → { ok: true }   body { verified: 1|0 }
//   PUT    /api/admin/users/:id/premium   → { ok: true }   body { premium: 1|0 }
//   PUT    /api/admin/users/:id/badge     → { ok: true }   body { badge: string|null }
//   GET    /api/admin/roles               → [{ user_id, role, granted_at,
//                                             granted_by, name, email, avatar,
//                                             granted_by_name }]
//   GET    /api/admin/roles/catalogue     → [{ role, permissions: [...] }]
//   PUT    /api/admin/roles/:userId       → { ok, user_id, role }  body { role, reason }
//   DELETE /api/admin/roles/:userId       → { ok: true }           body { reason }
//   GET    /api/reports                   → 50 most recent reports

import api from '../../api';

/** Server message first, always. err.message is a network detail, not an answer. */
export function errMessage(err, fallback = 'Something went wrong.') {
  const data = err?.response?.data;
  if (data?.error) {
    if (data.required) return `${data.error} (needs ${data.required})`;
    return data.error;
  }
  if (err?.response?.status === 404) return 'That endpoint is not available on this server.';
  if (err?.response?.status) return `Request failed (HTTP ${err.response.status}).`;
  return fallback;
}

// ─── Members ─────────────────────────────────────────────────────────────────
export async function listMembers({ page = 1, search = '', signal } = {}) {
  const r = await api.get('/admin/users', { params: { page, search }, signal });
  const d = r?.data || {};
  return {
    users: Array.isArray(d.users) ? d.users : [],
    total: Number.isFinite(d.total) ? d.total : 0,
    page: Number.isFinite(d.page) ? d.page : page,
  };
}

/**
 * Permanent erasure.
 *
 * The reason is not optional politeness: `users.delete` is in HIGH_IMPACT
 * (lib/permissions.js), so requirePermission() rejects the call with 400 unless
 * req.body.reason is at least 8 characters, and stores it as req.adminReason,
 * which auditAdmin() writes to admin_audit. /api/admin IS on the audited chain
 * (app.js mounts it with requireAuth + loadAdmin + auditAdmin), so the action,
 * the actor, the status and the reason are all recorded.
 *
 * axios needs `data` to put a body on a DELETE; server/lib/jsonBody.js parses
 * bodies on every method except GET and HEAD, so it arrives.
 */
export function deleteMember(id, reason) {
  return api.delete(`/admin/users/${id}`, { data: { reason } });
}

export function setVerified(id, verified) {
  return api.put(`/admin/users/${id}/verify`, { verified: verified ? 1 : 0 });
}

export function setPremium(id, premium) {
  return api.put(`/admin/users/${id}/premium`, { premium: premium ? 1 : 0 });
}

export function setBadge(id, badge) {
  return api.put(`/admin/users/${id}/badge`, { badge: badge || null });
}

// ─── Enforcement ─────────────────────────────────────────────────────────────
// The users table already carries suspended_until, banned_at and
// moderation_note, and lib/permissions.js already defines users.warn /
// users.suspend / users.ban / users.restore. No route writes any of them. So
// this console shows the actions, states plainly that they are not wired, and
// does NOT fire a request that can only 404. The contract below is what the
// panel expects the moment those routes exist.
//
// TO WIRE ONE UP: set `available: true` here AND give the button an onClick in
// MemberDetail.jsx that opens ActionDialog and posts { reason } (plus { days }
// for suspend). Flipping `available` alone would produce an enabled button that
// does nothing, which is worse than a disabled one that explains itself.
export const ENFORCEMENT = [
  {
    key: 'warn',
    label: 'Warn',
    permission: 'users.warn',
    available: false,
    tone: 'warn',
    endpoint: 'POST /api/admin/users/:id/warn  { reason }',
    effect: 'Records a warning on the account and notifies the member. Nothing is removed.',
  },
  {
    key: 'suspend',
    label: 'Suspend',
    permission: 'users.suspend',
    available: false,
    tone: 'warn',
    needsDuration: true,
    endpoint: 'POST /api/admin/users/:id/suspend  { reason, days }',
    effect: 'Sets users.suspended_until. The member cannot post or message until it lapses. Their content stays visible.',
  },
  {
    key: 'ban',
    label: 'Ban',
    permission: 'users.ban',
    available: false,
    tone: 'danger',
    destructive: true,
    endpoint: 'POST /api/admin/users/:id/ban  { reason }',
    effect: 'Sets users.banned_at. The account is locked out indefinitely. Content stays in place unless removed separately.',
  },
  {
    key: 'restore',
    label: 'Restore',
    permission: 'users.restore',
    available: false,
    tone: 'good',
    endpoint: 'POST /api/admin/users/:id/restore  { reason }',
    effect: 'Clears suspended_until and banned_at. The account works normally again.',
  },
];

// ─── Roles ───────────────────────────────────────────────────────────────────
export async function listRoles({ signal } = {}) {
  const r = await api.get('/admin/roles', { signal });
  return Array.isArray(r?.data) ? r.data : [];
}

export async function roleCatalogue({ signal } = {}) {
  const r = await api.get('/admin/roles/catalogue', { signal });
  return Array.isArray(r?.data) ? r.data : [];
}

export function grantRole(userId, role, reason) {
  return api.put(`/admin/roles/${userId}`, { role, reason });
}

export function revokeRole(userId, reason) {
  // requirePermission('roles.write') reads req.body.reason on DELETE too, so the
  // reason must travel as a body — axios needs `data` for that.
  return api.delete(`/admin/roles/${userId}`, { data: { reason } });
}

// ─── Reports (counts and categories only) ────────────────────────────────────
// GET /api/reports returns the 50 most recent reports platform-wide. That is a
// window, not a total, and every count derived from it is labelled as such in
// the UI. Note it is gated on the legacy requireAdmin boolean, not on
// reports.read — this panel gates it on reports.read anyway, which is stricter
// than the server, because a `support` role has no business reading the queue.
export async function recentReports({ signal } = {}) {
  const r = await api.get('/reports', { signal });
  return Array.isArray(r?.data) ? r.data : [];
}

// reports.reason is FREE TEXT, not an enum. routes/reports.js stores whatever
// the reporter typed (up to 500 chars), and the child-safety endpoint stores
// `csae: ` followed by up to 1000 characters of their account of what they saw.
// Echoing that string into a member's profile card would put one member's
// written report about another member on screen — the exact thing this console
// is not for. So a reason is never rendered: it is matched against a fixed
// allowlist of category prefixes (the same ones moderation.js triages on) and
// only the CATEGORY LABEL is returned. Anything unrecognised is 'other'.
const CATEGORIES = [
  { label: 'child safety', test: /^csae/i },
  { label: 'self-harm', test: /self[_-]?harm|suicide/i },
  { label: 'threats or violence', test: /threat|violence/i },
  { label: 'underage', test: /underage|minor/i },
  { label: 'harassment or hate', test: /harassment|hate/i },
  { label: 'unsafe drinking', test: /unsafe_drinking/i },
  { label: 'spam', test: /spam/i },
  { label: 'impersonation', test: /impersonat/i },
];

function categoryOf(reason) {
  const s = String(reason || '');
  for (const c of CATEGORIES) if (c.test.test(s)) return c.label;
  return 'other';
}

export function reportTallyFor(memberId, reports) {
  const id = Number(memberId);
  const rows = Array.isArray(reports) ? reports : [];
  if (!Number.isFinite(id)) {
    return { received: 0, filed: 0, pendingReceived: 0, categories: [], severe: 0, windowSize: rows.length };
  }
  const received = rows.filter((r) => r?.target_type === 'user' && Number(r?.target_id) === id);
  const filed = rows.filter((r) => Number(r?.reporter_id) === id);
  const categories = [...new Set(received.map((r) => categoryOf(r?.reason)))].sort();
  return {
    received: received.length,
    filed: filed.length,
    pendingReceived: received.filter((r) => r?.status === 'pending').length,
    categories,
    // Worth surfacing on its own: these are the ones moderation.js floors to P0.
    severe: received.filter((r) => /^csae/i.test(String(r?.reason || ''))).length,
    windowSize: rows.length,
  };
}
