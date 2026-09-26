import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import { ArrowLeft, Bean, Bell, BookOpen, Bug, Carrot, Cherry, CloudOff, FlaskConical, Home, LayoutDashboard, Leaf, LogOut, MapPinned, Nut, Phone, Receipt, ShoppingBasket, Salad, Sprout, TreeDeciduous, Volume2, Wheat, Wifi } from 'lucide-react';
import { API_URL, getSession, setSession, flushQueue, queueSize } from './api';

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
  { id: 'anacarde', name: 'Anacarde', Icon: TreeDeciduous },
  { id: 'igname', name: 'Igname', Icon: Salad },
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

const NAV_BY_ROLE = {
  PRODUCER: [['/producteur', Home, 'Accueil'], ['/alertes', Bell, 'Alertes'], ['/signaler', Bug, 'Signaler'], ['/marche', ShoppingBasket, 'Marché'], ['/telephone', Phone, 'USSD']],
  ADVISOR: [['/producteur', Home, 'Accueil'], ['/parcelles', MapPinned, 'Parcelles'], ['/signaler', Bug, 'Signaler'], ['/marche', ShoppingBasket, 'Marché'], ['/cms', BookOpen, 'Fiches']],
  BUYER: [['/marche', ShoppingBasket, 'Marché'], ['/fiches', BookOpen, 'Fiches'], ['/pesticide', FlaskConical, 'Pesticide']],
  AGENT: [['/tableau', LayoutDashboard, 'Tableau'], ['/cms', BookOpen, 'Contenus'], ['/fiches', BookOpen, 'Fiches']],
  ADMIN: [['/tableau', LayoutDashboard, 'Tableau'], ['/cms', BookOpen, 'Contenus'], ['/recettes', Receipt, 'Recettes']],
  COMMUNE: [['/recettes', Receipt, 'Recettes'], ['/tableau', LayoutDashboard, 'Tableau'], ['/fiches', BookOpen, 'Fiches']],
};

export function Shell({ title, back = true, wide = false, children }) {
  const [session, setS] = useSession();
  const { online, pending } = useOnline();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const nav = session ? NAV_BY_ROLE[session.user.role] ?? [] : [];
  return (
    <div className="min-h-screen">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2">Aller au contenu</a>
      <header className="sticky top-0 z-20 border-b border-soil-line bg-surface/95 backdrop-blur">
        <div className={`mx-auto flex items-center gap-2 px-4 py-2 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>
          {back && (
            <button className="btn-ghost min-h-10 px-2 py-2" onClick={() => navigate(-1)} aria-label="Retour">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <Link to="/" className="flex shrink-0 items-center gap-2 font-black text-leaf" aria-label="AlerteAgri, accueil">
            <img src="/icon.svg" alt="" className="h-8 w-8" /> <span className="hidden sm:inline">AlerteAgri</span>
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
            {nav.map(([to, Icon, label]) => (
              <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${pathname === to ? 'bg-leaf-light text-leaf' : 'text-soil-muted hover:bg-surface-raised'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </Link>
            ))}
          </nav>
          <span className={`badge shrink-0 ${online ? 'bg-leaf-light text-leaf' : 'bg-danger-light text-danger'}`} role="status">
            {online ? <Wifi className="h-3 w-3" aria-hidden="true" /> : <CloudOff className="h-3 w-3" aria-hidden="true" />}
            <span className="hidden sm:inline">{online ? 'En ligne' : 'Hors ligne'}</span>{pending ? ` · ${pending}` : ''}
          </span>
          {session && (
            <button className="btn-ghost min-h-10 shrink-0 px-2 py-2" onClick={() => { setS(null); navigate('/'); }} aria-label="Se déconnecter">
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <main id="contenu" className={`page ${wide ? 'max-w-6xl' : ''}`}>{children}</main>
      {nav.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-soil-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Navigation principale mobile">
          <ul className="mx-auto flex max-w-xl justify-around">
            {nav.map(([to, Icon, label]) => {
              const active = pathname === to;
              return (
                <li key={to}>
                  <Link to={to} aria-current={active ? 'page' : undefined}
                    className={`flex min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 px-2 text-xs font-semibold ${active ? 'text-leaf' : 'text-soil-muted'}`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />{label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'neutral', Icon }) {
  const toneCls = { neutral: 'text-soil', good: 'text-leaf', warn: 'text-warn', bad: 'text-danger' }[tone];
  return (
    <div className="card flex flex-col gap-1 p-3">
      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-soil-muted">{Icon && <Icon className="h-4 w-4" aria-hidden="true" />}{label}</p>
      <p className={`text-2xl font-black tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="text-xs text-soil-muted">{hint}</p>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4" role="tablist" aria-label="Sections">
      <div className="flex gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${value === id ? 'border-leaf-mid bg-leaf-mid text-leaf-ink' : 'border-soil-line bg-surface text-soil'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Status is never color alone: each state has its own shape and a text label.
export const STATUS = {
  calm: { label: 'calme', cls: 'fill-status-calm', shape: 'circle' },
  check: { label: 'à vérifier', cls: 'fill-status-check', shape: 'diamond' },
  alert: { label: 'alerte', cls: 'fill-status-alert', shape: 'triangle' },
};

export function StatusMark({ status, x = 8, y = 8, r = 6, ...rest }) {
  const s = STATUS[status];
  if (s.shape === 'circle') return <circle cx={x} cy={y} r={r} className={s.cls} {...rest} />;
  if (s.shape === 'diamond') return <polygon points={`${x},${y - r * 1.2} ${x + r * 1.2},${y} ${x},${y + r * 1.2} ${x - r * 1.2},${y}`} className={s.cls} {...rest} />;
  return <polygon points={`${x},${y - r * 1.3} ${x + r * 1.2},${y + r} ${x - r * 1.2},${y + r}`} className={s.cls} {...rest} />;
}

export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-3 text-sm" aria-label="Légende">
      {Object.entries(STATUS).map(([k, s]) => (
        <li key={k} className="flex items-center gap-1">
          <svg width="16" height="16" aria-hidden="true"><StatusMark status={k} r={5} /></svg>{s.label}
        </li>
      ))}
    </ul>
  );
}

export async function downloadWithAuth(path, filename) {
  const s = getSession();
  const res = await fetch(`${API_URL}${path}`, { headers: s?.accessToken ? { Authorization: `Bearer ${s.accessToken}` } : {} });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AuthImage({ path, alt, className }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url;
    const s = getSession();
    fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${s?.accessToken}` } })
      .then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) { url = URL.createObjectURL(b); setSrc(url); } }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [path]);
  return src ? <img src={src} alt={alt} className={className} /> : <div className={`${className} animate-pulse bg-surface-raised`} aria-hidden="true" />;
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
  good: 'border-status-calm bg-leaf-light text-leaf',
  warn: 'border-status-check bg-warn-light text-warn',
  bad: 'border-status-alert bg-danger-light text-danger',
  neutral: 'border-soil-line bg-surface text-soil',
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
