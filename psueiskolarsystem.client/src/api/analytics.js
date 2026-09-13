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
