import { apiFetch, apiGet, apiSend, apiDelete, apiForm, apiBlobUrl } from './_client';

const API = '/api/documents';
const REQ_API = '/api/document-requirements';

export async function getRequirements(token, { scholarshipTypeId, sharedOnly } = {}) {
  const params = new URLSearchParams();
  if (scholarshipTypeId) params.set('scholarshipTypeId', scholarshipTypeId);
  // The shared catalog excludes documents owned by a single scholarship type.
  if (sharedOnly) params.set('sharedOnly', 'true');
  return apiGet(`${REQ_API}?${params}`, token, 'Failed to load requirements.');
}

export async function getSubmissions(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.scholarId) params.set('scholarId', filters.scholarId);
  if (filters.requirementId) params.set('requirementId', filters.requirementId);
  if (filters.status) params.set('status', filters.status);
  if (filters.academicYear) params.set('academicYear', filters.academicYear);
  if (filters.semester) params.set('semester', filters.semester);
  return apiGet(`${API}?${params}`, token, 'Failed to load submissions.');
}

// scholarId is for staff filing a document a scholar handed in at the counter; leave it
// out and the submission belongs to whoever is signed in.
export async function uploadDocument(file, requirementId, academicYear, semester, token, scholarId) {
  const form = new FormData();
  form.append('file', file);
  form.append('requirementId', requirementId);
  form.append('academicYear', academicYear);
  form.append('semester', semester);
  if (scholarId) form.append('scholarId', scholarId);
  return apiForm(API, form, token, 'Upload failed.');
}

export async function getPendingDocumentCount(token) {
  const { count } = await apiGet(`${API}/pending-count`, token, 'Failed to load pending count.');
  return count;
}

export async function previewFile(id, token) {
  const res = await apiFetch(`${API}/${id}/preview`, { token, fallback: 'Preview failed.' });
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), contentType: blob.type };
}

export async function downloadFile(id, fileName, token) {
  const res = await apiFetch(`${API}/${id}/download`, { token, fallback: 'Download failed.' });
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function reviewDocument(id, status, feedbackNote, token) {
  return apiSend(`${API}/${id}/review`, 'PATCH', { status, feedbackNote }, token, 'Review failed.');
}

export async function batchReviewDocuments(ids, status, feedbackNote, token) {
  return apiSend(`${API}/batch-review`, 'POST', { ids, status, feedbackNote }, token, 'Batch review failed.');
}

export async function getSubmissionHistory(id, token) {
  return apiGet(`${API}/${id}/history`, token, 'Failed to load history.');
}

export async function deleteSubmission(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Delete failed.');
}

export async function uploadRequirementSample(id, file, token) {
  const form = new FormData();
  form.append('file', file);
  return apiForm(`${REQ_API}/${id}/sample`, form, token, 'Failed to upload sample.');
}

export async function getRequirementSample(id, token) {
  return apiBlobUrl(`${REQ_API}/${id}/sample`, token, 'Sample not available.');
}

export async function deleteRequirementSample(id, token) {
  return apiDelete(`${REQ_API}/${id}/sample`, token, 'Failed to remove sample.');
}

export async function createRequirement(data, token) {
  return apiSend(REQ_API, 'POST', data, token, 'Failed to create requirement.');
}

export async function updateRequirement(id, data, token) {
  return apiSend(`${REQ_API}/${id}`, 'PUT', data, token, 'Failed to update requirement.');
}

export async function deleteRequirement(id, token) {
  return apiDelete(`${REQ_API}/${id}`, token, 'Failed to remove requirement.');
}

// Persist a new checklist order: ids in the order they should appear.
export async function reorderRequirements(orderedIds, token) {
  return apiSend(`${REQ_API}/order`, 'PUT', orderedIds, token, 'Failed to save the new order.');
}

// Existing group headings, for the "group" combo box in the requirement editor.
export async function getRequirementGroups(token) {
  return apiGet(`${REQ_API}/groups`, token, 'Failed to load groups.'); // string[]
}

export async function getRequirementScholarshipTypes(id, token) {
  return apiGet(`${REQ_API}/${id}/scholarship-types`, token, 'Failed to load linked scholarship types.'); // number[]
}

export async function setRequirementScholarshipTypes(id, scholarshipTypeIds, token) {
  return apiSend(`${REQ_API}/${id}/scholarship-types`, 'PUT', scholarshipTypeIds, token,
    'Failed to assign scholarship types.');
}
