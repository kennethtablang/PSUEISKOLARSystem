export async function getAnalyticsOverview(token, { academicYear, semester } = {}) {
  const params = new URLSearchParams();
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetch(`/api/analytics/overview${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load analytics.');
  return res.json();
}

// One row per academic period (oldest → newest) for the stacked-area comparison charts.
export async function getAnalyticsTrends(token) {
  const res = await fetch('/api/analytics/trends', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load period trends.');
  return res.json();
}
