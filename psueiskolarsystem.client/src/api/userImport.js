const API = '/api/users/import';

export async function downloadImportTemplate(token) {
  const res = await fetch(`${API}/template.xlsx`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to download template.');
  const blob = await res.blob();
  triggerDownload(blob, 'scholar_import_template.xlsx');
}

export async function importScholars(file, token) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Import failed.');
  }
  return res.json();
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
