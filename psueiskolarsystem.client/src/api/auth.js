import { errorMessage } from './_error';

const API = '/api/auth';

export async function login(email, password) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Login failed.');
  }
  return res.json();
}

export async function getMe(token) {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session expired.');
  return res.json();
}

export async function updateProfile(data, token) {
  const res = await fetch(`${API}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Update failed.');
  }
  return res.json();
}

export async function acceptConsent(token) {
  const res = await fetch(`${API}/accept-consent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to record consent.');
  return res.json();
}

export async function updateNotificationPreferences(prefs, token) {
  const res = await fetch(`${API}/notification-preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error('Failed to save preferences.');
}

export async function registerScholar(data) {
  const res = await fetch(`${API}/register-scholar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(errorMessage(err, 'Registration failed.'));
  }
  return res.json();
}

export async function verifyEmail(email, token) {
  const params = new URLSearchParams({ email, token });
  const res = await fetch(`${API}/verify-email?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Verification failed.');
  }
  return res.json();
}

export async function forgotPassword(email) {
  const res = await fetch(`${API}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Request failed.');
  }
  return res.json();
}

export async function checkEmailAvailable(email, signal) {
  const res = await fetch(`${API}/email-available?email=${encodeURIComponent(email)}`, { signal });
  if (!res.ok) throw new Error('Check failed.');
  const data = await res.json();
  return data.available;
}

export async function resendVerification(email) {
  const res = await fetch(`${API}/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Request failed.');
  }
  return res.json();
}

export async function resetPassword(email, token, newPassword) {
  const res = await fetch(`${API}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Reset failed.');
  }
  return res.json();
}

export async function verifyTwoFactorLogin(ticket, code) {
  const res = await fetch(`${API}/login-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Invalid authentication code.');
  }
  return res.json();
}

export async function enable2fa(token) {
  const res = await fetch(`${API}/2fa/enable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to enable 2FA.');
  }
  return res.json();
}

export async function disable2fa(password, token) {
  const res = await fetch(`${API}/2fa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to disable 2FA.');
  }
  return res.json();
}

export async function register(data, token) {
  const res = await fetch(`${API}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(errorMessage(err, 'Registration failed.'));
  }
  return res.json();
}
