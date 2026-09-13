import { apiFetch, apiForm } from './_client';

const API = '/api/users/import';

export async function downloadImportTemplate(token) {
  const res = await apiFetch(`${API}/template.xlsx`, { token, fallback: 'Failed to download template.' });
  triggerDownload(await res.blob(), 'scholar_import_template.xlsx');
}

export async function importScholars(file, token) {
  const body = new FormData();
  body.append('file', file);
  return apiForm(API, body, token, 'Import failed.');
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
