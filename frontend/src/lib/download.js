import { API_URL, getSession } from '../api';

export async function downloadWithAuth(path, filename) {
  const s = getSession();
  const res = await fetch(`${API_URL}${path}`, { headers: s?.accessToken ? { Authorization: `Bearer ${s.accessToken}` } : {} });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
