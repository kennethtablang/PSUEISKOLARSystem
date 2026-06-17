export async function getCampuses(token) {
  const res = await fetch('/api/campus', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load campuses.');
  return res.json();
}
