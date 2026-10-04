import { apiFetch } from './_client';
import { triggerDownload } from './userImport';

/**
 * Downloads a people list exactly as filtered — `dataset` is masterlist, scholars or grantees,
 * `format` is xlsx (to work with) or pdf (to print). Blank filters are left out.
 */
export async function downloadListReport(dataset, format, filters, token) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters ?? {})) if (v !== '' && v != null) params.set(k, v);
  const res = await apiFetch(`/api/reports/lists/${dataset}.${format}?${params}`, {
    token, fallback: 'Failed to generate the report.',
  });
  const disposition = res.headers.get('content-disposition') || '';
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? `${dataset}.${format}`;
  triggerDownload(await res.blob(), decodeURIComponent(name));
}
