import { apiBlobUrl, apiDelete, apiForm } from './_client';

const API = '/api/avatars';

/* Profile photos. The server only stores a flag on the user record (hasAvatar); the image
   itself is fetched here as a blob URL because the endpoint needs the bearer token.

   Blob URLs are cached per user for the life of the page — the same face appears in the
   navbar, the scholar list, and the review queue, and re-fetching it each time would be
   wasteful. The cache lives here rather than in the component so that Avatar.jsx exports
   nothing but its component (React Fast Refresh). */
const cache = new Map();

// A missing photo is the common case, so a failure here resolves to null rather than
// throwing — but a 401 still tears the session down, because it goes through apiFetch.
export async function getAvatar(userId, token) {
  return apiBlobUrl(`${API}/${userId}`, token, 'No photo.').catch(() => null);
}

// Cache-first fetch. Always returns a promise, so callers never set state synchronously.
export function getCachedAvatar(userId, token, { bustCache = false } = {}) {
  if (!bustCache && cache.has(userId)) return Promise.resolve(cache.get(userId));

  return getAvatar(userId, token).then(url => {
    if (url) cache.set(userId, url);
    return url;
  });
}

export function clearAvatarCache(userId) {
  if (userId) {
    URL.revokeObjectURL(cache.get(userId));
    cache.delete(userId);
  } else {
    cache.forEach(URL.revokeObjectURL);
    cache.clear();
  }
}

export async function uploadMyAvatar(file, token) {
  return upload(`${API}/me`, file, token);
}

export async function uploadAvatarFor(userId, file, token) {
  return upload(`${API}/${userId}`, file, token);
}

export async function deleteMyAvatar(token) {
  return apiDelete(`${API}/me`, token, 'Failed to remove the photo.');
}

export async function deleteAvatarFor(userId, token) {
  return apiDelete(`${API}/${userId}`, token, 'Failed to remove the photo.');
}

async function upload(url, file, token) {
  const form = new FormData();
  form.append('file', file);
  return apiForm(url, form, token, 'Failed to upload the photo.');
}
