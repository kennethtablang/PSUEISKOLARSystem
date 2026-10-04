import { apiFetch, apiGet, apiSend, apiDelete, apiForm } from './_client';
import { triggerDownload } from './userImport';

const API = '/api/master-list';

export async function getMasterList(token, {
  kind, status, campusId, scholarshipTypeId, grantTypeId, search, page = 1, pageSize = 20,
} = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (kind) params.set('kind', kind);
  if (status) params.set('status', status);
  if (campusId) params.set('campusId', campusId);
  if (scholarshipTypeId) params.set('scholarshipTypeId', scholarshipTypeId);
  if (grantTypeId) params.set('grantTypeId', grantTypeId);
  if (search) params.set('search', search);
  return apiGet(`${API}?${params}`, token, 'Failed to load the master list.');
}

export async function createMasterListLine(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to add the line.');
}

export async function updateMasterListLine(id, data, token) {
  return apiSend(`${API}/${id}`, 'PUT', data, token, 'Failed to update the line.');
}

export async function deleteMasterListLine(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to remove the line.');
}

/** Excel template; from inside a type (`{ scholarshipTypeId }` or `{ grantTypeId }`) it is for that type. */
export async function downloadMasterListTemplate(token, scope = {}) {
  const params = new URLSearchParams();
  if (scope.scholarshipTypeId) params.set('scholarshipTypeId', scope.scholarshipTypeId);
  if (scope.grantTypeId) params.set('grantTypeId', scope.grantTypeId);
  const res = await apiFetch(`${API}/template.xlsx?${params}`, { token, fallback: 'Failed to download template.' });
  triggerDownload(await res.blob(), 'cross_matching_template.xlsx');
}

/** Imports lines; with a scope every row goes on that scholarship / grant type's list. */
export async function importMasterList(file, token, scope = {}) {
  const body = new FormData();
  body.append('file', file);
  const params = new URLSearchParams();
  if (scope.scholarshipTypeId) params.set('scholarshipTypeId', scope.scholarshipTypeId);
  if (scope.grantTypeId) params.set('grantTypeId', scope.grantTypeId);
  return apiForm(`${API}/import?${params}`, body, token, 'Import failed.');
}

/** The Master List page: one row per student across every scholarship and grant list. */
export async function getMasterListPeople(token, { page = 1, pageSize = 20, ...filters } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  for (const [k, v] of Object.entries(filters)) if (v !== '' && v != null) params.set(k, v);
  return apiGet(`${API}/people?${params}`, token, 'Failed to load the master list.');
}

/** Scholars matched again by another scholarship type's cross-matching list. */
export async function getCrossMatchConflicts(token) {
  return apiGet(`${API}/conflicts`, token, 'Failed to load cross-matching alerts.');
}
