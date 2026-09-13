import { apiGet, apiSend, apiDelete } from './_client';

const API = '/api/deadlines';

export async function getDeadlines(token, { academicYear, semester } = {}) {
  const params = new URLSearchParams();
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  return apiGet(`${API}?${params}`, token, 'Failed to load deadlines.');
}

export async function upsertDeadline(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to save deadline.');
}

export async function deleteDeadline(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to remove deadline.');
}

export async function getDeadlineReport(token, { academicYear, semester }) {
  const params = new URLSearchParams({ academicYear, semester });
  return apiGet(`${API}/report?${params}`, token, 'Failed to load compliance report.');
}
