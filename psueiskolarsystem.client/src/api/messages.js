const API = '/api/messages';

export async function getThreads(token, { scholarId } = {}) {
  const params = new URLSearchParams();
  if (scholarId) params.set('scholarId', scholarId);
  const res = await fetch(`${API}/threads?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load conversations.');
  return res.json();
}

export async function getThread(token, { scholarId, requirementId }) {
  const params = new URLSearchParams({ scholarId });
  if (requirementId != null) params.set('requirementId', requirementId);
  const res = await fetch(`${API}/thread?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load conversation.');
  return res.json();
}

export async function sendMessage(data, token) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to send message.');
  }
  return res.json();
}

export async function getMessageUnreadCount(token) {
  const res = await fetch(`${API}/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load unread count.');
  return res.json();
}
