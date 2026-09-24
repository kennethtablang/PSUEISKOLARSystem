import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/campuses';

// Anonymous-friendly: the sign-up form reads this without a token.
export async function getCampuses(token, { includeInactive = false } = {}) {
  const qs = includeInactive ? '?includeInactive=true' : '';
  return apiGet(`${API}${qs}`, token, 'Failed to load campuses.');
}

export async function createCampus(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to add the campus.');
}

export async function updateCampus(id, data, token) {
  return apiSend(`${API}/${id}`, 'PUT', data, token, 'Failed to update the campus.');
}

export async function setCampusPrograms(id, programIds, token) {
  return apiSend(`${API}/${id}/programs`, 'PUT', { programIds }, token, 'Failed to save the campus programs.');
}

export async function deleteCampus(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to delete the campus.');
}

export async function createProgram(data, token) {
  return apiSend(`${API}/programs`, 'POST', data, token, 'Failed to add the program.');
}

export async function updateProgram(id, data, token) {
  return apiSend(`${API}/programs/${id}`, 'PUT', data, token, 'Failed to update the program.');
}

export async function deleteProgram(id, token) {
  return apiDelete(`${API}/programs/${id}`, token, 'Failed to delete the program.');
}
