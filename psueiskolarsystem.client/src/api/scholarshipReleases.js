import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/scholarship-releases';

export async function getScholarshipReleases(token, {
  scholarshipTypeId, academicYear, semester, status, search, page = 1, pageSize = 20,
} = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (scholarshipTypeId) params.set('scholarshipTypeId', scholarshipTypeId);
  if (academicYear) params.set('academicYear', academicYear);
  if (semester != null) params.set('semester', semester);
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  return apiGet(`${API}?${params}`, token, 'Failed to load scholarship releases.');
}

/**
 * The monitor: every scholar holding a scholarship type in one period, each with the
 * status of their payout — Released, Pending, Cancelled, or NotRecorded.
 */
export async function getReleaseMonitor(token, { scholarshipTypeId, academicYear, semester, campusId, yearLevel }) {
  const params = new URLSearchParams({ scholarshipTypeId, academicYear, semester });
  if (campusId) params.set('campusId', campusId);
  if (yearLevel) params.set('yearLevel', yearLevel);
  return apiGet(`${API}/monitor?${params}`, token, 'Failed to load the release monitor.');
}

export async function getReleasePeriods(token) {
  return apiGet(`${API}/periods`, token, 'Failed to load academic periods.');
}

export async function getScholarReleases(scholarId, token) {
  return apiGet(`${API}/scholar/${scholarId}`, token, 'Failed to load scholarship releases.');
}

export async function recordScholarshipRelease(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to record the release.');
}

/** Opens a pending row for every holder of the type who has none for the period. */
export async function generateScholarshipReleases(data, token) {
  return apiSend(`${API}/generate`, 'POST', data, token, 'Failed to open the releases.');
}

/**
 * Schedules one scholarship type's payout for a period: the campuses receiving on the date,
 * the year level paid, and optionally a hand-picked set of scholars.
 */
export async function scheduleScholarshipReleases(data, token) {
  return apiSend(`${API}/schedule`, 'POST', data, token, 'Failed to schedule the release.');
}

/** Marks several pending releases as released in one step. */
export async function releaseScholarshipBatch({ releaseIds, releasedAt, referenceNo }, token) {
  return apiSend(`${API}/release-batch`, 'POST',
    { releaseIds, releasedAt: releasedAt || null, referenceNo: referenceNo || null },
    token, 'Failed to mark the releases as released.');
}

export async function releaseScholarship(id, { referenceNo, releasedAt } = {}, token) {
  return apiSend(`${API}/${id}/release`, 'PATCH',
    { referenceNo: referenceNo || null, releasedAt: releasedAt || null },
    token, 'Failed to release the scholarship.');
}

export async function cancelScholarshipRelease(id, reason, token) {
  return apiSend(`${API}/${id}/cancel`, 'PATCH', { reason }, token, 'Failed to cancel the release.');
}

export async function deleteScholarshipRelease(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to delete the release.');
}
