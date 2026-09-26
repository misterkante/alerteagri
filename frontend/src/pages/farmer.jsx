import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Gavel, MapPin, Pause, Play } from 'lucide-react';
import { api, newClientId, sendOrQueue, API_URL } from '../api';
import { CropPicker, Demo, ErrorNote, Shell, SignInPrompt, TileRadioGroup, Verdict } from '../ui';
import { Picto } from '../picto';
import { fmtDate, fmtDay, fmtLongDate, fmtNum, fmtTime } from '../lib/format';
import { useCommune, useSession } from '../lib/session';
import { MyParcels } from './advisor';
import { HOME_BY_ROLE, LANG_LABEL } from '../lib/constants';

// The weather a farmer plans the day with: today and the next two days, in pictures first.
function weatherPicto(rainMm) {
  if (rainMm >= 10) return 'pluie';
  if (rainMm >= 1) return 'nuage-soleil';
  return 'soleil';
}

function WeatherToday({ communeId, communeName }) {
  const [days, setDays] = useState(null);
  useEffect(() => {
    let alive = true;
    api(`/weather/${communeId}`, { auth: false })
      .then((w) => {
        if (!alive) return;
        const today = new Date().toISOString().slice(0, 10);
        setDays(w.days.filter((d) => d.date.slice(0, 10) >= today).slice(0, 3));
      })
      .catch(() => alive && setDays([]));
    return () => {
      alive = false;
    };
  }, [communeId]);
  if (!days?.length) return null;
  const [today, ...next] = days;
  return (
    <section className="card" aria-label={`Météo à ${communeName}`}>
      <div className="flex items-center gap-4">
        <Picto name={weatherPicto(today.rainMm)} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-soil-muted">Aujourd’hui à {communeName}</p>
          <p className="font-display text-[26px] font-bold leading-tight">{fmtNum(today.tmaxC)} °C</p>
          <p className="text-[15px]">
            {today.rainMm >= 1 ? `${fmtNum(today.rainMm, 1)} mm de pluie` : 'Pas de pluie'} · humidité {fmtNum(today.humidity)} %
          </p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {next.map((d) => (
          <li key={d.date} className="flex items-center gap-2 rounded-2xl bg-surface-raised px-3 py-2">
            <Picto name={weatherPicto(d.rainMm)} size={28} />
            <span className="text-[14px]">
              <span className="font-semibold">{fmtDay(d.date)}</span> · {d.rainMm >= 1 ? `${fmtNum(d.rainMm, 1)} mm` : 'sec'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TILE_TINT = { green: 'bg-leaf-light', yellow: 'bg-warn-light', red: 'bg-danger-light', neutral: 'bg-surface' };

function ActionTile({ to, picto, label, tint = 'neutral', hint }) {
  return (
    <Link to={to} className={`tile ${TILE_TINT[tint]}`}>
      <Picto name={picto} size={44} />
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-[13px] font-medium text-soil-muted">{hint}</span>}
      </span>
    </Link>
  );
}

export function Home() {
  const [session] = useSession();
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    api('/weather/status', { auth: false })
      .then((w) => setWeather(w?.finishedAt))
      .catch(() => {});
  }, []);
  return (
    <Shell title="AlerteAgri" back={false}>
      <section className="pt-2">
        <div className="flex gap-2" aria-hidden="true">
          {['pluie', 'chenilles', 'mais', 'marche'].map((p) => (
            <span key={p} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface shadow-card">
              <Picto name={p} size={34} />
            </span>
          ))}
        </div>
        <h2 className="mt-5 text-[30px] font-bold leading-[1.15]">
          Voir venir,
          <br />
          <span className="text-leaf">agir à temps.</span>
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-soil-muted">
          La météo de votre commune, les alertes ravageurs, le bon moment pour semer et un marché pour vendre. Même sans savoir lire, sans
          smartphone ou sans réseau.
        </p>
        <div className="mt-6 grid gap-3">
          {session ? (
            <Link to={HOME_BY_ROLE[session.user.role] ?? '/'} className="btn-primary">
              Continuer : {session.user.name}
            </Link>
          ) : (
            <Link to="/connexion" className="btn-primary">
              Se connecter
            </Link>
          )}
        </div>
      </section>

      <h2 className="section-title">Sans compte</h2>
      <div className="grid grid-cols-2 gap-3">
        <ActionTile to="/semis" picto="semis" label="Semer ?" hint="selon la pluie tombée" tint="green" />
        <ActionTile to="/pesticide" picto="pesticide" label="Vérifier un pesticide" hint="homologué ou non" />
        <ActionTile to="/fiches" picto="fiche" label="Fiches et règles" hint="en images et en audio" />
        <ActionTile to="/marche" picto="marche" label="Marché et prix" hint="offres ouvertes" tint="yellow" />
      </div>

      <Link to="/telephone" className="card mt-3 flex items-center gap-4">
        <Picto name="telephone" size={44} />
        <span className="flex-1">
          <span className="block text-[16px] font-semibold">Sans smartphone ?</span>
          <span className="block text-[14px] text-soil-muted">Le même service par code USSD, sur tout téléphone.</span>
        </span>
        <ChevronRight className="h-5 w-5 text-soil-muted" aria-hidden="true" />
      </Link>

      <h2 className="section-title">Comment ça marche</h2>
      <ol className="card divide-y divide-soil-line/70 p-0">
        {[
          ['pluie', 'Observer', 'La météo réelle des 77 communes et les signalements du terrain.'],
          ['alerte', 'Alerter', 'Une règle validée par l’ATDA prévient la commune et ses voisines par SMS.'],
          ['ok', 'Agir', 'Le producteur confirme la lecture puis l’action ; l’agent voit la boucle se fermer.'],
        ].map(([p, title, text]) => (
          <li key={title} className="row">
            <Picto name={p} size={36} />
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-[14px] text-soil-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[13px] text-soil-muted">
        Météo Open-Meteo{weather ? `, relevée le ${fmtDate(weather)} à ${fmtTime(weather)}` : ''}. Ce qui est simulé porte la mention « démo
        ».{' '}
        <a className="font-semibold text-leaf underline" href={`${API_URL}/docs`}>
          API ouverte
        </a>
      </p>
    </Shell>
  );
}

export function Login() {
  const [, setSession] = useSession();
  const [phone, setPhone] = useState('+229');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const s = await api('/auth/login', { method: 'POST', body: { phone: phone.replace(/\s/g, ''), pin }, auth: false });
      setSession(s);
      navigate(HOME_BY_ROLE[s.user.role] ?? '/');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Shell title="Connexion">
      <div className="flex flex-col items-center pb-2 pt-4 text-center">
        <Picto name="cle" size={64} />
        <h2 className="mt-3 text-[24px] font-bold">Entrez dans votre espace</h2>
        <p className="mt-1 text-[15px] text-soil-muted">Votre numéro de téléphone et votre code à 4 chiffres.</p>
      </div>
      <form className="mt-4 space-y-4" onSubmit={submit} method="post">
        <div>
          <label className="label" htmlFor="phone">
            Numéro de téléphone
          </label>
          <input
            id="phone"
            className="input text-[18px] tracking-wide"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="pin">
            Code PIN (4 chiffres)
          </label>
          <input
            id="pin"
            className="input text-center font-display text-[24px] tracking-[0.6em]"
            inputMode="numeric"
            type="password"
            maxLength={4}
            pattern="[0-9]{4}"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary w-full" type="submit">
          Entrer
        </button>
        <ErrorNote error={error} />
      </form>
      <div className="mt-8 rounded-2xl bg-surface-raised p-4 text-[14px]">
        <p className="font-semibold">
          Comptes de démonstration <Demo />
        </p>
        <p className="mt-1">Producteurs : +22997000001 (Parakou), +22997000004 (Bohicon) · Acheteur : +22996000001 · PIN 1234.</p>
        <p className="mt-1 text-soil-muted">Les comptes agent, commune et conseiller ont un PIN communiqué au jury.</p>
      </div>
    </Shell>
  );
}

export function ProducerHome() {
  const [session] = useSession();
  const { communes } = useCommune();
  const [unread, setUnread] = useState([]);
  useEffect(() => {
    let alive = true;
    api('/alerts/me')
      .then((n) => alive && setUnread(n.filter((x) => !x.readAt)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!session) return <SignInPrompt title="Producteur" audience="producteurs et conseillers agricoles" />;
  const advisor = session.user.role === 'ADVISOR';
  const commune = communes.find((c) => c.id === session.user.communeId);
  return (
    <Shell title={advisor ? 'Conseiller' : 'Mon champ'} back={false}>
      <p className="text-[15px] text-soil-muted">{fmtLongDate(new Date())}</p>
      <h2 className="mt-0.5 text-[26px] font-bold">Bonjour {session.user.name}</h2>

      {unread.length > 0 && (
        <Link to="/alertes" className="mt-4 flex items-center gap-4 rounded-3xl bg-danger-light p-4 shadow-card">
          <Picto name="alerte" size={44} />
          <span className="flex-1">
            <span className="block text-[17px] font-bold text-danger">
              {unread.length === 1 ? '1 alerte à lire' : `${unread.length} alertes à lire`}
            </span>
            <span className="line-clamp-2 block text-[14px] text-soil">{unread[0].alert?.message ?? unread[0].body}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-danger" aria-hidden="true" />
        </Link>
      )}

      <div className="mt-4">
        <WeatherToday communeId={session.user.communeId} communeName={commune?.name ?? 'votre commune'} />
      </div>

      <h2 className="section-title">Que voulez-vous faire ?</h2>
      <div className="grid grid-cols-2 gap-3">
        <ActionTile to="/semis" picto="semis" label="Semer maintenant ?" tint="green" />
        <ActionTile to="/signaler" picto="chenilles" label="Signaler un ravageur" tint="red" />
        <ActionTile to="/recolte" picto="soleil" label="Après la récolte" tint="yellow" />
        <ActionTile to="/marche" picto="marche" label="Vendre" tint="yellow" />
        <ActionTile to="/pesticide" picto="pesticide" label="Vérifier un pesticide" />
        <ActionTile to="/fiches" picto="fiche" label="Fiches et règles" />
        <ActionTile to="/alertes" picto="alerte" label="Mes alertes" hint={unread.length ? `${unread.length} non lue(s)` : 'tout est lu'} />
        <ActionTile to="/telephone" picto="telephone" label="Téléphone USSD" />
      </div>
      {session.user.role === 'PRODUCER' && <MyParcels />}
      {advisor && <AdvisorPanel />}
    </Shell>
  );
}

function AdvisorPanel() {
  const [producers, setProducers] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '+229', pin: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = () =>
    api('/users/producers')
      .then(setProducers)
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const enrol = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await api('/users/producers', { method: 'POST', body: form });
      setMsg('Producteur inscrit.');
      setForm({ name: '', phone: '+229', pin: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <section className="mt-7">
      <h2 className="mb-1 text-[17px] font-semibold">Mes producteurs ({producers.length})</h2>
      <p className="mb-3 text-[14px] text-soil-muted">
        Vous pouvez signaler, déclarer une récolte ou vendre au nom d’un producteur : chaque action est tracée.
      </p>
      <ul className="card divide-y divide-soil-line/70 p-0">
        {producers.map((p) => (
          <li key={p.id} className="row">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf-light font-display font-bold text-leaf"
              aria-hidden="true"
            >
              {p.name.charAt(0)}
            </span>
            <span>
              <span className="block font-semibold">{p.name}</span>
              <span className="block text-[14px] text-soil-muted">{p.phone}</span>
            </span>
          </li>
        ))}
      </ul>
      <form className="card mt-3 grid gap-3" onSubmit={enrol} method="post">
        <p className="font-semibold">Inscrire un producteur</p>
        <input
          className="input"
          placeholder="Nom"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          aria-label="Nom du producteur"
        />
        <input
          className="input"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
          aria-label="Téléphone"
        />
        <input
          className="input"
          inputMode="numeric"
          maxLength={4}
          placeholder="PIN"
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: e.target.value })}
          required
          aria-label="PIN"
        />
        <button className="btn-primary" type="submit">
          Inscrire
        </button>
        {msg && (
          <p className="font-semibold text-leaf" role="status">
            {msg}
          </p>
        )}
        <ErrorNote error={error} />
      </form>
    </section>
  );
}

function CommuneSelect({ communes, value, onChange }) {
  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-leaf" aria-hidden="true" />
      <select
        className="input appearance-none pl-11 pr-10 font-semibold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Commune"
      >
        {communes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.department})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-soil-muted" aria-hidden="true" />
    </div>
  );
}

function RainChart({ rain }) {
  if (!rain?.length) return null;
  const max = Math.max(20, ...rain.map((d) => d.rainMm));
  const w = 12;
  return (
    <figure className="card">
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
        <span className="font-semibold">Pluie par jour (mm)</span>
        <span className="flex items-center gap-1.5 text-soil-muted">
          <span className="inline-block h-3 w-3 rounded-sm bg-leaf" /> mesurée
        </span>
        <span className="flex items-center gap-1.5 text-soil-muted">
          <span className="inline-block h-3 w-3 rounded-sm bg-leaf/35" /> prévue
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${rain.length * w} 110`} className="h-28 w-full" role="img" aria-label="Graphique des pluies mesurées et prévues">
        {rain.map((d, i) => {
          const h = (d.rainMm / max) * 100;
          return (
            <rect
              key={i}
              x={i * w + 1}
              y={105 - h}
              width={w - 2}
              height={Math.max(h, 1)}
              rx="2"
              className={d.isForecast ? 'fill-leaf/35' : 'fill-leaf'}
            >
              <title>{`${fmtDate(d.date)} : ${fmtNum(d.rainMm, 1)} mm`}</title>
            </rect>
          );
        })}
      </svg>
    </figure>
  );
}

const SOWING = {
  SEMEZ: ['good', 'semis', 'Vous pouvez semer'],
  ATTENDEZ: ['warn', 'sablier', 'Attendez'],
  HORS_SAISON: ['neutral', 'calendrier', 'Hors saison'],
};

export function Sowing() {
  const { communes, communeId, setCommuneId } = useCommune();
  const [cropId, setCropId] = useState('mais');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api(`/advice/sowing?communeId=${communeId}&cropId=${cropId}`, { auth: false })
      .then((r) => {
        if (alive) {
          setResult(r);
          setError('');
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [communeId, cropId]);
  const v = result && SOWING[result.verdict];
  return (
    <Shell title="Semer maintenant ?">
      <div className="space-y-4">
        <CommuneSelect communes={communes} value={communeId} onChange={setCommuneId} />
        <CropPicker
          value={cropId}
          onChange={setCropId}
          only={['mais', 'soja', 'arachide', 'niebe', 'riz', 'sorgho', 'manioc', 'coton', 'tomate']}
        />
        {v && <Verdict tone={v[0]} picto={v[1]} title={v[2]} text={result.reason} />}
        <ErrorNote error={error} />
        {result && <RainChart rain={result.rain} />}
        {result && (
          <p className="px-1 text-[13px] text-soil-muted">
            Périodes de semis ({result.zone === 'NORD' ? 'Nord, une saison' : 'Sud, deux saisons'}) :{' '}
            {result.windows.map((w) => `${w.from} au ${w.to}`).join(' ; ') || 'non renseignées'}. {result.source}.
          </p>
        )}
      </div>
    </Shell>
  );
}

const SYMPTOMS = [
  ['feuilles-trouees', 'Feuilles trouées', 'feuilles-trouees'],
  ['chenilles', 'Chenilles', 'chenilles'],
  ['sciure-cornet', 'Sciure dans le cornet', 'sciure-cornet'],
  ['jaunissement', 'Jaunissement', 'jaunissement'],
  ['taches', 'Taches', 'taches'],
  ['fletrissement', 'Plante flétrie', 'fletrissement'],
  ['insectes-piqueurs', 'Petits insectes', 'insectes'],
];

function ProducerFor({ value, onChange }) {
  const [session] = useSession();
  const [producers, setProducers] = useState([]);
  useEffect(() => {
    if (session?.user.role === 'ADVISOR')
      api('/users/producers')
        .then(setProducers)
        .catch(() => {});
  }, [session]);
  if (session?.user.role !== 'ADVISOR') return null;
  return (
    <div>
      <label className="label" htmlFor="for">
        Au nom de
      </label>
      <select id="for" className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Moi-même</option>
        {producers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Downscale on the phone before sending: a 4 MB photo becomes ~150 KB, which a 2G link can carry.
async function compressPhoto(file, max = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.72));
}

function Step({ n, title, children }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-3 text-[17px] font-semibold">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf-mid font-display text-[15px] text-leaf-ink"
          aria-hidden="true"
        >
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Report() {
  const [photo, setPhoto] = useState(null);
  const [cropId, setCropId] = useState('mais');
  const [symptom, setSymptom] = useState('');
  const [forUserId, setFor] = useState('');
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    let pos = {};
    try {
      pos = await new Promise((ok) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(
              (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
              () => ok({}),
              { timeout: 4000 },
            )
          : ok({}),
      );
    } catch {
      pos = {};
    }
    try {
      const r = await sendOrQueue(
        '/reports',
        { clientId: newClientId(), cropId, symptom, ...pos, ...(forUserId ? { forUserId } : {}) },
        'signalement',
      );
      if (r.sent && photo) {
        const form = new FormData();
        form.append('file', await compressPhoto(photo), 'photo.jpg');
        await api(`/reports/${r.data.id}/photo`, { method: 'POST', form }).catch(() => {});
      }
      setDone(r.sent ? 'sent' : 'queued');
    } catch (e) {
      setError(e.message);
    }
  };
  if (done) {
    return (
      <Shell title="Signaler un ravageur">
        <Verdict
          tone="good"
          picto={done === 'sent' ? 'ok' : 'colis'}
          title={done === 'sent' ? 'Signalement envoyé' : 'Signalement enregistré'}
          text={
            done === 'sent'
              ? 'Un agent va le vérifier. Vous serez prévenu si une alerte est lancée.'
              : 'Pas de réseau : il partira tout seul dès que le téléphone capte.'
          }
        />
        <button
          className="btn-ghost mt-4 w-full"
          onClick={() => {
            setDone(null);
            setSymptom('');
          }}
        >
          Nouveau signalement
        </button>
      </Shell>
    );
  }
  return (
    <Shell title="Signaler un ravageur">
      <div className="space-y-6">
        <ProducerFor value={forUserId} onChange={setFor} />
        <Step n="1" title="Quelle culture ?">
          <CropPicker
            value={cropId}
            onChange={setCropId}
            only={['mais', 'soja', 'arachide', 'niebe', 'riz', 'sorgho', 'manioc', 'coton', 'tomate']}
          />
        </Step>
        <Step n="2" title="Que voyez-vous ?">
          <TileRadioGroup
            label="Symptôme"
            options={SYMPTOMS.map(([id, name, picto]) => ({ id, name, picto }))}
            value={symptom}
            onChange={setSymptom}
            className="grid grid-cols-2 gap-3"
          />
        </Step>
        <Step n="3" title="Une photo ? (facultatif)">
          <label className="tile min-h-0 cursor-pointer flex-row items-center justify-start">
            <Picto name="photo" size={40} />
            <span>{photo ? `Photo prête (${Math.round(photo.size / 1024)} Ko avant réduction)` : 'Prendre une photo'}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </Step>
        <div className="sticky bottom-16 z-10 -mx-4 bg-soil-light/95 px-4 pb-3 pt-2 backdrop-blur-md lg:bottom-0">
          <button className="btn-primary w-full" disabled={!symptom} onClick={submit}>
            Envoyer le signalement
          </button>
          {!symptom && <p className="mt-1.5 text-center text-[13px] text-soil-muted">Choisissez d’abord ce que vous voyez.</p>}
        </div>
        <ErrorNote error={error} />
      </div>
    </Shell>
  );
}

const HARVEST = {
  SECHEZ: ['warn', 'soleil', 'Séchez maintenant'],
  COUVREZ: ['bad', 'pluie', 'Couvrez et abritez'],
  SECHAGE_POSSIBLE: ['good', 'soleil', 'Bon moment pour sécher'],
  NON_CONCERNE: ['neutral', 'calendrier', 'Non concerné'],
  PAS_DE_PREVISION: ['neutral', 'sablier', 'Pas de prévision'],
};

export function Harvest() {
  const [cropId, setCropId] = useState('mais');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [forUserId, setFor] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    setResult(null);
    try {
      setResult(await api('/advice/harvest', { method: 'POST', body: { cropId, harvestDate: date, ...(forUserId ? { forUserId } : {}) } }));
    } catch (e) {
      setError(e.message);
    }
  };
  const v = result && HARVEST[result.code];
  return (
    <Shell title="Après la récolte">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl bg-warn-light p-4">
          <Picto name="attention" size={32} />
          <p className="text-[15px]">
            Maïs et arachide mal séchés développent des aflatoxines, dangereuses pour la santé et refusées à la vente.
          </p>
        </div>
        <ProducerFor value={forUserId} onChange={setFor} />
        <CropPicker value={cropId} onChange={setCropId} only={['mais', 'arachide']} />
        <div>
          <label className="label" htmlFor="hd">
            Date de récolte
          </label>
          <input id="hd" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn-primary w-full" onClick={submit}>
          Obtenir le conseil
        </button>
        {v && <Verdict tone={v[0]} picto={v[1]} title={v[2]} text={result.message} />}
        {result?.notified && <p className="font-semibold text-leaf">Le conseil vous a aussi été envoyé par SMS.</p>}
        <ErrorNote error={error} />
      </div>
    </Shell>
  );
}

const PESTICIDE = {
  HOMOLOGUE: ['good', 'ok', 'Homologué'],
  NON_HOMOLOGUE: ['bad', 'non', 'Non homologué : ne l’utilisez pas'],
  INCONNU: ['warn', 'attention', 'Produit inconnu'],
};

export function Pesticide() {
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const check = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setResult(await api(`/inputs/check?name=${encodeURIComponent(name)}`, { auth: false }));
    } catch (err) {
      setError(err.message);
    }
  };
  const v = result && PESTICIDE[result.verdict];
  return (
    <Shell title="Vérifier un pesticide">
      <div className="flex items-center gap-4 pb-2 pt-2">
        <Picto name="pesticide" size={52} />
        <p className="text-[15px] text-soil-muted">Tapez le nom écrit sur le bidon : on vous dit s’il est autorisé au Bénin.</p>
      </div>
      <form className="mt-3 space-y-3" onSubmit={check} method="post">
        <label className="label" htmlFor="pname">
          Nom écrit sur le bidon
        </label>
        <input
          id="pname"
          className="input text-[18px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. SNIPER"
          required
          minLength={3}
          autoCapitalize="characters"
        />
        <button className="btn-primary w-full" type="submit">
          Vérifier
        </button>
      </form>
      {v && (
        <div className="mt-5">
          <Verdict tone={v[0]} picto={v[1]} title={v[2]} text={[result.message, result.alternative].filter(Boolean).join(' ')} />
        </div>
      )}
      {result?.source && (
        <p className="mt-3 px-1 text-[13px] text-soil-muted">
          Source : {result.source} {result.illustrative && <Demo>exemple</Demo>}
        </p>
      )}
      <ErrorNote error={error} />
    </Shell>
  );
}

const SHEET_PICTO = {
  bug: 'chenilles',
  sun: 'soleil',
  ban: 'non',
  flask: 'pesticide',
  receipt: 'recu',
  'cloud-rain': 'pluie',
  sprout: 'semis',
  wheat: 'mais',
};
const KIND_LABEL = { REGLEMENTATION: 'Règlementation', FICHE_LUTTE: 'Fiche pratique', CALENDRIER: 'Calendrier' };

// A large play button instead of the browser's small player: one tap to listen, progress visible.
function AudioPill({ src, captions, label }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-raised p-2 pr-4">
      <button
        type="button"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-leaf-mid text-leaf-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-leaf/40"
        aria-label={`${playing ? 'Pause' : 'Écouter'} en ${label}`}
        onClick={() => {
          const a = ref.current;
          if (a.paused) a.play().catch(() => {});
          else a.pause();
        }}
      >
        {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="ml-0.5 h-5 w-5" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{label}</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soil-line" aria-hidden="true">
          <div className="h-full rounded-full bg-leaf transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <audio
        ref={ref}
        preload="none"
        src={src}
        crossOrigin="anonymous"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
      >
        <track kind="captions" srcLang="fr" label="Français" src={captions} default />
      </audio>
    </div>
  );
}

export function Sheets() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/contents', { auth: false })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Shell title="Fiches et règles">
      <ErrorNote error={error} />
      <div className="space-y-4">
        {items.map((c) => (
          <article key={c.id} className="card">
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-raised">
                <Picto name={SHEET_PICTO[c.pictogram] ?? 'fiche'} size={36} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-soil-muted">{KIND_LABEL[c.kind] ?? 'Fiche'}</p>
                <h2 className="text-[18px] font-semibold leading-snug">{c.title}</h2>
              </div>
            </div>
            <p className="mt-3 text-[16px] leading-relaxed">{c.body}</p>
            {c.officialRef && (
              <p className="mt-2 flex items-start gap-1.5 text-[13px] text-soil-muted">
                <Gavel className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {c.officialRef}
              </p>
            )}
            <div className="mt-4 space-y-2 empty:hidden">
              {c.audios
                .filter((a) => a.origin !== 'SYNTHETIC')
                .map((a) => (
                  <div key={a.lang} className="space-y-1.5">
                    <AudioPill
                      src={`${API_URL}/contents/${c.id}/audio/${a.lang}`}
                      captions={`${API_URL}/contents/${c.id}/captions.vtt`}
                      label={LANG_LABEL[a.lang] ?? a.lang}
                    />
                  </div>
                ))}
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}

export function Alerts() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const load = () =>
    api('/alerts/me')
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const ack = async (id, action) => {
    const r = await sendOrQueue(`/alerts/notifications/${id}/ack`, action ? { action } : {}, 'accusé');
    if (r.sent) load();
  };
  return (
    <Shell title="Mes alertes">
      <ErrorNote error={error} />
      {!items.length && !error && (
        <div className="flex flex-col items-center px-6 pt-12 text-center">
          <Picto name="ok" size={72} />
          <p className="mt-4 font-display text-[20px] font-semibold">Aucune alerte pour vous</p>
          <p className="mt-1 text-[15px] text-soil-muted">Bonne saison. Vous serez prévenu ici et par SMS.</p>
        </div>
      )}
      <div className="space-y-3">
        {items.map((n) => (
          <article key={n.id} className={`rounded-3xl p-4 shadow-card ${n.readAt ? 'bg-surface' : 'bg-danger-light'}`}>
            <div className="flex items-start gap-3">
              <Picto name={n.kind === 'RAPPEL' ? 'rappel' : n.kind === 'REGLEMENTATION' ? 'fiche' : 'alerte'} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-soil-muted">
                  {{ ALERT: 'Alerte', RAPPEL: 'Rappel de culture', REGLEMENTATION: 'Nouvelle règle' }[n.kind] ?? 'Alerte'} ·{' '}
                  {fmtDate(n.createdAt)}
                </p>
                <p className="mt-0.5 text-[16px] font-semibold leading-snug">
                  {n.alert?.message ?? n.body.replace(/^AlerteAgri[^:]*: /, '')}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!n.readAt && (
                <button className="btn-primary min-h-[44px] rounded-full px-5" onClick={() => ack(n.id)}>
                  J’ai lu
                </button>
              )}
              {n.readAt && !n.action && (
                <button className="btn-ghost min-h-[44px] rounded-full px-5" onClick={() => ack(n.id, 'mesure prise')}>
                  J’ai agi
                </button>
              )}
              {n.action && <span className="badge self-center bg-leaf-light text-leaf">Action : {n.action}</span>}
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}

export { CommuneSelect, ProducerFor };
