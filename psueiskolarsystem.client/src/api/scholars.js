import { errorMessage } from './_error';

const API = '/api/scholars';

export async function getScholars(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.programId) params.set('programId', filters.programId);
  if (filters.scholarshipTypeId) params.set('scholarshipTypeId', filters.scholarshipTypeId);
  if (filters.search) params.set('search', filters.search);
  if (filters.meetsRequirement !== undefined && filters.meetsRequirement !== '') params.set('meetsRequirement', filters.meetsRequirement);
  if (filters.lifecycleStatus) params.set('lifecycleStatus', filters.lifecycleStatus);
  if (filters.approvalStatus) params.set('approvalStatus', filters.approvalStatus);
  if (filters.page) params.set('page', filters.page);
  if (filters.pageSize) params.set('pageSize', filters.pageSize);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load scholars.');
  // Returns { total, page, pageSize, totalPages, items }
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
    throw new Error(errorMessage(err, 'Failed to save profile.'));
  }
}

export async function setLifecycleStatus(userId, status, token) {
  const res = await fetch(`${API}/${userId}/lifecycle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update status.');
  }
}

// Every scholarship this scholar has ever been registered under; exactly one row
// should have isActive = true (the "strictly one scholarship" rule).
export async function getScholarshipHistory(userId, token) {
  const res = await fetch(`${API}/${userId}/scholarship-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load scholarship history.');
  return res.json();
}

// Verification report: scholars whose scholarship records need a second look.
export async function getScholarshipVerification(token) {
  const res = await fetch(`${API}/scholarship-verification`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load the scholarship verification report.');
  return res.json();
}

export async function exportScholarData(userId, token) {
  const res = await fetch(`${API}/${userId}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to export data.');
  return res.json();
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
    throw new Error(errorMessage(err, 'Failed to add grade.'));
  }
  return res.json();
}
