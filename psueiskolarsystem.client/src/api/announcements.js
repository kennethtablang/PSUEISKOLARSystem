import { apiGet, apiSend, apiDelete, apiForm, apiBlobUrl } from './_client';

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
  return apiForm(`${API}/${id}/image`, form, token, 'Failed to upload image.');
}

export async function getAnnouncementImage(id, token) {
  return apiBlobUrl(`${API}/${id}/image`, token, 'Image not available.');
}

export async function deleteAnnouncementImage(id, token) {
  return apiDelete(`${API}/${id}/image`, token, 'Failed to remove image.');
}

export async function getAnnouncements(token) {
  return apiGet(API, token, 'Failed to load announcements.');
}

export async function createAnnouncement(data, token) {
  return apiSend(API, 'POST', data, token, 'Failed to create announcement.');
}

export async function updateAnnouncement(id, data, token) {
  return apiSend(`${API}/${id}`, 'PUT', data, token, 'Failed to update announcement.');
}

// Release a scheduled announcement immediately instead of waiting for its publish time.
export async function publishAnnouncementNow(id, token) {
  return apiSend(`${API}/${id}/publish-now`, 'POST', undefined, token,
    'Failed to publish the announcement.');
}

export async function deleteAnnouncement(id, token) {
  return apiDelete(`${API}/${id}`, token, 'Failed to delete announcement.');
}
