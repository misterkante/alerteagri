export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const SESSION = 'alerteagri:session';
const QUEUE = 'alerteagri:queue';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION) ?? 'null');
  } catch {
    return null;
  }
}
export function setSession(s) {
  try {
    s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  const s = getSession();
  if (auth && s?.accessToken) headers.Authorization = `Bearer ${s.accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      })()
    : null;
  if (!res.ok) {
    if (res.status === 401 && auth) setSession(null);
    const msg = Array.isArray(data?.message) ? data.message.join(' ; ') : (data?.message ?? `Erreur ${res.status}`);
    throw new ApiError(res.status, msg);
  }
  return data;
}

export const newClientId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// Offline queue: writes made without network are replayed later with the same clientId, so they are never duplicated.
function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE) ?? '[]');
  } catch {
    return [];
  }
}
function writeQueue(q) {
  try {
    localStorage.setItem(QUEUE, JSON.stringify(q));
  } catch {
    /* storage unavailable */
  }
}
export const queueSize = () => readQueue().length;

export async function sendOrQueue(path, body, label) {
  try {
    return { sent: true, data: await api(path, { method: 'POST', body }) };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    writeQueue([...readQueue(), { path, body, label, at: Date.now() }]);
    return { sent: false };
  }
}

export async function flushQueue() {
  const q = readQueue();
  const left = [];
  for (const item of q) {
    try {
      await api(item.path, { method: 'POST', body: item.body });
    } catch (e) {
      if (!(e instanceof ApiError)) left.push(item);
    }
  }
  writeQueue(left);
  return q.length - left.length;
}
