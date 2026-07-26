const API = '/api/scholarship-types';

export async function getScholarshipTypes(token) {
  const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load scholarship types.');
  return res.json();
}

// Full detail for the read-only view modal: requirement breakdown + scholar figures.
export async function getScholarshipType(id, token) {
  const res = await fetch(`${API}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load scholarship type.');
  return res.json();
}

// Documents that belong only to this scholarship type.
export async function getOtherDocuments(id, token) {
  const res = await fetch(`${API}/${id}/other-documents`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load additional documents.');
  return res.json();
}

export async function createScholarshipType(data, token) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Create failed.');
  }
  return res.json();
}

export async function updateScholarshipType(id, data, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Update failed.');
  }
}

export async function toggleScholarshipTypeActive(id, token) {
  const res = await fetch(`${API}/${id}/toggle-active`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Toggle failed.');
  }
  return res.json();
}

export async function deleteScholarshipType(id, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Delete failed.');
  }
}
