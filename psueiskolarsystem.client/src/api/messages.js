import { apiGet, apiSend } from './_client';

const API = '/api/messages';

export async function getThreads(token, { scholarId } = {}) {
  const params = new URLSearchParams();
  if (scholarId) params.set('scholarId', scholarId);
  return apiGet(`${API}/threads?${params}`, token, 'Failed to load conversations.');
}

export async function getThread(token, { scholarId, requirementId }) {
  const params = new URLSearchParams({ scholarId });
  if (requirementId != null) params.set('requirementId', requirementId);
  return apiGet(`${API}/thread?${params}`, token, 'Failed to load conversation.');
}

export async function sendMessage(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to send message.');
}

export async function getMessageUnreadCount(token) {
  return apiGet(`${API}/unread-count`, token, 'Failed to load unread count.');
}
