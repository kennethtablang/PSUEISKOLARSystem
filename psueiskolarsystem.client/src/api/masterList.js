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

export async function downloadMasterListTemplate(token) {
  const res = await apiFetch(`${API}/template.xlsx`, { token, fallback: 'Failed to download template.' });
  triggerDownload(await res.blob(), 'master_list_template.xlsx');
}

export async function importMasterList(file, token) {
  const body = new FormData();
  body.append('file', file);
  return apiForm(`${API}/import`, body, token, 'Import failed.');
}
