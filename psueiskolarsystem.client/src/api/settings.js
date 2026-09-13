import { apiGet, apiSend } from './_client';

export async function getActiveSemester(token) {
  return apiGet('/api/active-semester', token, 'Failed to load active semester.');
}

export async function setActiveSemester(data, token) {
  return apiSend('/api/active-semester', 'PUT', data, token, 'Failed to update active semester.');
}

export async function getMessagingSettings(token) {
  return apiGet('/api/messaging-settings', token, 'Failed to load messaging settings.');
}

export async function setMessagingSettings(data, token) {
  return apiSend('/api/messaging-settings', 'PUT', data, token, 'Failed to update messaging settings.');
}
