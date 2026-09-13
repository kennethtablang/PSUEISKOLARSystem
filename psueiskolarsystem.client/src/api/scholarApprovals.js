import { apiGet, apiSend } from './_client';

const API = '/api/scholar-approvals';

export async function getScholarApprovals(token, { status, search, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  // { total, page, pageSize, totalPages, items }
  return apiGet(`${API}?${params}`, token, 'Failed to load scholar registrations.');
}

export async function getPendingApprovalCount(token) {
  const { count } = await apiGet(`${API}/pending-count`, token, 'Failed to load pending count.');
  return count;
}

export async function approveScholar(userId, note, token) {
  return decide(userId, 'approve', note, token);
}

export async function rejectScholar(userId, note, token) {
  return decide(userId, 'reject', note, token);
}

async function decide(userId, action, note, token) {
  return apiSend(`${API}/${userId}/${action}`, 'POST', { note: note || null }, token,
    `Failed to ${action} the registration.`);
}
