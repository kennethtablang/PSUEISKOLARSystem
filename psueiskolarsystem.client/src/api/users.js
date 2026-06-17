const API = '/api/users';

export async function getUsers(token, { role, campusId } = {}) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (campusId) params.set('campusId', campusId);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load users.');
  return res.json();
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
