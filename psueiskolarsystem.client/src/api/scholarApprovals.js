import { errorMessage } from './_error';

const API = '/api/scholar-approvals';

export async function getScholarApprovals(token, { status, search, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load scholar registrations.');
  return res.json(); // { total, page, pageSize, totalPages, items }
}

export async function getPendingApprovalCount(token) {
  const res = await fetch(`${API}/pending-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load pending count.');
  const { count } = await res.json();
  return count;
}

export async function approveScholar(userId, note, token) {
  return decide(userId, 'approve', note, token);
}

export async function rejectScholar(userId, note, token) {
  return decide(userId, 'reject', note, token);
}

async function decide(userId, action, note, token) {
  const res = await fetch(`${API}/${userId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note: note || null }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorMessage(body, `Failed to ${action} the registration.`));
  return body;
}
