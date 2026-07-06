const API = '/api/audit-log';

export async function getAuditLog(token, { page = 1, pageSize = 50, search, action } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (search)  params.set('search', search);
  if (action)  params.set('action', action);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load activity log.');
  return res.json();
}

export async function exportAuditLog(token, { search, action } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (action) params.set('action', action);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API}/export.xlsx${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Export failed.');
  }
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `activity_log_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function getDistinctActions(token) {
  const res = await fetch(`${API}/actions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load actions.');
  return res.json();
}
