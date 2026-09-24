import { apiGet } from './_client';

export async function getAnalyticsOverview(token, { academicYear, semester } = {}) {
  const params = new URLSearchParams();
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  const qs = params.toString() ? `?${params}` : '';
  return apiGet(`/api/analytics/overview${qs}`, token, 'Failed to load analytics.');
}

/**
 * Scholarship money: recurring releases (per semester / per year) plus one-off grants,
 * reported separately. Honours the same period filter as the overview.
 */
export async function getAnalyticsDisbursements(token, { academicYear, semester } = {}) {
  const params = new URLSearchParams();
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  const qs = params.toString() ? `?${params}` : '';
  return apiGet(`/api/analytics/disbursements${qs}`, token, 'Failed to load disbursement figures.');
}

// One row per academic period (oldest → newest) for the stacked-area comparison charts.
export async function getAnalyticsTrends(token) {
  return apiGet('/api/analytics/trends', token, 'Failed to load period trends.');
}

// Profile make-up from the Scholar's Data sheet. population: 'scholars' | 'grantees' | 'all'.
export async function getAnalyticsDemographics(token, { population = 'scholars', campusId } = {}) {
  const params = new URLSearchParams({ population });
  if (campusId) params.set('campusId', campusId);
  return apiGet(`/api/analytics/demographics?${params}`, token, 'Failed to load demographics.');
}

// Grantee accounts and grants by type, campus and month.
export async function getAnalyticsGrantees(token, { campusId } = {}) {
  const qs = campusId ? `?campusId=${encodeURIComponent(campusId)}` : '';
  return apiGet(`/api/analytics/grantees${qs}`, token, 'Failed to load grantee analytics.');
}
