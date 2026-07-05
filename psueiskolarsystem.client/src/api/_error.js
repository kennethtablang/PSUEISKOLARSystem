// Extracts a human-readable message from an API error body, including
// ASP.NET model-validation responses shaped as { errors: { Field: [msg] } }.
export function firstValidationError(body) {
  if (body?.errors && typeof body.errors === 'object') {
    const messages = Object.values(body.errors).flat();
    if (messages.length) return messages[0];
  }
  return null;
}

export function errorMessage(body, fallback) {
  return body?.message || firstValidationError(body) || fallback;
}
