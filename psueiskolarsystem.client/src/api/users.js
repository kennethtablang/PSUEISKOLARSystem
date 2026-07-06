const API = '/api/users';

export async function getUsers(token, { role, campusId, search, isActive, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (role) params.set('role', role);
  if (campusId) params.set('campusId', campusId);
  if (search) params.set('search', search);
  if (isActive !== undefined && isActive !== '') params.set('isActive', isActive);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load users.');
  return res.json(); // { total, page, pageSize, items }
}

export async function updateUser(id, data, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Update failed.');
  }
}

export async function setUserStatus(id, isActive, token) {
  const res = await fetch(`${API}/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(isActive),
  });
  if (!res.ok) throw new Error('Failed to update status.');
}

export async function deleteUser(id, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete user.');
}

export async function sendPasswordReset(id, token) {
  const res = await fetch(`${API}/${id}/send-password-reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Failed to send password reset.');
  return data;
}
