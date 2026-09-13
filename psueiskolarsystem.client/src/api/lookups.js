import { apiGet } from './_client';

export async function getPrograms(token) {
  return apiGet('/api/lookups/programs', token, 'Failed to load programs.');
}

export async function getScholarshipTypes(token) {
  return apiGet('/api/lookups/scholarship-types', token, 'Failed to load scholarship types.');
}

// Scholar picker feed for the announcement recipient selector and the staff-side
// "new conversation" dialog.
export async function searchScholars(token, { search, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit });
  if (search) params.set('search', search);
  return apiGet(`/api/lookups/scholars?${params}`, token, 'Failed to load scholars.');
}
