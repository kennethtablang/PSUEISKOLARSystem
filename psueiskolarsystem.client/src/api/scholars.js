import { apiFetch, apiGet, apiSend, apiDelete } from './_client';

const API = '/api/scholars';

export async function getScholars(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.programId) params.set('programId', filters.programId);
  if (filters.scholarshipTypeId) params.set('scholarshipTypeId', filters.scholarshipTypeId);
  if (filters.search) params.set('search', filters.search);
  if (filters.meetsRequirement !== undefined && filters.meetsRequirement !== '') params.set('meetsRequirement', filters.meetsRequirement);
  if (filters.lifecycleStatus) params.set('lifecycleStatus', filters.lifecycleStatus);
  if (filters.approvalStatus) params.set('approvalStatus', filters.approvalStatus);
  if (filters.page) params.set('page', filters.page);
  if (filters.pageSize) params.set('pageSize', filters.pageSize);
  // Returns { total, page, pageSize, totalPages, items }
  return apiGet(`${API}?${params}`, token, 'Failed to load scholars.');
}

export async function getScholarProfile(userId, token) {
  // A scholar with no profile row yet is an ordinary state, not an error — the onboarding
  // gate exists precisely to fill it in.
  const res = await apiFetch(`${API}/${userId}`, {
    token, fallback: 'Failed to load scholar profile.', expect: [404],
  });
  return res.status === 404 ? null : res.json();
}

export async function upsertScholarProfile(userId, data, token) {
  return apiSend(`${API}/${userId}`, 'PUT', data, token, 'Failed to save profile.');
}

export async function setLifecycleStatus(userId, status, token) {
  return apiSend(`${API}/${userId}/lifecycle`, 'PATCH', { status }, token, 'Failed to update status.');
}

// Every scholarship this scholar has ever been registered under; exactly one row
// should have isActive = true (the "strictly one scholarship" rule).
export async function getScholarshipHistory(userId, token) {
  return apiGet(`${API}/${userId}/scholarship-history`, token, 'Failed to load scholarship history.');
}

// Verification report: scholars whose scholarship records need a second look.
export async function getScholarshipVerification(token) {
  return apiGet(`${API}/scholarship-verification`, token,
    'Failed to load the scholarship verification report.');
}

export async function exportScholarData(userId, token) {
  return apiGet(`${API}/${userId}/export`, token, 'Failed to export data.');
}

export async function getGrades(userId, token) {
  return apiGet(`${API}/${userId}/grades`, token, 'Failed to load grades.');
}

export async function addGrade(userId, data, token) {
  return apiSend(`${API}/${userId}/grades`, 'POST', data, token, 'Failed to add grade.');
}

export async function updateGrade(userId, gradeId, data, token) {
  return apiSend(`${API}/${userId}/grades/${gradeId}`, 'PATCH', data, token, 'Failed to update grade.');
}

export async function deleteGrade(userId, gradeId, token) {
  return apiDelete(`${API}/${userId}/grades/${gradeId}`, token, 'Failed to remove grade.');
}
