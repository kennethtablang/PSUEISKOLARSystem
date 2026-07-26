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

// format is 'xlsx' (spreadsheet) or 'pdf' (print-ready report).
export function exportScholars(token, { scholarshipTypeId, programId } = {}, format = 'xlsx') {
  const params = new URLSearchParams();
  if (scholarshipTypeId) params.set('scholarshipTypeId', scholarshipTypeId);
  if (programId) params.set('programId', programId);
  const qs = params.toString() ? `?${params}` : '';
  return downloadFile(`${API}/scholars.${format}${qs}`, token, `scholars_${today()}.${format}`);
}

export function exportSubmissions(token, { academicYear, semester, status } = {}, format = 'xlsx') {
  const params = new URLSearchParams();
  if (academicYear) params.set('academicYear', academicYear);
  if (semester) params.set('semester', semester);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params}` : '';
  return downloadFile(`${API}/submissions.${format}${qs}`, token, `submissions_${today()}.${format}`);
}

// Full data export: a ZIP holding one CSV per table (admin only).
export function downloadBackup(token) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return downloadFile('/api/admin/backup', token, `psu-eiskolar-backup_${stamp}.zip`);
}

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
