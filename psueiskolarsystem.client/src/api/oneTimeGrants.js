import { errorMessage } from './_error';

const API = '/api/one-time-grants';

export async function getOneTimeGrants(token, { scholarId, status, search, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (scholarId) params.set('scholarId', scholarId);
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load one-time grants.');
  return res.json(); // { total, totalAmount, releasedAmount, pendingAmount, items, … }
}

export async function getOneTimeGrantSummary(token) {
  const res = await fetch(`${API}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load grant summary.');
  return res.json();
}

export async function createOneTimeGrant(data, token) {
  return send(API, 'POST', data, token, 'Failed to record the grant.');
}

export async function updateOneTimeGrant(id, data, token) {
  return send(`${API}/${id}`, 'PUT', data, token, 'Failed to update the grant.');
}

export async function releaseOneTimeGrant(id, { referenceNo, releasedAt } = {}, token) {
  return send(`${API}/${id}/release`, 'PATCH', { referenceNo: referenceNo || null, releasedAt: releasedAt || null }, token, 'Failed to release the grant.');
}

export async function cancelOneTimeGrant(id, reason, token) {
  return send(`${API}/${id}/cancel`, 'PATCH', { reason }, token, 'Failed to cancel the grant.');
}

export async function deleteOneTimeGrant(id, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(errorMessage(body, 'Failed to delete the grant.'));
  }
}

async function send(url, method, body, token, fallback) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(errorMessage(err, fallback));
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}
