import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import { ArrowLeft, Bean, Carrot, Cherry, CloudOff, Leaf, LogOut, Nut, Sprout, Volume2, Wheat, Wifi } from 'lucide-react';
import { getSession, setSession, flushQueue, queueSize } from './api';

export const CROPS = [
  { id: 'mais', name: 'Maïs', Icon: Wheat },
  { id: 'soja', name: 'Soja', Icon: Bean },
  { id: 'arachide', name: 'Arachide', Icon: Nut },
  { id: 'niebe', name: 'Niébé', Icon: Bean },
  { id: 'riz', name: 'Riz', Icon: Sprout },
  { id: 'sorgho', name: 'Sorgho', Icon: Wheat },
  { id: 'manioc', name: 'Manioc', Icon: Carrot },
  { id: 'coton', name: 'Coton', Icon: Leaf },
  { id: 'tomate', name: 'Tomate', Icon: Cherry },
];

export function useSession() {
  const [s, setS] = useState(getSession());
  useEffect(() => {
    const h = () => setS(getSession());
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);
  return [s, (v) => { setSession(v); setS(v); }];
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queueSize());
  useEffect(() => {
    const up = async () => { setOnline(true); await flushQueue(); setPending(queueSize()); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const t = setInterval(() => setPending(queueSize()), 3000);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); clearInterval(t); };
  }, []);
  return { online, pending };
}

export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export function SpeakButton({ text, label = 'Écouter' }) {
  return (
    <button type="button" className="btn-ghost min-h-10 px-3 py-2 text-sm" onClick={() => speak(text)} aria-label={`${label} : ${text}`}>
      <Volume2 className="h-5 w-5" aria-hidden="true" /> {label}
    </button>
  );
}

export function Shell({ title, back = true, children }) {
  const [session, setS] = useSession();
  const { online, pending } = useOnline();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-soil-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
          {back && (
            <button className="btn-ghost min-h-10 px-2 py-2" onClick={() => navigate(-1)} aria-label="Retour">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 font-black text-leaf">
            <img src="/icon.svg" alt="" className="h-8 w-8" /> <span className="hidden sm:inline">AlerteAgri</span>
          </Link>
          <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
          <span className={`badge ${online ? 'bg-leaf-light text-leaf' : 'bg-danger-light text-danger'}`} role="status">
            {online ? <Wifi className="mr-1 h-3 w-3" aria-hidden="true" /> : <CloudOff className="mr-1 h-3 w-3" aria-hidden="true" />}
            {online ? 'En ligne' : 'Hors ligne'}{pending ? ` · ${pending} en attente` : ''}
          </span>
          {session && (
            <button className="btn-ghost min-h-10 px-2 py-2" onClick={() => { setS(null); navigate('/'); }} aria-label="Se déconnecter">
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}

export function CropPicker({ value, onChange, only }) {
  const list = only ? CROPS.filter((c) => only.includes(c.id)) : CROPS;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Culture">
      {list.map(({ id, name, Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}
          className={`tile min-h-24 ${value === id ? 'border-leaf bg-leaf-light' : ''}`}>
          <Icon className="h-8 w-8 text-leaf" aria-hidden="true" />
          {name}
        </button>
      ))}
    </div>
  );
}

const TONE = {
  good: 'border-leaf bg-leaf-light text-leaf',
  warn: 'border-warn bg-warn-light text-warn',
  bad: 'border-danger bg-danger-light text-danger',
  neutral: 'border-soil-line bg-white text-soil',
};

export function Verdict({ tone = 'neutral', title, text, Icon }) {
  useEffect(() => { if (text) speak(`${title}. ${text}`); }, [title, text]);
  return (
    <div className={`rounded-lg border-2 p-4 ${TONE[tone]}`} role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-10 w-10 shrink-0" aria-hidden="true" />}
        <p className="text-2xl font-black">{title}</p>
      </div>
      {text && <p className="mt-2 text-base font-medium text-soil">{text}</p>}
      {text && <div className="mt-3"><SpeakButton text={`${title}. ${text}`} label="Réécouter" /></div>}
    </div>
  );
}

export function Qr({ value, size = 180, label }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(value);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [value]);
  return <div role="img" aria-label={label ?? `QR code : ${value}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <p className="mt-3 rounded-lg bg-danger-light p-3 font-semibold text-danger" role="alert">{error}</p>;
}

export function Demo({ children = 'démo' }) {
  return <span className="demo">{children}</span>;
}

export const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
export const fmtFcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
