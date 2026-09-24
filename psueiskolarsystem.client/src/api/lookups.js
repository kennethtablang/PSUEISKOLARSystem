import { apiGet } from './_client';

// campusId narrows the list to the courses that campus offers.
export async function getPrograms(token, campusId) {
  const qs = campusId ? `?campusId=${encodeURIComponent(campusId)}` : '';
  return apiGet(`/api/lookups/programs${qs}`, token, 'Failed to load programs.');
}

export async function getScholarshipTypes(token) {
  return apiGet('/api/lookups/scholarship-types', token, 'Failed to load scholarship types.');
}

// Scholar picker feed for the announcement recipient selector and the staff-side
// "new conversation" dialog.
export async function searchScholars(token, { search, limit = 50, includeGrantees = false } = {}) {
  const params = new URLSearchParams({ limit });
  if (includeGrantees) params.set('includeGrantees', 'true');
  if (search) params.set('search', search);
  return apiGet(`/api/lookups/scholars?${params}`, token, 'Failed to load scholars.');
}
