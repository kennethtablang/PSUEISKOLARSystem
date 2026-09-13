import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/users';

export async function getUsers(token, { role, search, isActive, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (role) params.set('role', role);
  if (search) params.set('search', search);
  if (isActive !== undefined && isActive !== '') params.set('isActive', isActive);
  return apiGet(`${API}?${params}`, token, 'Failed to load users.'); // { total, page, pageSize, items }
}

export async function updateUser(id, data, token) {
  return apiSend(`${API}/${id}`, 'PUT', data, token, 'Update failed.');
}

export async function setUserStatus(id, isActive, token) {
  return apiSend(`${API}/${id}/status`, 'PATCH', isActive, token, 'Failed to update status.');
}

export async function deleteUser(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to delete user.');
}

export async function sendPasswordReset(id, token) {
  return apiSend(`${API}/${id}/send-password-reset`, 'POST', undefined, token,
    'Failed to send password reset.');
}
