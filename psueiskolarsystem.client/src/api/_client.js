import { errorMessage } from './_error';

/* The single place every call to the API goes through.

   Before this existed each of the 22 modules in this folder hand-rolled its own `fetch`,
   attached its own Authorization header, and threw a hardcoded string on failure. Two
   things went wrong as a result: the server's actual error message was thrown away, and
   nothing anywhere noticed a 401. A JWT expires after JwtSettings:ExpiryMinutes, which is
   shorter than the configurable inactivity timeout, so a session could die while the client
   still believed it was signed in — every action failing with a generic toast and no way
   back except a manual reload.

   Now a 401 on a call that carried a token is reported to whoever registered the handler
   below (AuthContext), which tears the session down and raises the Session Expired modal. */

let unauthorizedHandler = null;

/** AuthContext registers the session teardown here. Pass null to unregister. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';
const OFFLINE = 'Cannot reach the server. Check your connection and try again.';

function isJson(res) {
  return (res.headers.get('content-type') || '').includes('application/json');
}

/**
 * Performs the request and returns the raw Response, having already thrown on failure.
 * Use this directly only when you need the Response itself (blobs, status inspection);
 * the helpers below cover everything else.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.token]     bearer token; its presence is what makes a 401 mean "expired"
 * @param {*}      [options.body]      serialised as JSON
 * @param {FormData} [options.form]    sent as-is, so the browser sets the multipart boundary
 * @param {number[]} [options.expect]  extra non-2xx statuses to return instead of throwing
 */
export async function apiFetch(url, {
  method = 'GET', token, body, form, fallback = 'Request failed.', signal, expect,
} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(OFFLINE, 0, null);
  }

  if (res.ok || expect?.includes(res.status)) return res;

  // A 401 without a token is an ordinary credential failure (a bad password on the login
  // form). With a token it means the token is gone, expired, or revoked — end the session.
  const expired = res.status === 401 && Boolean(token);
  if (expired) unauthorizedHandler?.();

  const parsed = isJson(res) ? await res.json().catch(() => null) : null;
  throw new ApiError(errorMessage(parsed, expired ? SESSION_EXPIRED : fallback), res.status, parsed);
}

/** Reads a JSON body, tolerating 204s and empty responses. */
async function readJson(res) {
  if (res.status === 204 || res.status === 205) return null;
  if (!isJson(res)) return null;
  return res.json().catch(() => null);
}

export async function apiGet(url, token, fallback, options) {
  return readJson(await apiFetch(url, { token, fallback, ...options }));
}

export async function apiSend(url, method, body, token, fallback) {
  return readJson(await apiFetch(url, { method, body, token, fallback }));
}

export async function apiDelete(url, token, fallback) {
  return readJson(await apiFetch(url, { method: 'DELETE', token, fallback }));
}

/** Multipart upload. `form` is sent untouched so the browser writes the boundary itself. */
export async function apiForm(url, form, token, fallback, method = 'POST') {
  return readJson(await apiFetch(url, { method, form, token, fallback }));
}

/** Fetches a file and hands back an object URL. Callers own revoking it. */
export async function apiBlobUrl(url, token, fallback) {
  const res = await apiFetch(url, { token, fallback });
  return URL.createObjectURL(await res.blob());
}
