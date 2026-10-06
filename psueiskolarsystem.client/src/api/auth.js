import { apiFetch, apiGet, apiSend } from './_client';

const API = '/api/auth';

export async function login(email, password) {
  return apiSend(`${API}/login`, 'POST', { email, password }, null, 'Login failed.');
}

export async function getMe(token) {
  return apiGet(`${API}/me`, token, 'Failed to load your account.');
}

export async function updateProfile(data, token) {
  return apiSend(`${API}/profile`, 'PUT', data, token, 'Update failed.');
}

export async function acceptConsent(token) {
  return apiSend(`${API}/accept-consent`, 'POST', undefined, token, 'Failed to record consent.');
}

export async function updateNotificationPreferences(prefs, token) {
  return apiSend(`${API}/notification-preferences`, 'PUT', prefs, token, 'Failed to save preferences.');
}

export async function registerScholar(data) {
  return apiSend(`${API}/register-scholar`, 'POST', data, null, 'Registration failed.');
}

/** Master-list pre-check: { matched, kind, scholarshipTypeName, grantTypeNames, message }. */
export async function checkEligibility(data) {
  return apiSend(`${API}/check-eligibility`, 'POST', data, null, 'Could not check your details.');
}

/**
 * A past grantee now listed as a scholar signs in with their grantee account so it can become
 * their scholar account. Returns what the account holds, to pre-fill the sign-up form:
 * { email, programId, yearLevel, contactNumber, birthDate, address, personal, grantCount }.
 */
export async function lookupGranteeAccount(data) {
  return apiSend(`${API}/grantee-account`, 'POST', data, null, 'Could not sign in to your grantee account.');
}

export async function verifyEmail(email, token) {
  const params = new URLSearchParams({ email, token });
  return apiGet(`${API}/verify-email?${params}`, null, 'Verification failed.');
}

export async function forgotPassword(email) {
  return apiSend(`${API}/forgot-password`, 'POST', { email }, null, 'Request failed.');
}

/** Staff: email a confirmation code to the personal address to recover the account through. */
export async function sendRecoveryEmailCode(email, password, token) {
  return apiSend(`${API}/recovery-email/send-code`, 'POST', { email, password }, token, 'Could not send the code.');
}

/** Staff: the code from that email saves the recovery address. Returns the updated user. */
export async function confirmRecoveryEmail(email, code, token) {
  return apiSend(`${API}/recovery-email/confirm`, 'POST', { email, code }, token, 'Could not confirm the code.');
}

export async function removeRecoveryEmail(password, token) {
  return apiSend(`${API}/recovery-email/remove`, 'POST', { password }, token, 'Could not remove the recovery email.');
}

export async function checkEmailAvailable(email, signal) {
  const res = await apiFetch(`${API}/email-available?email=${encodeURIComponent(email)}`,
    { fallback: 'Check failed.', signal });
  const data = await res.json();
  return data.available;
}

export async function resendVerification(email) {
  return apiSend(`${API}/resend-verification`, 'POST', { email }, null, 'Request failed.');
}

export async function resetPassword(email, token, newPassword) {
  return apiSend(`${API}/reset-password`, 'POST', { email, token, newPassword }, null, 'Reset failed.');
}

export async function verifyTwoFactorLogin(ticket, code) {
  return apiSend(`${API}/login-2fa`, 'POST', { ticket, code }, null, 'Invalid authentication code.');
}

export async function enable2fa(token) {
  return apiSend(`${API}/2fa/enable`, 'POST', undefined, token, 'Failed to enable 2FA.');
}

export async function disable2fa(password, token) {
  return apiSend(`${API}/2fa/disable`, 'POST', { password }, token, 'Failed to disable 2FA.');
}

export async function register(data, token) {
  return apiSend(`${API}/register`, 'POST', data, token, 'Registration failed.');
}
