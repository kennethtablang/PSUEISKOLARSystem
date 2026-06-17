export async function getPrograms(token) {
  const res = await fetch('/api/lookups/programs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load programs.');
  return res.json();
}

export async function getScholarshipTypes(token) {
  const res = await fetch('/api/lookups/scholarship-types', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load scholarship types.');
  return res.json();
}
