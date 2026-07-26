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

// Scholar picker feed for the announcement recipient selector and the staff-side
// "new conversation" dialog.
export async function searchScholars(token, { search, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit });
  if (search) params.set('search', search);
  const res = await fetch(`/api/lookups/scholars?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load scholars.');
  return res.json();
}
