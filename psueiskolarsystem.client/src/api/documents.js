const API = '/api/documents';
const REQ_API = '/api/document-requirements';

export async function getRequirements(token, { scholarshipTypeId } = {}) {
  const params = new URLSearchParams();
  if (scholarshipTypeId) params.set('scholarshipTypeId', scholarshipTypeId);
  const res = await fetch(`${REQ_API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load requirements.');
  return res.json();
}

export async function getSubmissions(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.scholarId) params.set('scholarId', filters.scholarId);
  if (filters.requirementId) params.set('requirementId', filters.requirementId);
  if (filters.status) params.set('status', filters.status);
  if (filters.academicYear) params.set('academicYear', filters.academicYear);
  if (filters.semester) params.set('semester', filters.semester);
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load submissions.');
  return res.json();
}

export async function uploadDocument(file, requirementId, academicYear, semester, token) {
  const form = new FormData();
  form.append('file', file);
  form.append('requirementId', requirementId);
  form.append('academicYear', academicYear);
  form.append('semester', semester);
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed.');
  }
  return res.json();
}

export async function previewFile(id, token) {
  const res = await fetch(`${API}/${id}/preview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Preview failed (${res.status}).`);
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), contentType: blob.type };
}

export async function downloadFile(id, fileName, token) {
  const res = await fetch(`${API}/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Download failed.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function reviewDocument(id, status, feedbackNote, token) {
  const res = await fetch(`${API}/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, feedbackNote }),
  });
  if (!res.ok) throw new Error('Review failed.');
}

export async function batchReviewDocuments(ids, status, feedbackNote, token) {
  const res = await fetch(`${API}/batch-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids, status, feedbackNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Batch review failed.');
  }
  return res.json();
}

export async function getSubmissionHistory(id, token) {
  const res = await fetch(`${API}/${id}/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load history.');
  return res.json();
}

export async function deleteSubmission(id, token) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Delete failed.');
  }
}

export async function uploadRequirementSample(id, file, token) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${REQ_API}/${id}/sample`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to upload sample.');
  }
  return res.json();
}

export async function getRequirementSample(id, token) {
  const res = await fetch(`${REQ_API}/${id}/sample`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Sample not available.');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function deleteRequirementSample(id, token) {
  const res = await fetch(`${REQ_API}/${id}/sample`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove sample.');
}

export async function createRequirement(data, token) {
  const res = await fetch(REQ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create requirement.');
  }
  return res.json();
}

export async function updateRequirement(id, data, token) {
  const res = await fetch(`${REQ_API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update requirement.');
  }
}

export async function deleteRequirement(id, token) {
  const res = await fetch(`${REQ_API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to remove requirement.');
  }
}

export async function getRequirementScholarshipTypes(id, token) {
  const res = await fetch(`${REQ_API}/${id}/scholarship-types`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load linked scholarship types.');
  return res.json(); // number[]
}

export async function setRequirementScholarshipTypes(id, scholarshipTypeIds, token) {
  const res = await fetch(`${REQ_API}/${id}/scholarship-types`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(scholarshipTypeIds),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to assign scholarship types.');
  }
}
