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

export async function getDistinctActions(token) {
  const res = await fetch(`${API}/actions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load actions.');
  return res.json();
}
