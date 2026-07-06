export async function globalSearch(token, q, signal) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new Error('Search failed.');
  return res.json(); // { scholars, announcements, requirements }
}
