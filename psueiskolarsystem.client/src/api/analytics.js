export async function getAnalyticsOverview(token, { campusId, academicYear, semester } = {}) {
  const params = new URLSearchParams();
  if (campusId) params.set('campusId', campusId);
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetch(`/api/analytics/overview${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load analytics.');
  return res.json();
}
