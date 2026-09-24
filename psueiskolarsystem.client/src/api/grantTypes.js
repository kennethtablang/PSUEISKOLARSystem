import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/grant-types';

export async function getGrantTypes(token) {
  return apiGet(API, token, 'Failed to load grant types.');
}

export async function createGrantType(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to add the grant type.');
}

export async function updateGrantType(id, data, token) {
  return apiSend(`${API}/${id}`, 'PUT', data, token, 'Failed to update the grant type.');
}

/** Closes the type and deactivates the grantee accounts under it. */
export async function deactivateGrantType(id, token) {
  return apiSend(`${API}/${id}/deactivate`, 'PATCH', {}, token, 'Failed to deactivate the grant type.');
}

export async function activateGrantType(id, token) {
  return apiSend(`${API}/${id}/activate`, 'PATCH', {}, token, 'Failed to reactivate the grant type.');
}

export async function deleteGrantType(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to delete the grant type.');
}
