import { apiFetch, apiGet } from './_client';

const API = '/api/audit-log';

export async function getAuditLog(token, { page = 1, pageSize = 50, search, action } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (search)  params.set('search', search);
  if (action)  params.set('action', action);
  return apiGet(`${API}?${params}`, token, 'Failed to load activity log.');
}

export async function getRecentActivity(token, take = 8) {
  return apiGet(`${API}/recent?take=${take}`, token, 'Failed to load recent activity.');
}

export async function exportAuditLog(token, { search, action } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (action) params.set('action', action);
  const qs = params.toString() ? `?${params}` : '';
  const res = await apiFetch(`${API}/export.xlsx${qs}`, { token, fallback: 'Export failed.' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await res.blob());
  link.download = `activity_log_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function getDistinctActions(token) {
  return apiGet(`${API}/actions`, token, 'Failed to load actions.');
}
