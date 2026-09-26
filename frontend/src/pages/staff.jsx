import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CloudDownload, Factory, Mic, RefreshCw, Square, Upload, XCircle } from 'lucide-react';
import { api, newClientId, sendOrQueue } from '../api';
import { Demo, ErrorNote, Shell, fmtDate, fmtFcfa, useSession } from '../ui';
import { LANG_LABEL } from './farmer';

const KIND_LABEL = { HEAVY_RAIN: 'Forte pluie', DRY_SPELL: 'Poche sèche', HEAT: 'Chaleur', DISEASE_HUMIDITY: 'Humidité', PEST_CLUSTER: 'Ravageur', POSTHARVEST: 'Post-récolte' };
const SYMPTOM_LABEL = { 'feuilles-trouees': 'feuilles trouées', chenilles: 'chenilles', 'sciure-cornet': 'sciure dans le cornet', jaunissement: 'jaunissement', taches: 'taches', fletrissement: 'flétrissement', 'insectes-piqueurs': 'petits insectes' };

function CommuneMap({ communes }) {
  if (!communes.length) return null;
  const lats = communes.map((c) => c.lat);
  const lons = communes.map((c) => c.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const W = 260;
  const H = 520;
  const x = (lon) => 20 + ((lon - minLon) / (maxLon - minLon || 1)) * (W - 40);
  const y = (lat) => 20 + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - 40);
  const color = (c) => (c.openAlerts ? '#991b1b' : c.reportsPending ? '#92400e' : '#14532d');
  return (
    <figure className="card">
      <figcaption className="mb-2 text-sm font-semibold">
        Communes : <span className="text-danger">alerte ouverte</span> · <span className="text-warn">signalement à vérifier</span> · <span className="text-leaf">calme</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-[28rem] w-auto" role="img" aria-label="Carte des communes et de leur niveau d’alerte">
        {communes.map((c) => (
          <g key={c.id}>
            <circle cx={x(c.lon)} cy={y(c.lat)} r={c.openAlerts ? 8 : 5} fill={color(c)} opacity={0.9}>
              <title>{`${c.name} : ${c.openAlerts} alerte(s), ${c.reportsPending} signalement(s) à vérifier`}</title>
            </circle>
            {(c.openAlerts > 0 || c.reportsPending > 0) && <text x={x(c.lon) + 10} y={y(c.lat) + 4} fontSize="10" fill="#3f2d1c">{c.name}</text>}
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function Dashboard() {
  const [session] = useSession();
  const role = session?.user.role;
  const [pole, setPole] = useState('');
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [value, setValue] = useState(null);
  const [gdiz, setGdiz] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const staff = role === 'AGENT' || role === 'ADMIN';
  const load = async () => {
    try {
      setOverview(await api(`/dashboard/overview${pole ? `?pole=${pole}` : ''}`));
      setAlerts(await api('/alerts'));
      setValue(await api('/dashboard/protected-value'));
      if (staff) {
        setReports((await api('/reports')).filter((r) => r.status === 'PENDING'));
        setOutbox(await api('/alerts/outbox'));
        setGdiz(await api('/dashboard/gdiz'));
      }
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (session) load(); }, [pole, session]);
  const act = async (label, fn) => {
    setBusy(label); setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  if (!session || !['AGENT', 'ADMIN', 'COMMUNE'].includes(role)) return <Shell title="Tableau de bord"><Link className="btn-primary" to="/connexion">Connexion agent</Link></Shell>;
  const totalValue = value?.alerts.reduce((s, a) => s + a.valueFcfa, 0) ?? 0;
  return (
    <Shell title="Tableau de bord" back={false}>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={pole} onChange={(e) => setPole(e.target.value)} aria-label="Pôle de développement agricole">
          <option value="">Tous les pôles</option>
          {[1, 2, 3, 4, 5, 6, 7].map((p) => <option key={p} value={p}>Pôle {p}</option>)}
        </select>
        {staff && <button className="btn-ghost" disabled={!!busy} onClick={() => act('météo', () => api('/weather/refresh', { method: 'POST' }))}><CloudDownload className="h-5 w-5" aria-hidden="true" />{busy === 'météo' ? 'Relevé…' : 'Relever la météo'}</button>}
        {staff && <button className="btn-ghost" disabled={!!busy} onClick={() => act('règles', () => api('/alerts/evaluate', { method: 'POST' }))}><RefreshCw className="h-5 w-5" aria-hidden="true" />{busy === 'règles' ? 'Analyse…' : 'Appliquer les règles'}</button>}
        {staff && <Link className="btn-ghost" to="/cms">Contenus</Link>}
        <Link className="btn-ghost" to="/recettes">Recettes</Link>
      </div>
      <ErrorNote error={error} />
      {overview && <p className="mt-2 text-sm">Dernier relevé météo : {overview.lastWeatherRun ? new Date(overview.lastWeatherRun).toLocaleString('fr-FR') : 'jamais'} (Open-Meteo).</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {overview && <CommuneMap communes={overview.communes} />}
        <div className="space-y-4">
          <section className="card">
            <h2 className="text-lg font-bold">Valeur protégée par les alertes ouvertes</h2>
            <p className="text-3xl font-black text-leaf">{fmtFcfa(totalValue)}</p>
            <p className="text-sm">Estimation : {value?.method}. <Demo>estimation</Demo></p>
          </section>
          {gdiz && (
            <section className="card">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Factory className="h-5 w-5" aria-hidden="true" />Offre déclarée face aux usines de la GDIZ</h2>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="text-left"><th>Filière</th><th>Attendu (t)</th><th>Capacité (t)</th></tr></thead>
                <tbody>{gdiz.crops.map((c) => <tr key={c.cropId}><td>{c.cropId}</td><td>{c.expectedT}</td><td>{c.capacityT.toLocaleString('fr-FR')}</td></tr>)}</tbody>
              </table>
              <p className="mt-1 text-xs">{gdiz.note} Source : {gdiz.source}.</p>
            </section>
          )}
        </div>
      </div>

      {staff && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">Signalements à vérifier ({reports.length})</h2>
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-center gap-2">
                <p className="flex-1"><strong>{r.crop.name}</strong> · {SYMPTOM_LABEL[r.symptom] ?? r.symptom} · {r.commune.name} · {fmtDate(r.createdAt)}{r.actingForId ? ' · par un conseiller' : ''}</p>
                <button className="btn-primary min-h-10 py-2" onClick={() => act('v', () => api(`/reports/${r.id}/validate`, { method: 'POST' }))}><CheckCircle2 className="h-5 w-5" aria-hidden="true" />Valider</button>
                <button className="btn-ghost min-h-10 py-2" onClick={() => act('r', () => api(`/reports/${r.id}/reject`, { method: 'POST' }))}><XCircle className="h-5 w-5" aria-hidden="true" />Rejeter</button>
              </div>
            ))}
            {!reports.length && <p className="card">Rien à vérifier.</p>}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-bold">Alertes et boucle</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left"><th>Commune</th><th>Type</th><th>Mesure</th><th>Envoyés</th><th>Lus</th><th>Actions</th><th>Signal → alerte</th><th>Statut</th></tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t border-soil-line">
                  <td>{a.commune.name}</td><td>{KIND_LABEL[a.kind]}</td><td>{Math.round(a.measured * 10) / 10}</td>
                  <td>{a.loop.sent}</td><td>{a.loop.read}</td><td>{a.loop.actions}</td><td>{a.loop.signalToAlertMin} min</td>
                  <td>{a.status === 'OPEN' ? (staff ? <button className="btn-ghost min-h-9 px-2 py-1" onClick={() => act('c', () => api(`/alerts/${a.id}/close`, { method: 'POST' }))}>Clore</button> : 'ouverte') : `close${a.loop.alertToCloseMin != null ? ` (${a.loop.alertToCloseMin} min)` : ''}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {staff && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">SMS envoyés <Demo>boîte d’envoi interne</Demo></h2>
          <ul className="space-y-1 text-sm">
            {outbox.slice(0, 15).map((n) => <li key={n.id} className="card py-2"><strong>{n.user.phone}</strong> · {n.status}{n.readAt ? ' · lu' : ''} : {n.body}</li>)}
          </ul>
        </section>
      )}
    </Shell>
  );
}

function AudioRecorder({ contentId, onDone }) {
  const [lang, setLang] = useState('fon');
  const [rec, setRec] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const chunks = useRef([]);
  const upload = async (blob, name) => {
    setError(''); setMsg('');
    const form = new FormData();
    form.append('file', blob, name);
    try { await api(`/cms/contents/${contentId}/audio/${lang}`, { method: 'POST', form }); setMsg(`Audio ${LANG_LABEL[lang]} enregistré.`); onDone(); } catch (e) { setError(e.message); }
  };
  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); upload(new Blob(chunks.current, { type: r.mimeType }), 'enregistrement.webm'); };
      r.start();
      setRec(r);
    } catch { setError('Micro indisponible : autorisez le micro ou envoyez un fichier.'); }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select className="input w-auto" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Langue de l’audio">
        {Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {!rec ? (
        <button className="btn-ghost" type="button" onClick={start}><Mic className="h-5 w-5" aria-hidden="true" />Enregistrer</button>
      ) : (
        <button className="btn-primary" type="button" onClick={() => { rec.stop(); setRec(null); }}><Square className="h-5 w-5" aria-hidden="true" />Arrêter et envoyer</button>
      )}
      <label className="btn-ghost cursor-pointer"><Upload className="h-5 w-5" aria-hidden="true" />Fichier
        <input type="file" accept="audio/*" className="sr-only" onChange={(e) => e.target.files[0] && upload(e.target.files[0], e.target.files[0].name)} />
      </label>
      {msg && <span className="font-semibold text-leaf" role="status">{msg}</span>}
      <ErrorNote error={error} />
    </div>
  );
}

const EMPTY = { kind: 'FICHE_LUTTE', title: '', body: '', pictogram: 'bug', officialRef: '' };

export function Cms() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/cms/contents').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const save = async (e) => {
    e.preventDefault(); setError('');
    const body = { ...form, officialRef: form.officialRef || undefined };
    try {
      if (editing) await api(`/cms/contents/${editing}`, { method: 'PUT', body }); else await api('/cms/contents', { method: 'POST', body });
      setForm(EMPTY); setEditing(null); load();
    } catch (err) { setError(err.message); }
  };
  const toggle = async (c) => { await api(`/cms/contents/${c.id}/${c.status === 'PUBLISHED' ? 'unpublish' : 'publish'}`, { method: 'POST' }); load(); };
  return (
    <Shell title="Contenus">
      <form className="card space-y-3" onSubmit={save} method="post">
        <h2 className="text-lg font-bold">{editing ? 'Modifier la fiche' : 'Nouvelle fiche'}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Type"><option value="FICHE_LUTTE">Fiche pratique</option><option value="REGLEMENTATION">Réglementation</option><option value="CALENDRIER">Calendrier</option></select>
          <select className="input" value={form.pictogram} onChange={(e) => setForm({ ...form, pictogram: e.target.value })} aria-label="Pictogramme">{['bug', 'sun', 'ban', 'flask', 'receipt', 'cloud-rain', 'sprout', 'wheat'].map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <input className="input" placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={3} aria-label="Titre" />
        <textarea className="input min-h-28 py-2" placeholder="Texte simple, phrases courtes" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required minLength={10} aria-label="Texte" />
        <input className="input" placeholder="Référence officielle (texte, décret, source)" value={form.officialRef} onChange={(e) => setForm({ ...form, officialRef: e.target.value })} aria-label="Référence officielle" />
        <button className="btn-primary" type="submit">{editing ? 'Enregistrer une nouvelle version' : 'Créer en brouillon'}</button>
        <ErrorNote error={error} />
      </form>
      <div className="mt-4 space-y-3">
        {items.map((c) => (
          <article key={c.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex-1 font-bold">{c.title}</h3>
              <span className={`badge ${c.status === 'PUBLISHED' ? 'bg-leaf-light text-leaf' : 'bg-soil-line text-soil'}`}>{c.status === 'PUBLISHED' ? 'publiée' : 'brouillon'} · v{c.version}</span>
              <button className="btn-ghost min-h-10 py-2" onClick={() => toggle(c)}>{c.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}</button>
              <button className="btn-ghost min-h-10 py-2" onClick={() => { setEditing(c.id); setForm({ kind: c.kind, title: c.title, body: c.body, pictogram: c.pictogram, officialRef: c.officialRef ?? '' }); window.scrollTo(0, 0); }}>Modifier</button>
            </div>
            <p className="mt-1 text-sm">Audios : {c.audios.length ? c.audios.map((a) => LANG_LABEL[a.lang] ?? a.lang).join(', ') : 'aucun'}</p>
            <AudioRecorder contentId={c.id} onDone={load} />
          </article>
        ))}
      </div>
    </Shell>
  );
}

export function Commune() {
  const [session] = useSession();
  const [rates, setRates] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [f, setF] = useState({ cropId: 'mais', quantityKg: 100 });
  const [last, setLast] = useState(null);
  const [error, setError] = useState('');
  const communeId = session?.user.communeId;
  const load = async () => {
    try {
      setRates(await api(`/tax/rates${session?.user.role === 'COMMUNE' ? `?communeId=${communeId}` : ''}`, { auth: false }));
      setRevenue(await api('/tax/revenue'));
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (session) load(); }, [session]);
  const collect = async (e) => {
    e.preventDefault(); setError('');
    try {
      const r = await sendOrQueue('/tax/collect', { clientId: newClientId(), cropId: f.cropId, quantityKg: Number(f.quantityKg) }, 'encaissement');
      setLast(r.sent ? r.data : { queued: true }); load();
    } catch (err) { setError(err.message); }
  };
  if (!session) return <Shell title="Recettes"><Link className="btn-primary" to="/connexion">Connexion</Link></Shell>;
  const total = revenue?.byCommuneAndCrop.reduce((s, r) => s + (r._sum.amountFcfa ?? 0), 0) ?? 0;
  return (
    <Shell title="Recettes communales (TDL)" back={session.user.role !== 'COMMUNE'}>
      <ErrorNote error={error} />
      <section className="card">
        <h2 className="text-lg font-bold">Total encaissé</h2>
        <p className="text-3xl font-black text-leaf">{fmtFcfa(total)}</p>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left"><th>Commune</th><th>Produit</th><th>Paiements</th><th>Montant</th></tr></thead>
          <tbody>{revenue?.byCommuneAndCrop.map((r) => <tr key={`${r.communeId}-${r.cropId}`}><td>{r.communeId}</td><td>{r.cropId}</td><td>{r._count}</td><td>{fmtFcfa(r._sum.amountFcfa ?? 0)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="card mt-4">
        <h2 className="text-lg font-bold">Barème <Demo>fictif, fixé par le conseil communal</Demo></h2>
        <ul className="mt-1 text-sm">{rates.map((r) => <li key={r.id}>{r.commune.name} · {r.crop.name} : {r.fcfaPer100Kg} FCFA / 100 kg</li>)}</ul>
      </section>
      {session.user.role === 'COMMUNE' && (
        <form className="card mt-4 space-y-3" onSubmit={collect} method="post">
          <h2 className="text-lg font-bold">Encaisser sur le marché</h2>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={f.cropId} onChange={(e) => setF({ ...f, cropId: e.target.value })} aria-label="Produit">{rates.map((r) => <option key={r.id} value={r.cropId}>{r.crop.name}</option>)}</select>
            <input className="input" type="number" min="1" value={f.quantityKg} onChange={(e) => setF({ ...f, quantityKg: e.target.value })} aria-label="Quantité (kg)" />
          </div>
          <button className="btn-primary w-full" type="submit">Encaisser et émettre le reçu</button>
          {last?.queued && <p className="font-semibold text-warn">Hors ligne : l’encaissement sera envoyé au retour du réseau, sans doublon.</p>}
          {last?.receiptId && <p className="font-semibold text-leaf">Reçu {last.receiptId} : {fmtFcfa(last.amountFcfa)}.</p>}
        </form>
      )}
    </Shell>
  );
}
