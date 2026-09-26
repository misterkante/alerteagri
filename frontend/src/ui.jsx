import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Bug,
  CloudOff,
  FlaskConical,
  Home,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Receipt,
  ShoppingBasket,
} from 'lucide-react';
import { API_URL, getSession } from './api';
import { CROPS } from './lib/crops';
import { useOnline, useSession } from './lib/session';
import { STATUS } from './lib/status';
import { Picto } from './picto';

const NAV_BY_ROLE = {
  PRODUCER: [
    ['/producteur', Home, 'Accueil'],
    ['/alertes', Bell, 'Alertes'],
    ['/signaler', Bug, 'Signaler'],
    ['/marche', ShoppingBasket, 'Marché'],
    ['/fiches', BookOpen, 'Fiches'],
  ],
  ADVISOR: [
    ['/producteur', Home, 'Accueil'],
    ['/parcelles', MapPinned, 'Parcelles'],
    ['/signaler', Bug, 'Signaler'],
    ['/marche', ShoppingBasket, 'Marché'],
    ['/cms', BookOpen, 'Fiches'],
  ],
  BUYER: [
    ['/marche', ShoppingBasket, 'Marché'],
    ['/fiches', BookOpen, 'Fiches'],
    ['/pesticide', FlaskConical, 'Pesticide'],
  ],
  AGENT: [
    ['/tableau', LayoutDashboard, 'Tableau'],
    ['/cms', BookOpen, 'Contenus'],
    ['/fiches', BookOpen, 'Fiches'],
  ],
  ADMIN: [
    ['/tableau', LayoutDashboard, 'Tableau'],
    ['/cms', BookOpen, 'Contenus'],
    ['/recettes', Receipt, 'Recettes'],
  ],
  COMMUNE: [
    ['/recettes', Receipt, 'Recettes'],
    ['/tableau', LayoutDashboard, 'Tableau'],
    ['/fiches', BookOpen, 'Fiches'],
  ],
};

export function Shell({ title, back = true, wide = false, children }) {
  const [session, setS] = useSession();
  const { online, pending } = useOnline();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const nav = session ? (NAV_BY_ROLE[session.user.role] ?? []) : [];
  return (
    <div className="min-h-screen">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-20 bg-soil-light/90 backdrop-blur-md">
        {/* Green, yellow, red rule of the national charter's brand block. */}
        <div className="flex h-[3px]" aria-hidden="true">
          <span className="flex-1 bg-flag-green" />
          <span className="flex-1 bg-flag-yellow" />
          <span className="flex-1 bg-flag-red" />
        </div>
        <div className={`mx-auto flex h-14 items-center gap-1 px-2 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>
          {back ? (
            <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Retour">
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          ) : (
            <Link to="/" className="icon-btn" aria-label="AlerteAgri, accueil">
              <img src="/icon.svg" alt="" className="h-8 w-8" />
            </Link>
          )}
          <h1 className="min-w-0 flex-1 truncate px-1 text-[19px] font-semibold">{title}</h1>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
            {nav.map(([to, Icon, label]) => (
              <Link
                key={to}
                to={to}
                aria-current={pathname === to ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${pathname === to ? 'bg-leaf-light text-leaf' : 'text-soil-muted hover:bg-surface'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          {session && (
            <button
              className="icon-btn text-soil-muted"
              onClick={() => {
                setS(null);
                navigate('/');
              }}
              aria-label="Se déconnecter"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {(!online || pending > 0) && (
          <p className="flex items-center gap-2 bg-warn-light px-4 py-2 text-sm font-semibold text-warn" role="status">
            <CloudOff className="h-4 w-4" aria-hidden="true" />
            {online ? 'Envoi en cours' : 'Hors ligne : vos actions partiront au retour du réseau'}
            {pending > 0 ? ` · ${pending} en attente` : ''}
          </p>
        )}
      </header>
      <main id="contenu" className={`page ${wide ? 'max-w-6xl' : ''}`}>
        {children}
      </main>
      {nav.length > 0 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-soil-line/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
          aria-label="Navigation principale mobile"
        >
          <ul className="mx-auto flex max-w-xl justify-around">
            {nav.map(([to, Icon, label]) => {
              const active = pathname === to;
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold ${active ? 'text-leaf' : 'text-soil-muted'}`}
                  >
                    <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? 'bg-leaf-light' : ''}`}>
                      <Icon className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                    </span>
                    {label}
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
      <p className="flex items-center gap-1 text-[13px] font-medium text-soil-muted">
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {label}
      </p>
      <p className={`font-display text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="text-xs text-soil-muted">{hint}</p>}
    </div>
  );
}

// WAI-ARIA tabs: one tab in the tab order, arrows and Home/End move between tabs, the panel is labelled by its tab.
export function Tabs({ tabs, value, onChange, id = 'onglets' }) {
  const refs = useRef({});
  const move = (e, index) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const target = tabs[next][0];
    onChange(target);
    refs.current[target]?.focus();
  };
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4" role="tablist" aria-label="Sections">
      <div className="flex gap-2">
        {tabs.map(([tabId, label], index) => (
          <button
            key={tabId}
            ref={(el) => {
              refs.current[tabId] = el;
            }}
            id={`${id}-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={value === tabId}
            aria-controls={`${id}-panel`}
            tabIndex={value === tabId ? 0 : -1}
            onClick={() => onChange(tabId)}
            onKeyDown={(e) => move(e, index)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-leaf/40 ${value === tabId ? 'border-leaf-mid bg-leaf-mid text-leaf-ink' : 'border-soil-line bg-surface text-soil'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TabPanel({ value, id = 'onglets', children }) {
  return (
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${value}`} tabIndex={0} className="focus:outline-none">
      {children}
    </div>
  );
}

export function StatusMark({ status, x = 8, y = 8, r = 6, ...rest }) {
  const s = STATUS[status];
  if (s.shape === 'circle') return <circle cx={x} cy={y} r={r} className={s.cls} {...rest} />;
  if (s.shape === 'diamond')
    return (
      <polygon points={`${x},${y - r * 1.2} ${x + r * 1.2},${y} ${x},${y + r * 1.2} ${x - r * 1.2},${y}`} className={s.cls} {...rest} />
    );
  return <polygon points={`${x},${y - r * 1.3} ${x + r * 1.2},${y + r} ${x - r * 1.2},${y + r}`} className={s.cls} {...rest} />;
}

export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-3 text-sm" aria-label="Légende">
      {Object.entries(STATUS).map(([k, s]) => (
        <li key={k} className="flex items-center gap-1">
          <svg width="16" height="16" aria-hidden="true">
            <StatusMark status={k} r={5} />
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function AuthImage({ path, alt, className }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url;
    const s = getSession();
    fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${s?.accessToken}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          url = URL.createObjectURL(b);
          setSrc(url);
        }
      })
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return src ? (
    <img src={src} alt={alt} className={className} />
  ) : (
    <div className={`${className} animate-pulse bg-surface-raised`} aria-hidden="true" />
  );
}

// WAI-ARIA radio group made of tiles: one stop in the tab order, arrows move and select.
export function TileRadioGroup({ label, options, value, onChange, className, tileClass = '', variant = 'tile' }) {
  const refs = useRef({});
  const current = options.some((o) => o.id === value) ? value : options[0]?.id;
  const move = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = options[(index + step + options.length) % options.length].id;
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {options.map(({ id, name, picto }, index) => (
        <button
          key={id}
          ref={(el) => {
            refs.current[id] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === id}
          tabIndex={current === id ? 0 : -1}
          onClick={() => onChange(id)}
          onKeyDown={(e) => move(e, index)}
          className={`${variant === 'chip' ? 'chip' : `tile ${tileClass} ring-2 ${value === id ? 'ring-leaf bg-leaf-light' : 'ring-transparent'}`}`}
        >
          <Picto name={picto} size={variant === 'chip' ? 26 : 44} />
          {name}
        </button>
      ))}
    </div>
  );
}

// Crops as a row of pictogram chips that scrolls sideways: the choice stays one thumb away.
export function CropPicker({ value, onChange, only, layout = 'chips' }) {
  const list = only ? CROPS.filter((c) => only.includes(c.id)) : CROPS;
  if (layout === 'grid')
    return <TileRadioGroup label="Culture" options={list} value={value} onChange={onChange} className="grid grid-cols-3 gap-3" />;
  return (
    <TileRadioGroup
      label="Culture"
      options={list}
      value={value}
      onChange={onChange}
      variant="chip"
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
    />
  );
}

const TONE = {
  good: 'bg-leaf-light',
  warn: 'bg-warn-light',
  bad: 'bg-danger-light',
  neutral: 'bg-surface',
};
const TONE_TITLE = { good: 'text-leaf', warn: 'text-warn', bad: 'text-danger', neutral: 'text-soil' };
const TONE_PICTO = { good: 'ok', warn: 'sablier', bad: 'non', neutral: 'calendrier' };

// The answer a person came for: first on the screen, large, with a picture that carries it without reading.
export function Verdict({ tone = 'neutral', title, text, picto }) {
  return (
    <div className={`rounded-3xl p-5 shadow-card ${TONE[tone]}`} role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <Picto name={picto ?? TONE_PICTO[tone]} size={56} />
        <p className={`font-display text-[24px] font-bold leading-tight ${TONE_TITLE[tone]}`}>{title}</p>
      </div>
      {text && <p className="mt-3 text-[16px] leading-relaxed text-soil">{text}</p>}
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
  return (
    <div
      role="img"
      aria-label={label ?? `QR code : ${value}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <p className="mt-3 rounded-2xl bg-danger-light p-4 font-semibold text-danger" role="alert">
      {error}
    </p>
  );
}

export function Demo({ children = 'démo' }) {
  return <span className="demo">{children}</span>;
}

// A table wider than the screen scrolls; keyboard users need to reach it to scroll it (WCAG 2.1.1).
export function ScrollArea({ label, className = '', children }) {
  return (
    <div
      className={`overflow-x-auto focus:outline-none focus-visible:ring-4 focus-visible:ring-leaf/40 ${className}`}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

// Shown instead of a protected screen: says who it is for, and why this visitor does not see it.
export function SignInPrompt({ title, audience }) {
  const [session] = useSession();
  return (
    <Shell title={title}>
      <div className="card space-y-3">
        <p className="font-bold">Espace réservé : {audience}.</p>
        <p className="text-sm text-soil-muted">
          {session ? 'Votre compte n’a pas accès à cet écran. Connectez-vous avec un compte autorisé.' : 'Connectez-vous pour y accéder.'}
        </p>
        <Link className="btn-primary" to="/connexion">
          Se connecter
        </Link>
      </div>
    </Shell>
  );
}
