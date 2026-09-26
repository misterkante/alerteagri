import { useEffect, useState } from 'react';
import { api, flushQueue, getSession, queueSize, setSession } from '../api';

export function useSession() {
  const [s, setS] = useState(getSession());
  useEffect(() => {
    const h = () => setS(getSession());
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);
  return [
    s,
    (v) => {
      setSession(v);
      setS(v);
    },
  ];
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queueSize());
  useEffect(() => {
    const up = async () => {
      setOnline(true);
      await flushQueue();
      setPending(queueSize());
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const t = setInterval(() => setPending(queueSize()), 3000);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      clearInterval(t);
    };
  }, []);
  return { online, pending };
}

export function useCommune() {
  const [session] = useSession();
  const [communes, setCommunes] = useState([]);
  const [communeId, setCommuneId] = useState(session?.user?.communeId ?? 'parakou');
  useEffect(() => {
    let alive = true;
    api('/communes', { auth: false })
      .then((c) => alive && setCommunes(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return { communes, communeId, setCommuneId };
}
