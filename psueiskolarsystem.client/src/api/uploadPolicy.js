import { getPublicSettings } from './systemSettings';

/* What the server will accept for a document upload. This used to be a hardcoded copy in
   MyDocumentsPage that had drifted from the server's — it omitted .webp, so scholars were
   told "Unsupported file type" for a file every layer underneath would have taken. The
   values now come from System Settings via /api/system-settings/public.

   The constants below are only a fallback for when that call fails; they match the defaults
   on SystemSettings so a client that cannot reach the endpoint still behaves sensibly. */
const FALLBACK = Object.freeze({
  maxUploadMb: 10,
  extensions: Object.freeze(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx']),
});

let pending = null;

function parse(settings) {
  const mb = Number(settings?.maxUploadMb);
  const extensions = String(settings?.allowedFileExtensions ?? '')
    .split(',')
    .map(e => e.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);

  return {
    maxUploadMb: Number.isFinite(mb) && mb > 0 ? mb : FALLBACK.maxUploadMb,
    extensions: extensions.length ? extensions : FALLBACK.extensions,
  };
}

/** Fetched once per page load; every caller shares the same promise. */
export function getUploadPolicy() {
  pending ??= getPublicSettings()
    .then(parse)
    .catch(() => {
      pending = null;   // let a later caller retry rather than caching the fallback forever
      return FALLBACK;
    });
  return pending;
}

export const FALLBACK_UPLOAD_POLICY = FALLBACK;

/** ".pdf,.jpg,…" for a file input's accept attribute. */
export function acceptAttribute(policy) {
  return policy.extensions.map(e => `.${e}`).join(',');
}

/** "PDF, JPG, PNG" — the same list phrased for a human. */
export function describeExtensions(policy) {
  return policy.extensions.map(e => e.toUpperCase()).join(', ');
}

/**
 * Checks a file against the policy before it is sent. The server re-checks everything;
 * this only exists so the scholar hears about it immediately.
 * @returns {string|null} an error message, or null if the file is acceptable
 */
export function validateUpload(file, policy) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !policy.extensions.includes(ext))
    return `Unsupported file type ".${ext ?? ''}". Accepted: ${describeExtensions(policy)}.`;
  if (file.size > policy.maxUploadMb * 1024 * 1024)
    return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum is ${policy.maxUploadMb} MB.`;
  return null;
}
