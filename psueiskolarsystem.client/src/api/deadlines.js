const API = '/api/deadlines';

export async function getDeadlines(token, { academicYear, semester } = {}) {
  const params = new URLSearchParams();
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  const res = await fetch(`${API}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load deadlines.');
  return res.json();
}

export async function upsertDeadline(data, token) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to save deadline.');
  }
  return res.json();
}

export async function deleteDeadline(id, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove deadline.');
}

export async function getDeadlineReport(token, { academicYear, semester }) {
  const params = new URLSearchParams({ academicYear, semester });
  const res = await fetch(`${API}/report?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load compliance report.');
  return res.json();
}
