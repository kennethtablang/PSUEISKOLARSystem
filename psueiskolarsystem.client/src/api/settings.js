export async function getActiveSemester(token) {
  const res = await fetch('/api/active-semester', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load active semester.');
  return res.json();
}

export async function setActiveSemester(data, token) {
  const res = await fetch('/api/active-semester', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update active semester.');
  }
  return res.json();
}
