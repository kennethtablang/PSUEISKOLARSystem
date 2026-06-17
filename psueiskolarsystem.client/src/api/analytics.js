export async function getAnalyticsOverview(token) {
  const res = await fetch('/api/analytics/overview', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load analytics.');
  return res.json();
}
