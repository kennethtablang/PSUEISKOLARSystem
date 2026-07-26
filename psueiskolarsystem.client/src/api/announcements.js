const API = '/api/announcements';

// Intended-action keys → scholar-facing button label + route.
export const ANNOUNCEMENT_INTENTS = {
  SubmitDocuments:    { label: 'Submit Documents',     to: '/my-documents' },
  UpdateProfile:      { label: 'Update My Profile',    to: '/my-profile' },
  ContactCoordinator: { label: 'Message Coordinator',  to: '/messages' },
};

export async function uploadAnnouncementImage(id, file, token) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/${id}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to upload image.');
  }
  return res.json();
}

export async function getAnnouncementImage(id, token) {
  const res = await fetch(`${API}/${id}/image`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Image not available.');
  return URL.createObjectURL(await res.blob());
}

export async function deleteAnnouncementImage(id, token) {
  const res = await fetch(`${API}/${id}/image`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove image.');
}

export async function getAnnouncements(token) {
  const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load announcements.');
  return res.json();
}

export async function createAnnouncement(data, token) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create announcement.');
  }
  return res.json();
}

export async function updateAnnouncement(id, data, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update announcement.');
  }
}

// Release a scheduled announcement immediately instead of waiting for its publish time.
export async function publishAnnouncementNow(id, token) {
  const res = await fetch(`${API}/${id}/publish-now`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to publish the announcement.');
  }
  return res.json();
}

export async function deleteAnnouncement(id, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete announcement.');
}
