import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/notifications';

export async function getNotifications(token, { unreadOnly = false, category = '', page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ unreadOnly, page, pageSize });
  if (category) params.set('category', category);
  return apiGet(`${API}?${params}`, token, 'Failed to load notifications.');
}

export async function getUnreadCount(token) {
  return apiGet(`${API}/unread-count`, token, 'Failed to load unread count.');
}

export async function markRead(id, token) {
  return apiSend(`${API}/${id}/read`, 'PATCH', undefined, token, 'Failed to mark notification read.');
}

export async function markUnread(id, token) {
  return apiSend(`${API}/${id}/unread`, 'PATCH', undefined, token, 'Failed to mark notification unread.');
}

export async function markAllRead(token) {
  return apiSend(`${API}/read-all`, 'PATCH', undefined, token, 'Failed to mark all read.');
}

export async function deleteNotification(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to delete notification.');
}
