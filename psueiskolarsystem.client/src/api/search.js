import { apiGet } from './_client';

export async function globalSearch(token, q, signal) {
  // { scholars, announcements, requirements }
  return apiGet(`/api/search?q=${encodeURIComponent(q)}`, token, 'Search failed.', { signal });
}
