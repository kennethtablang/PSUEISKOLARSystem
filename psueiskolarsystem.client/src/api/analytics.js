export async function getAnalyticsOverview(token, { campusId } = {}) {
  const params = campusId ? `?campusId=${campusId}` : '';
  const res = await fetch(`/api/analytics/overview${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load analytics.');
  return res.json();
}
