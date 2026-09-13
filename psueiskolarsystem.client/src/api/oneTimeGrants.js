import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/one-time-grants';

export async function getOneTimeGrants(token, { scholarId, scholarshipTypeId, status, search, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (scholarId) params.set('scholarId', scholarId);
  if (scholarshipTypeId) params.set('scholarshipTypeId', scholarshipTypeId);
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  // { total, totalAmount, releasedAmount, pendingAmount, items, … }
  return apiGet(`${API}?${params}`, token, 'Failed to load one-time grants.');
}

export async function getOneTimeGrantSummary(token) {
  return apiGet(`${API}/summary`, token, 'Failed to load grant summary.');
}

export async function createOneTimeGrant(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to record the grant.');
}

export async function updateOneTimeGrant(id, data, token) {
  return apiSend(`${API}/${id}`, 'PUT', data, token, 'Failed to update the grant.');
}

export async function releaseOneTimeGrant(id, { referenceNo, releasedAt } = {}, token) {
  return apiSend(`${API}/${id}/release`, 'PATCH',
    { referenceNo: referenceNo || null, releasedAt: releasedAt || null },
    token, 'Failed to release the grant.');
}

export async function cancelOneTimeGrant(id, reason, token) {
  return apiSend(`${API}/${id}/cancel`, 'PATCH', { reason }, token, 'Failed to cancel the grant.');
}

export async function deleteOneTimeGrant(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to delete the grant.');
}
