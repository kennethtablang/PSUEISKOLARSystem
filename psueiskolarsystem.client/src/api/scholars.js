const API = '/api/scholars';

export async function getScholars(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.campusId) params.set('campusId', filters.campusId);
  if (filters.programId) params.set('programId', filters.programId);
  if (filters.scholarshipTypeId) params.set('scholarshipTypeId', filters.scholarshipTypeId);
  if (filters.search) params.set('search', filters.search);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load scholars.');
  return res.json();
}

export async function getScholarProfile(userId, token) {
  const res = await fetch(`${API}/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load scholar profile.');
  return res.json();
}

export async function upsertScholarProfile(userId, data, token) {
  const res = await fetch(`${API}/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to save profile.');
  }
}

export async function getGrades(userId, token) {
  const res = await fetch(`${API}/${userId}/grades`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load grades.');
  return res.json();
}

export async function addGrade(userId, data, token) {
  const res = await fetch(`${API}/${userId}/grades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to add grade.');
  }
  return res.json();
}
