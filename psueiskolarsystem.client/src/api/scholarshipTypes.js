import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/scholarship-types';

export async function getScholarshipTypes(token) {
  return apiGet(API, token, 'Failed to load scholarship types.');
}

// Full detail for the read-only view modal: requirement breakdown + scholar figures.
export async function getScholarshipType(id, token) {
  return apiGet(`${API}/${id}`, token, 'Failed to load scholarship type.');
}

// Documents that belong only to this scholarship type.
export async function getOtherDocuments(id, token) {
  return apiGet(`${API}/${id}/other-documents`, token, 'Failed to load additional documents.');
}

export async function createScholarshipType(data, token) {
  return apiSend(API, 'POST', data, token, 'Create failed.');
}

export async function updateScholarshipType(id, data, token) {
  return apiSend(`${API}/${id}`, 'PUT', data, token, 'Update failed.');
}

export async function toggleScholarshipTypeActive(id, token) {
  return apiSend(`${API}/${id}/toggle-active`, 'PATCH', undefined, token, 'Toggle failed.');
}

export async function deleteScholarshipType(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Delete failed.');
}

// The documents a type's scholars submit: ticked shared documents plus the type's own.
export async function updateScholarshipTypeDocuments(id, data, token) {
  return apiSend(`${API}/${id}/documents`, 'PUT', data, token, 'Failed to save the required documents.');
}
