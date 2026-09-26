import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BellRing, Bug, CheckCircle2, Clock, CloudRain, FlaskConical, Gavel, Hourglass, Phone, Receipt,
  ShieldAlert, ShieldCheck, ShieldQuestion, ShoppingBasket, Sprout, Sun, Wheat, BookOpen, Ban, Camera,
} from 'lucide-react';
import { api, newClientId, sendOrQueue, API_URL } from '../api';
import { CropPicker, Demo, ErrorNote, Shell, SpeakButton, Stat, Verdict, fmtDate, useSession } from '../ui';
import { MyParcels } from './advisor';

const HOME_BY_ROLE = { PRODUCER: '/producteur', ADVISOR: '/producteur', BUYER: '/marche', AGENT: '/tableau', ADMIN: '/tableau', COMMUNE: '/recettes' };

export function Home() {
  const [session] = useSession();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    Promise.all([api('/communes', { auth: false }), api('/contents', { auth: false }), api('/weather/status', { auth: false }), api('/market/listings', { auth: false })])
      .then(([c, f, w, l]) => setStats({ communes: c.length, fiches: f.length, weather: w?.finishedAt, listings: l.length }))
      .catch(() => {});
  }, []);
  return (
    <Shell title="Accueil" back={false}>
      <section className="overflow-hidden rounded-2xl bg-leaf-mid text-leaf-ink">
        <div className="p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80">Bénin · 77 communes surveillées</p>
          <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">Voir venir,<br />agir à temps.</h2>
          <p className="mt-3 max-w-xl text-base opacity-90">Alertes météo et ravageurs, conseil de semis, fiches dans votre langue, marché et taxe communale. Pour tous les producteurs, même sans lire, sans smartphone ou sans réseau.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {session ? (
              <Link to={HOME_BY_ROLE[session.user.role] ?? '/'} className="btn bg-surface text-leaf hover:bg-surface-raised">Continuer ({session.user.name})</Link>
            ) : (
              <Link to="/connexion" className="btn bg-surface text-leaf hover:bg-surface-raised">Se connecter</Link>
            )}
            <Link to="/telephone" className="btn border border-white/40 text-leaf-ink hover:bg-white/10"><Phone className="h-5 w-5" aria-hidden="true" /> Téléphone USSD</Link>
          </div>
        </div>
      </section>

      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Communes suivies" value={stats.communes} hint="relevé quotidien" />
          <Stat label="Dernier relevé" value={stats.weather ? new Date(stats.weather).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '–'} hint={stats.weather ? fmtDate(stats.weather) : 'Open-Meteo'} />
          <Stat label="Fiches publiées" value={stats.fiches} hint="lues à voix haute" />
          <Stat label="Offres ouvertes" value={stats.listings} hint="marché vivrier" />
        </div>
      )}

      <h2 className="section-title">Accès libre</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/semis" className="tile"><Sprout className="h-9 w-9 text-leaf" aria-hidden="true" />Semer ?</Link>
        <Link to="/pesticide" className="tile"><FlaskConical className="h-9 w-9 text-leaf" aria-hidden="true" />Vérifier un pesticide</Link>
        <Link to="/fiches" className="tile"><BookOpen className="h-9 w-9 text-leaf" aria-hidden="true" />Fiches et règles</Link>
        <Link to="/marche" className="tile"><ShoppingBasket className="h-9 w-9 text-leaf" aria-hidden="true" />Marché et prix</Link>
      </div>

      <h2 className="section-title">Comment ça marche</h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          [CloudRain, 'Observer', 'La météo réelle de chaque commune et les signalements des producteurs et conseillers.'],
          [BellRing, 'Alerter', 'Une règle validée par l’ATDA déclenche un SMS dans la commune et ses voisines.'],
          [CheckCircle2, 'Agir', 'Le producteur confirme la lecture puis l’action. L’agent voit la boucle se fermer.'],
        ].map(([Icon, title, text], i) => (
          <li key={title} className="card">
            <p className="flex items-center gap-2 font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-leaf-light text-sm text-leaf">{i + 1}</span><Icon className="h-5 w-5 text-leaf" aria-hidden="true" />{title}</p>
            <p className="mt-2 text-sm text-soil-muted">{text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-soil-muted">Données météo Open-Meteo. Les éléments marqués « démo » sont simulés. <a className="font-semibold text-leaf underline" href={`${API_URL}/docs`}>API ouverte</a>.</p>
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
    } catch (err) { setError(err.message); }
  };
  return (
    <Shell title="Connexion">
      <form className="card space-y-4" onSubmit={submit} method="post">
        <div>
          <label className="label" htmlFor="phone">Numéro de téléphone</label>
          <input id="phone" className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pin">Code PIN (4 chiffres)</label>
          <input id="pin" className="input tracking-[0.5em]" inputMode="numeric" type="password" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={(e) => setPin(e.target.value)} required />
        </div>
        <button className="btn-primary w-full" type="submit">Entrer</button>
        <ErrorNote error={error} />
      </form>
      <div className="card mt-4 text-sm">
        <p className="font-bold">Comptes de démonstration <Demo /></p>
        <p>Producteurs : +22997000001 (Parakou), +22997000004 (Bohicon) · Acheteur : +22996000001 · PIN 1234.</p>
        <p>Les comptes agent, commune et conseiller ont un PIN communiqué au jury.</p>
      </div>
    </Shell>
  );
}

export function ProducerHome() {
  const [session] = useSession();
  const [unread, setUnread] = useState(0);
  useEffect(() => { api('/alerts/me').then((n) => setUnread(n.filter((x) => !x.readAt).length)).catch(() => {}); }, []);
  if (!session) return <Shell title="Producteur"><Link className="btn-primary" to="/connexion">Se connecter</Link></Shell>;
  const tiles = [
    ['/alertes', BellRing, `Mes alertes${unread ? ` (${unread})` : ''}`],
    ['/semis', Sprout, 'Semer maintenant ?'],
    ['/signaler', Bug, 'Signaler un ravageur'],
    ['/recolte', Sun, 'Après la récolte'],
    ['/pesticide', FlaskConical, 'Vérifier un pesticide'],
    ['/fiches', BookOpen, 'Fiches et règles'],
    ['/marche', ShoppingBasket, 'Vendre'],
    ['/telephone', Phone, 'Téléphone USSD'],
  ];
  return (
    <Shell title={session.user.role === 'ADVISOR' ? 'Conseiller' : 'Mon champ'} back={false}>
      <p className="mb-3 text-lg">Bonjour <strong>{session.user.name}</strong></p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([to, Icon, label]) => (
          <Link key={to} to={to} className={`tile ${to === '/alertes' && unread ? 'border-danger' : ''}`} onClick={() => {}}>
            <Icon className={`h-10 w-10 ${to === '/alertes' && unread ? 'text-danger' : 'text-leaf'}`} aria-hidden="true" />{label}
          </Link>
        ))}
      </div>
      {session.user.role === 'PRODUCER' && <MyParcels />}
      {session.user.role === 'ADVISOR' && <AdvisorPanel />}
    </Shell>
  );
}

function AdvisorPanel() {
  const [producers, setProducers] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '+229', pin: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = () => api('/users/producers').then(setProducers).catch(() => {});
  useEffect(() => { load(); }, []);
  const enrol = async (e) => {
    e.preventDefault(); setError(''); setMsg('');
    try { await api('/users/producers', { method: 'POST', body: form }); setMsg('Producteur inscrit.'); setForm({ name: '', phone: '+229', pin: '' }); load(); } catch (err) { setError(err.message); }
  };
  return (
    <section className="card mt-6">
      <h2 className="text-lg font-bold">Mes producteurs ({producers.length})</h2>
      <p className="text-sm">Vous pouvez signaler, déclarer une récolte ou vendre au nom d’un producteur : chaque action est tracée.</p>
      <ul className="mt-2 divide-y divide-soil-line">
        {producers.map((p) => <li key={p.id} className="py-2">{p.name} · {p.phone}</li>)}
      </ul>
      <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={enrol} method="post">
        <input className="input" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required aria-label="Nom du producteur" />
        <input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required aria-label="Téléphone" />
        <input className="input" inputMode="numeric" maxLength={4} placeholder="PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} required aria-label="PIN" />
        <button className="btn-primary" type="submit">Inscrire</button>
      </form>
      {msg && <p className="mt-2 font-semibold text-leaf" role="status">{msg}</p>}
      <ErrorNote error={error} />
    </section>
  );
}

function useCommune() {
  const [session] = useSession();
  const [communes, setCommunes] = useState([]);
  const [communeId, setCommuneId] = useState(session?.user?.communeId ?? 'parakou');
  useEffect(() => { api('/communes', { auth: false }).then(setCommunes).catch(() => {}); }, []);
  return { communes, communeId, setCommuneId };
}

function CommuneSelect({ communes, value, onChange }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Commune">
      {communes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.department})</option>)}
    </select>
  );
}

function RainChart({ rain }) {
  if (!rain?.length) return null;
  const max = Math.max(20, ...rain.map((d) => d.rainMm));
  const w = 12;
  return (
    <figure className="card mt-4">
      <figcaption className="mb-2 text-sm font-semibold">Pluie par jour (mm) : mesurée <span className="inline-block h-3 w-3 rounded-sm bg-leaf align-middle" /> prévue <span className="inline-block h-3 w-3 rounded-sm bg-leaf/35 align-middle" /></figcaption>
      <svg viewBox={`0 0 ${rain.length * w} 110`} className="h-28 w-full" role="img" aria-label="Graphique des pluies mesurées et prévues">
        {rain.map((d, i) => {
          const h = (d.rainMm / max) * 100;
          return <rect key={i} x={i * w + 1} y={105 - h} width={w - 2} height={Math.max(h, 1)} className={d.isForecast ? 'fill-leaf/35' : 'fill-leaf'}><title>{`${fmtDate(d.date)} : ${d.rainMm} mm`}</title></rect>;
        })}
      </svg>
    </figure>
  );
}

export function Sowing() {
  const { communes, communeId, setCommuneId } = useCommune();
  const [cropId, setCropId] = useState('mais');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    api(`/advice/sowing?communeId=${communeId}&cropId=${cropId}`, { auth: false }).then(setResult).catch((e) => setError(e.message));
  }, [communeId, cropId]);
  const tone = { SEMEZ: 'good', ATTENDEZ: 'warn', HORS_SAISON: 'neutral' };
  const icon = { SEMEZ: CheckCircle2, ATTENDEZ: Hourglass, HORS_SAISON: Clock };
  const title = { SEMEZ: 'Vous pouvez semer', ATTENDEZ: 'Attendez', HORS_SAISON: 'Hors saison' };
  return (
    <Shell title="Semer maintenant ?">
      <div className="space-y-3">
        <CommuneSelect communes={communes} value={communeId} onChange={setCommuneId} />
        <CropPicker value={cropId} onChange={setCropId} only={['mais', 'soja', 'arachide', 'niebe', 'riz', 'sorgho', 'manioc', 'coton', 'tomate']} />
        {result && <Verdict tone={tone[result.verdict]} Icon={icon[result.verdict]} title={title[result.verdict]} text={result.reason} />}
        <ErrorNote error={error} />
        {result && <RainChart rain={result.rain} />}
        {result && <p className="text-sm">Périodes de semis ({result.zone === 'NORD' ? 'Nord, une saison' : 'Sud, deux saisons'}) : {result.windows.map((w) => `${w.from} au ${w.to}`).join(' ; ') || 'non renseignées'}. {result.source}.</p>}
      </div>
    </Shell>
  );
}

const SYMPTOMS = [
  ['feuilles-trouees', 'Feuilles trouées'], ['chenilles', 'Chenilles'], ['sciure-cornet', 'Sciure dans le cornet'],
  ['jaunissement', 'Jaunissement'], ['taches', 'Taches'], ['fletrissement', 'Plante flétrie'], ['insectes-piqueurs', 'Petits insectes'],
];

function ProducerFor({ value, onChange }) {
  const [session] = useSession();
  const [producers, setProducers] = useState([]);
  useEffect(() => { if (session?.user.role === 'ADVISOR') api('/users/producers').then(setProducers).catch(() => {}); }, [session]);
  if (session?.user.role !== 'ADVISOR') return null;
  return (
    <div>
      <label className="label" htmlFor="for">Au nom de</label>
      <select id="for" className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Moi-même</option>
        {producers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}

// Downscale on the phone before sending: a 4 MB photo becomes ~150 KB, which a 2G link can carry.
async function compressPhoto(file, max = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.72));
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
      pos = await new Promise((ok) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok({}), { timeout: 4000 }) : ok({}));
    } catch { pos = {}; }
    try {
      const r = await sendOrQueue('/reports', { clientId: newClientId(), cropId, symptom, ...pos, ...(forUserId ? { forUserId } : {}) }, 'signalement');
      if (r.sent && photo) {
        const form = new FormData();
        form.append('file', await compressPhoto(photo), 'photo.jpg');
        await api(`/reports/${r.data.id}/photo`, { method: 'POST', form }).catch(() => {});
      }
      setDone(r.sent ? 'sent' : 'queued');
    } catch (e) { setError(e.message); }
  };
  if (done) {
    return (
      <Shell title="Signaler un ravageur">
        <Verdict tone="good" Icon={CheckCircle2} title={done === 'sent' ? 'Signalement envoyé' : 'Signalement enregistré'}
          text={done === 'sent' ? 'Un agent va le vérifier. Vous serez prévenu si une alerte est lancée.' : 'Pas de réseau : il partira tout seul dès que le téléphone capte.'} />
        <button className="btn-ghost mt-4" onClick={() => { setDone(null); setSymptom(''); }}>Nouveau signalement</button>
      </Shell>
    );
  }
  return (
    <Shell title="Signaler un ravageur">
      <div className="space-y-4">
        <ProducerFor value={forUserId} onChange={setFor} />
        <h2 className="font-bold">1. Quelle culture ?</h2>
        <CropPicker value={cropId} onChange={setCropId} only={['mais', 'soja', 'arachide', 'niebe', 'riz', 'sorgho', 'manioc', 'coton', 'tomate']} />
        <h2 className="font-bold">2. Que voyez-vous ?</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Symptôme">
          {SYMPTOMS.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={symptom === id} onClick={() => setSymptom(id)} className={`tile min-h-20 ${symptom === id ? 'border-leaf bg-leaf-light' : ''}`}>
              <Bug className="h-7 w-7 text-warn" aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <h2 className="font-bold">3. Photo (facultatif)</h2>
        <label className="tile min-h-20 cursor-pointer">
          <Camera className="h-7 w-7 text-leaf" aria-hidden="true" />{photo ? `Photo prête (${Math.round(photo.size / 1024)} Ko avant réduction)` : 'Prendre une photo'}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <button className="btn-primary w-full" disabled={!symptom} onClick={submit}>Envoyer le signalement</button>
        <ErrorNote error={error} />
      </div>
    </Shell>
  );
}

export function Harvest() {
  const [cropId, setCropId] = useState('mais');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [forUserId, setFor] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const submit = async () => {
    setError(''); setResult(null);
    try { setResult(await api('/advice/harvest', { method: 'POST', body: { cropId, harvestDate: date, ...(forUserId ? { forUserId } : {}) } })); } catch (e) { setError(e.message); }
  };
  const tone = { SECHEZ: 'warn', COUVREZ: 'bad', SECHAGE_POSSIBLE: 'good', NON_CONCERNE: 'neutral', PAS_DE_PREVISION: 'neutral' };
  const title = { SECHEZ: 'Séchez maintenant', COUVREZ: 'Couvrez et abritez', SECHAGE_POSSIBLE: 'Bon moment pour sécher', NON_CONCERNE: 'Non concerné', PAS_DE_PREVISION: 'Pas de prévision' };
  return (
    <Shell title="Après la récolte">
      <div className="space-y-4">
        <p>Maïs et arachide mal séchés développent des aflatoxines, dangereuses pour la santé et refusées à la vente.</p>
        <ProducerFor value={forUserId} onChange={setFor} />
        <CropPicker value={cropId} onChange={setCropId} only={['mais', 'arachide']} />
        <div>
          <label className="label" htmlFor="hd">Date de récolte</label>
          <input id="hd" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn-primary w-full" onClick={submit}>Obtenir le conseil</button>
        {result && <Verdict tone={tone[result.code]} Icon={result.code === 'COUVREZ' ? CloudRain : Sun} title={title[result.code]} text={result.message} />}
        {result?.notified && <p className="font-semibold text-leaf">Le conseil vous a aussi été envoyé par SMS.</p>}
        <ErrorNote error={error} />
      </div>
    </Shell>
  );
}

export function Pesticide() {
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const check = async (e) => {
    e.preventDefault(); setError('');
    try { setResult(await api(`/inputs/check?name=${encodeURIComponent(name)}`, { auth: false })); } catch (err) { setError(err.message); }
  };
  const v = result && {
    HOMOLOGUE: ['good', ShieldCheck, 'Homologué'], NON_HOMOLOGUE: ['bad', ShieldAlert, 'Non homologué : ne l’utilisez pas'], INCONNU: ['warn', ShieldQuestion, 'Produit inconnu'],
  }[result.verdict];
  return (
    <Shell title="Vérifier un pesticide">
      <form className="space-y-3" onSubmit={check} method="post">
        <label className="label" htmlFor="pname">Nom écrit sur le bidon</label>
        <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. SNIPER" required minLength={3} />
        <button className="btn-primary w-full" type="submit">Vérifier</button>
      </form>
      {v && <div className="mt-4"><Verdict tone={v[0]} Icon={v[1]} title={v[2]} text={[result.message, result.alternative].filter(Boolean).join(' ')} /></div>}
      {result?.source && <p className="mt-2 text-sm">Source : {result.source} {result.illustrative && <Demo>exemple</Demo>}</p>}
      <ErrorNote error={error} />
    </Shell>
  );
}

const LANG_LABEL = { fon: 'Fon', yoruba: 'Yoruba', bariba: 'Bariba', dendi: 'Dendi', francais: 'Français' };
const PICTO = { bug: Bug, sun: Sun, ban: Ban, flask: FlaskConical, receipt: Receipt, 'cloud-rain': CloudRain, sprout: Sprout, wheat: Wheat };

export function Sheets() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api('/contents', { auth: false }).then(setItems).catch((e) => setError(e.message)); }, []);
  return (
    <Shell title="Fiches et règles">
      <ErrorNote error={error} />
      <div className="space-y-3">
        {items.map((c) => {
          const Icon = PICTO[c.pictogram] ?? BookOpen;
          return (
            <article key={c.id} className="card">
              <div className="flex items-start gap-3">
                <Icon className="h-9 w-9 shrink-0 text-leaf" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-soil/70">{c.kind === 'REGLEMENTATION' ? 'Règlementation' : c.kind === 'FICHE_LUTTE' ? 'Fiche pratique' : 'Calendrier'}</p>
                  <h2 className="text-lg font-bold">{c.title}</h2>
                  <p className="mt-1">{c.body}</p>
                  {c.officialRef && <p className="mt-1 text-sm"><Gavel className="mr-1 inline h-4 w-4" aria-hidden="true" />{c.officialRef}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SpeakButton text={`${c.title}. ${c.body}`} label="Écouter en français" />
                    {c.audios.map((a) => (
                      <div key={a.lang} className="flex w-full flex-col gap-1">
                        <span className="text-sm font-semibold">{LANG_LABEL[a.lang] ?? a.lang}</span>
                        <audio controls preload="none" src={`${API_URL}/contents/${c.id}/audio/${a.lang}`} className="h-10 w-full max-w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}

export function Alerts() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const load = () => api('/alerts/me').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const ack = async (id, action) => {
    const r = await sendOrQueue(`/alerts/notifications/${id}/ack`, action ? { action } : {}, 'accusé');
    if (r.sent) load();
  };
  return (
    <Shell title="Mes alertes">
      <ErrorNote error={error} />
      {!items.length && <p className="card">Aucune alerte pour vous. Bonne saison.</p>}
      <div className="space-y-3">
        {items.map((n) => (
          <article key={n.id} className={`card border-2 ${n.readAt ? '' : 'border-danger'}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`h-8 w-8 shrink-0 ${n.readAt ? 'text-soil/50' : 'text-danger'}`} aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-soil-muted">{fmtDate(n.createdAt)} · {{ ALERT: 'Alerte', RAPPEL: 'Rappel de culture', REGLEMENTATION: 'Nouvelle règle' }[n.kind] ?? 'Alerte'} · {n.channel}</p>
                <p className="font-semibold">{n.alert?.message ?? n.body.replace(/^AlerteAgri[^:]*: /, '')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <SpeakButton text={n.alert?.message ?? n.body} />
                  {!n.readAt && <button className="btn-primary min-h-10 py-2" onClick={() => ack(n.id)}>J’ai lu</button>}
                  {n.readAt && !n.action && <button className="btn-ghost min-h-10 py-2" onClick={() => ack(n.id, 'mesure prise')}>J’ai agi</button>}
                  {n.action && <span className="badge bg-leaf-light text-leaf">Action : {n.action}</span>}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}

export { LANG_LABEL, useCommune, CommuneSelect, ProducerFor, HOME_BY_ROLE };
