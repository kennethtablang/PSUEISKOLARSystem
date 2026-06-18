const API = '/api/reports';

async function downloadFile(url, token, filename) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Export failed.');
  }
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportScholars(token, { campusId, scholarshipTypeId, programId } = {}) {
  const params = new URLSearchParams();
  if (campusId) params.set('campusId', campusId);
  if (scholarshipTypeId) params.set('scholarshipTypeId', scholarshipTypeId);
  if (programId) params.set('programId', programId);
  const qs = params.toString() ? `?${params}` : '';
  return downloadFile(`${API}/scholars.xlsx${qs}`, token, `scholars_${today()}.xlsx`);
}

export function exportSubmissions(token, { academicYear, semester, status } = {}) {
  const params = new URLSearchParams();
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params}` : '';
  return downloadFile(`${API}/submissions.xlsx${qs}`, token, `submissions_${today()}.xlsx`);
}

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
