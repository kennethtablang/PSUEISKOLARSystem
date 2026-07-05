const API = '/api/notifications';

export async function getNotifications(token, { unreadOnly = false, category = '', page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ unreadOnly, page, pageSize });
  if (category) params.set('category', category);
  const res = await fetch(`${API}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load notifications.');
  return res.json();
}

export async function getUnreadCount(token) {
  const res = await fetch(`${API}/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load unread count.');
  return res.json();
}

export async function markRead(id, token) {
  const res = await fetch(`${API}/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to mark notification read.');
}

export async function markAllRead(token) {
  const res = await fetch(`${API}/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to mark all read.');
}
