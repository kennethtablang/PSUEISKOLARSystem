import { apiGet, apiSend } from './_client';

const API = '/api/grantees';

export async function getGrantees(token, { campusId, programId, grantTypeId, active, search, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (campusId) params.set('campusId', campusId);
  if (programId) params.set('programId', programId);
  if (grantTypeId) params.set('grantTypeId', grantTypeId);
  if (active !== undefined && active !== '') params.set('active', active);
  if (search) params.set('search', search);
  return apiGet(`${API}?${params}`, token, 'Failed to load grantees.');
}

export async function getGrantee(userId, token) {
  return apiGet(`${API}/${userId}`, token, 'Failed to load the grantee profile.');
}

export async function updateGrantee(userId, data, token) {
  return apiSend(`${API}/${userId}`, 'PUT', data, token, 'Failed to save the grantee profile.');
}
