// client/src/admin/platform/flagsApi.js
//
// Every shape here is read off the server, not assumed:
//   GET  /api/admin/flags          → rows of feature_flags + updated_by_name
//                                    { key, enabled 0|1, rollout_pct, targeting (JSON text),
//                                      description, updated_by, updated_at (ms), updated_by_name }
//   PUT  /api/admin/flags/:key     → { ok, key, enabled, rollout_pct }
//   POST /api/admin/flags/:key/kill→ { ok, key, enabled:false }
//   GET  /api/admin/command/health → { db, r2, checked_at, db_error? }
//   GET  /api/health               → { status, runtime, ts, db } (503 when degraded)

import api from '../../api';

export async function listFlags() {
  const r = await api.get('/admin/flags');
  if (!Array.isArray(r.data)) return [];
  // `key` is the primary key and every write is addressed by it; a row without
  // one cannot be edited or killed, so it is dropped rather than rendered into
  // a button that would PUT to /admin/flags/undefined.
  return r.data.filter((row) => row && typeof row.key === 'string' && row.key.length > 0);
}

/**
 * The route is an UPSERT that reads every column off the body:
 * a missing `description` becomes '', a missing `rollout_pct` becomes 0, and a
 * `targeting` that is not an object becomes '{}'. So the caller always sends
 * the complete state of the flag, never a partial patch.
 *
 * flags.write is high-impact — `reason` (>= 8 chars) is required by
 * middleware/adminAuth.js and is what lands in the audit row.
 */
export async function saveFlag(key, { enabled, rollout_pct, targeting, description, reason }) {
  const r = await api.put(`/admin/flags/${encodeURIComponent(key)}`, {
    enabled: !!enabled,
    rollout_pct,
    targeting: targeting && typeof targeting === 'object' ? targeting : {},
    description: description || '',
    reason,
  });
  return r.data;
}

/** Kill switch: enabled = 0 AND rollout_pct = 0, for everyone, immediately. */
export async function killFlag(key, reason) {
  const r = await api.post(`/admin/flags/${encodeURIComponent(key)}/kill`, { reason });
  return r.data;
}

export async function adminHealth() {
  const r = await api.get('/admin/command/health');
  return r.data && typeof r.data === 'object' ? r.data : {};
}

/**
 * The public check answers "can the API actually serve?" and replies 503 —
 * i.e. an axios rejection — precisely when it has the most to say. The
 * degraded body is the payload we want, so it is unwrapped rather than thrown.
 */
export async function publicHealth() {
  try {
    const r = await api.get('/health');
    return r.data && typeof r.data === 'object' ? r.data : {};
  } catch (err) {
    const body = err?.response?.data;
    if (body && typeof body === 'object' && typeof body.status === 'string') return body;
    throw err;
  }
}
