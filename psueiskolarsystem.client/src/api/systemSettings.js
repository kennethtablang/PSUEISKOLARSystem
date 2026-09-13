import { apiGet, apiSend } from './_client';

const API = '/api/system-settings';

export async function getSystemSettings(token) {
  return apiGet(API, token, 'Failed to load system settings.');
}

export async function saveSystemSettings(data, token) {
  return apiSend(API, 'PUT', data, token, 'Failed to save system settings.');
}

/**
 * The sliver of policy the client needs before anyone has authenticated: whether the system
 * is in maintenance, the default session timeout, and the upload policy the file picker has
 * to agree with. Anonymous by necessity.
 */
export async function getPublicSettings() {
  return apiGet(`${API}/public`, null, 'Failed to load system status.');
}
