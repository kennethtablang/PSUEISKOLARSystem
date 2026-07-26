const API = '/api/avatars';

/* Profile photos. The server only stores a flag on the user record (hasAvatar); the image
   itself is fetched here as a blob URL because the endpoint needs the bearer token.

   Blob URLs are cached per user for the life of the page — the same face appears in the
   navbar, the scholar list, and the review queue, and re-fetching it each time would be
   wasteful. The cache lives here rather than in the component so that Avatar.jsx exports
   nothing but its component (React Fast Refresh). */
const cache = new Map();

export async function getAvatar(userId, token) {
  const res = await fetch(`${API}/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
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
  return remove(`${API}/me`, token);
}

export async function deleteAvatarFor(userId, token) {
  return remove(`${API}/${userId}`, token);
}

async function upload(url, file, token) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to upload the photo.');
  }
  return res.json();
}

async function remove(url, token) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove the photo.');
}
