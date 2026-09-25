// client/src/admin/platform/errors.js
//
// Surface what the SERVER said. `err.message` from axios is "Request failed
// with status code 403" — true, useless, and it hides the sentence the route
// actually wrote for this admin ("Your role does not allow that.").

/**
 * @param {unknown} err       an axios error
 * @param {string}  fallback  what to say when the server said nothing usable
 */
export function apiError(err, fallback = 'Something went wrong.') {
  const res = err && typeof err === 'object' ? err.response : null;
  const data = res?.data;

  let msg = null;
  if (data && typeof data === 'object' && typeof data.error === 'string' && data.error.trim()) {
    msg = data.error.trim();
  }

  if (!msg) {
    // No JSON body: a proxy/HTML error page, a CORS failure, or the network.
    if (!res) return fallback;
    if (res.status === 403) return 'Your role does not allow that.';
    if (res.status === 401) return 'Your admin session is not valid.';
    return fallback;
  }

  // requirePermission() returns the permission it wanted. Saying which one is
  // the difference between "ask someone" and "ask someone for flags.write".
  if (data && typeof data.required === 'string') msg += ` (needs ${data.required})`;
  if (data && typeof data.required_field === 'string') msg += ` (field: ${data.required_field})`;
  return msg;
}

/** True when the request never reached a responding server. */
export function isOffline(err) {
  return !!err && typeof err === 'object' && !err.response;
}
