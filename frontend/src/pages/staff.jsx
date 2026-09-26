import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BellRing, CheckCircle2, CloudDownload, Download, Factory, FileSpreadsheet, Mic, RefreshCw, Send, ShieldCheck, Square, Sun, Upload, XCircle,
} from 'lucide-react';
import { api, newClientId, sendOrQueue } from '../api';
import { AuthImage, CROPS, Demo, ErrorNote, Shell, Stat, StatusLegend, StatusMark, Tabs, downloadWithAuth, fmtDate, fmtFcfa, useSession } from '../ui';
import { LANG_LABEL } from './farmer';

const KIND_LABEL = { HEAVY_RAIN: 'Forte pluie', DRY_SPELL: 'Poche sèche', HEAT: 'Chaleur', DISEASE_HUMIDITY: 'Humidité', PEST_CLUSTER: 'Ravageur', POSTHARVEST: 'Post-récolte' };
const SYMPTOM_LABEL = { 'feuilles-trouees': 'feuilles trouées', chenilles: 'chenilles', 'sciure-cornet': 'sciure dans le cornet', jaunissement: 'jaunissement', taches: 'taches', fletrissement: 'flétrissement', 'insectes-piqueurs': 'petits insectes' };
const cropName = (id) => CROPS.find((c) => c.id === id)?.name ?? id;

function communeStatus(c) {
  if (c.openAlerts) return 'alert';
  if (c.reportsPending) return 'check';
  return 'calm';
}

function CommuneMap({ communes }) {
  const [hover, setHover] = useState(null);
  if (!communes.length) return null;
  const lats = communes.map((c) => c.lat);
  const lons = communes.map((c) => c.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const W = 300;
  const H = 560;
  const x = (lon) => 24 + ((lon - minLon) / (maxLon - minLon || 1)) * (W - 48);
  const y = (lat) => 24 + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - 48);
  const order = { calm: 0, check: 1, alert: 2 };
  const sorted = [...communes].sort((a, b) => order[communeStatus(a)] - order[communeStatus(b)]);
  // Greedy label placement: flip a label to the left when it would collide with one already placed.
  const placed = [];
  const labelSide = {};
  for (const c of sorted.filter((c) => communeStatus(c) !== 'calm')) {
    const px = x(c.lon);
    const py = y(c.lat);
    const clash = placed.some((p) => Math.abs(p.y - py) < 13 && p.x < px + 80 && px < p.x + 80);
    labelSide[c.id] = clash ? 'left' : 'right';
    placed.push({ x: clash ? px - 80 : px, y: py });
  }
  return (
    <figure className="card relative">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">Carte des communes</span>
        <StatusLegend />
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-[30rem] w-auto max-w-full" role="img" aria-label="Carte des communes du Bénin avec leur état : alerte, à vérifier ou calme">
        {sorted.map((c) => {
          const st = communeStatus(c);
          const r = st === 'alert' ? 7 : st === 'check' ? 6 : 4.5;
          return (
            <g key={c.id} tabIndex={0} role="img" aria-label={`${c.name} : ${c.openAlerts} alerte(s), ${c.reportsPending} signalement(s) à vérifier`}
              onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c)} onBlur={() => setHover(null)} className="cursor-pointer outline-none">
              <circle cx={x(c.lon)} cy={y(c.lat)} r={12} fill="transparent" />
              <StatusMark status={st} x={x(c.lon)} y={y(c.lat)} r={r} stroke="rgb(var(--surface))" strokeWidth="2" />
              {st !== 'calm' && <text x={labelSide[c.id] === 'left' ? x(c.lon) - 11 : x(c.lon) + 11} y={y(c.lat) + 4} fontSize="11" textAnchor={labelSide[c.id] === 'left' ? 'end' : 'start'} className="fill-soil font-semibold">{c.name}</text>}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute left-4 top-14 rounded-lg border border-soil-line bg-surface p-3 text-sm shadow-card" role="status">
          <p className="font-bold">{hover.name}</p>
          <p className="text-soil-muted">{hover.department} · pôle {hover.pole}</p>
          <p>{hover.openAlerts} alerte(s) ouverte(s){hover.alertKinds.length ? ` : ${hover.alertKinds.map((k) => KIND_LABEL[k]).join(', ')}` : ''}</p>
          <p>{hover.reportsPending} signalement(s) à vérifier · {hover.reportsValidated} validé(s)</p>
        </div>
      )}
    </figure>
  );
}

function HBars({ rows, max, format = (v) => v, label }) {
  return (
    <ul className="space-y-2" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate font-semibold">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-r-md bg-surface-raised" title={`${r.label} : ${format(r.value)}`}>
            <span className="block h-full rounded-r-md bg-leaf-mid" style={{ width: `${Math.max(1, (r.value / (max || 1)) * 100)}%` }} />
          </span>
          <span className="tabular-nums text-soil-muted">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Overview({ overview, alerts, value, gdiz, reportsCount }) {
  const open = alerts.filter((a) => a.status === 'OPEN');
  const sent = alerts.reduce((s, a) => s + a.loop.sent, 0);
  const read = alerts.reduce((s, a) => s + a.loop.read, 0);
  // The same parcels sit under every open alert of their commune: count each commune once.
  const perCommune = (value?.alerts ?? []).reduce((acc, a) => ({ ...acc, [a.commune]: Math.max(acc[a.commune] ?? 0, a.valueFcfa) }), {});
  const totalValue = Object.values(perCommune).reduce((s, v) => s + v, 0);
  const byCommuneKind = Object.values((value?.alerts ?? []).filter((a) => a.valueFcfa > 0).reduce((acc, a) => {
    const k = `${a.commune}|${a.kind}`;
    acc[k] = acc[k] ? { ...acc[k], valueFcfa: Math.max(acc[k].valueFcfa, a.valueFcfa), count: acc[k].count + 1 } : { ...a, count: 1 };
    return acc;
  }, {})).sort((a, b) => b.valueFcfa - a.valueFcfa);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alertes ouvertes" value={open.length} tone={open.length ? 'bad' : 'good'} Icon={BellRing} hint={`${overview?.communes.filter((c) => c.openAlerts).length ?? 0} commune(s)`} />
        <Stat label="À vérifier" value={reportsCount} tone={reportsCount ? 'warn' : 'good'} Icon={AlertTriangle} hint="signalements terrain" />
        <Stat label="Taux de lecture" value={sent ? `${Math.round((read / sent) * 100)} %` : '–'} Icon={CheckCircle2} hint={`${read} lus sur ${sent} SMS`} />
        <Stat label="Valeur protégée" value={fmtFcfa(totalValue)} tone="good" Icon={ShieldCheck} hint="estimation, parcelles comptées une fois" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {overview && <CommuneMap communes={overview.communes} />}
        <div className="space-y-4">
          {gdiz && (
            <section className="card">
              <h2 className="flex items-center gap-2 font-bold"><Factory className="h-5 w-5 text-leaf" aria-hidden="true" />Offre déclarée face aux usines de la GDIZ</h2>
              <p className="mb-3 text-sm text-soil-muted">Part de la capacité installée couverte par les parcelles déclarées.</p>
              <HBars label="Couverture de la capacité GDIZ par filière" rows={gdiz.crops.map((c) => ({ key: c.cropId, label: cropName(c.cropId), value: c.coverage * 100 }))} max={Math.max(1, ...gdiz.crops.map((c) => c.coverage * 100))}
                format={(v) => `${v < 0.1 && v > 0 ? '<0,1' : v.toFixed(1)} %`} />
              <table className="table mt-3">
                <thead><tr><th>Filière</th><th>Attendu (t)</th><th>Capacité (t)</th></tr></thead>
                <tbody>{gdiz.crops.map((c) => <tr key={c.cropId}><td>{cropName(c.cropId)}</td><td className="tabular-nums">{c.expectedT}</td><td className="tabular-nums">{c.capacityT.toLocaleString('fr-FR')}</td></tr>)}</tbody>
              </table>
              <p className="mt-2 text-xs text-soil-muted">{gdiz.note} Source : {gdiz.source}.</p>
            </section>
          )}
          {value && (
            <section className="card">
              <h2 className="font-bold">Valeur protégée par alerte</h2>
              <p className="mb-2 text-xs text-soil-muted">{value.method}. <Demo>estimation</Demo></p>
              <ul className="divide-y divide-soil-line text-sm">
                {byCommuneKind.slice(0, 6).map((a) => <li key={`${a.commune}-${a.kind}`} className="flex justify-between py-1.5"><span>{a.commune} · {KIND_LABEL[a.kind]}{a.count > 1 ? ` (${a.count} périodes)` : ''}</span><span className="tabular-nums font-semibold">{fmtFcfa(a.valueFcfa)}</span></li>)}
                {!byCommuneKind.length && <li className="py-1.5 text-soil-muted">Aucune parcelle déclarée sous une alerte ouverte.</li>}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function ReportsTab({ reports, act }) {
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <article key={r.id} className="card grid gap-3 sm:grid-cols-[8rem_1fr]">
          {r.hasPhoto ? <AuthImage path={`/reports/${r.id}/photo`} alt={`Photo du signalement : ${SYMPTOM_LABEL[r.symptom]} sur ${r.crop.name}`} className="h-32 w-full rounded-lg object-cover sm:w-32" /> : <div className="flex h-20 items-center justify-center rounded-lg bg-surface-raised text-xs text-soil-muted sm:h-32">sans photo</div>}
          <div>
            <p className="font-bold">{r.crop.name} · {SYMPTOM_LABEL[r.symptom] ?? r.symptom}</p>
            <p className="text-sm text-soil-muted">{r.commune.name} · {fmtDate(r.createdAt)}{r.actingForId ? ' · par un conseiller' : ''}{r.lat ? ` · ${r.lat.toFixed(3)}, ${r.lon.toFixed(3)}` : ''}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary min-h-10 py-2" onClick={() => act(() => api(`/reports/${r.id}/validate`, { method: 'POST' }))}><CheckCircle2 className="h-5 w-5" aria-hidden="true" />Valider</button>
              <button className="btn-ghost min-h-10 py-2" onClick={() => act(() => api(`/reports/${r.id}/reject`, { method: 'POST' }))}><XCircle className="h-5 w-5" aria-hidden="true" />Rejeter</button>
            </div>
          </div>
        </article>
      ))}
      {!reports.length && <p className="card">Rien à vérifier.</p>}
    </div>
  );
}

function AlertsTab({ alerts, outbox, staff, act }) {
  return (
    <>
      <div className="card overflow-x-auto p-0">
        <table className="table min-w-[680px]">
          <thead><tr><th>Commune</th><th>Type</th><th>Mesure</th><th>Envoyés</th><th>Lus</th><th>Actions</th><th>Signal → alerte</th><th>Statut</th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.commune.name}</td><td>{KIND_LABEL[a.kind]}</td><td className="tabular-nums">{Math.round(a.measured * 10) / 10}</td>
                <td className="tabular-nums">{a.loop.sent}{a.loop.failed ? <span className="text-danger"> ({a.loop.failed} échec)</span> : ''}</td><td className="tabular-nums">{a.loop.read}</td><td className="tabular-nums">{a.loop.actions}</td><td className="tabular-nums">{a.loop.signalToAlertMin} min</td>
                <td>{a.status === 'OPEN'
                  ? (staff ? <button className="btn-ghost min-h-9 px-2 py-1 text-sm" onClick={() => act(() => api(`/alerts/${a.id}/close`, { method: 'POST' }))}>Clore</button> : <span className="badge bg-danger-light text-danger">ouverte</span>)
                  : <span className="badge bg-leaf-light text-leaf">close{a.loop.alertToCloseMin != null ? ` · ${a.loop.alertToCloseMin} min` : ''}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {staff && (
        <>
          <h2 className="section-title">SMS envoyés <Demo>boîte d’envoi interne</Demo></h2>
          <ul className="space-y-2 text-sm">
            {outbox.slice(0, 20).map((n) => (
              <li key={n.id} className="card py-2">
                <p className="flex flex-wrap items-center gap-2"><strong className="tabular-nums">{n.user.phone}</strong>
                  <span className={`badge ${n.status === 'FAILED' ? 'bg-danger-light text-danger' : n.readAt ? 'bg-leaf-light text-leaf' : 'bg-surface-raised text-soil-muted'}`}>{n.status === 'FAILED' ? 'échec' : n.readAt ? 'lu' : 'envoyé'}</span>
                  <span className="text-soil-muted">{n.kind === 'RAPPEL' ? 'rappel' : n.kind === 'REGLEMENTATION' ? 'règle' : 'alerte'}</span></p>
                <p className="mt-1">{n.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function RulesTab() {
  const [rules, setRules] = useState([]);
  const [crops, setCrops] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = () => { api('/alerts/rules').then(setRules).catch((e) => setError(e.message)); api('/crops', { auth: false }).then(setCrops).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const save = async (r) => {
    setError(''); setMsg('');
    try { await api(`/alerts/rules/${r.id}`, { method: 'PUT', body: { threshold: Number(r.threshold), windowDays: Number(r.windowDays), neighborKm: Number(r.neighborKm), active: r.active, message: r.message } }); setMsg(`Règle « ${r.label} » enregistrée.`); load(); } catch (e) { setError(e.message); }
  };
  const saveWindow = async (cropId, w) => {
    setError(''); setMsg('');
    try { await api(`/crops/${cropId}/windows`, { method: 'PUT', body: { zone: w.zone, season: w.season, start: w.startMmDd, end: w.endMmDd } }); setMsg('Calendrier enregistré.'); load(); } catch (e) { setError(e.message); }
  };
  const edit = (id, patch) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const editWindow = (cropId, wid, patch) => setCrops((cs) => cs.map((c) => (c.id !== cropId ? c : { ...c, windows: c.windows.map((w) => (w.id === wid ? { ...w, ...patch } : w)) })));
  return (
    <>
      {msg && <p className="mb-3 rounded-xl bg-leaf-light p-3 font-semibold text-leaf" role="status">{msg}</p>}
      <ErrorNote error={error} />
      <h2 className="section-title mt-0">Règles d’alerte</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {rules.map((r) => (
          <form key={r.id} className="card space-y-2" onSubmit={(e) => { e.preventDefault(); save(r); }} method="post">
            <div className="flex items-center justify-between"><h3 className="font-bold">{r.label}</h3>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={r.active} onChange={(e) => edit(r.id, { active: e.target.checked })} />active</label></div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm">Seuil<input className="input mt-1" type="number" step="0.1" value={r.threshold} onChange={(e) => edit(r.id, { threshold: e.target.value })} /></label>
              <label className="text-sm">Fenêtre (j)<input className="input mt-1" type="number" value={r.windowDays} onChange={(e) => edit(r.id, { windowDays: e.target.value })} /></label>
              <label className="text-sm">Voisins (km)<input className="input mt-1" type="number" value={r.neighborKm} onChange={(e) => edit(r.id, { neighborKm: e.target.value })} /></label>
            </div>
            <label className="text-sm">Message SMS<textarea className="input mt-1 min-h-20 py-2" value={r.message} onChange={(e) => edit(r.id, { message: e.target.value })} /></label>
            <button className="btn-ghost w-full" type="submit">Enregistrer</button>
          </form>
        ))}
      </div>
      <h2 className="section-title">Calendriers de semis</h2>
      <div className="card overflow-x-auto p-0">
        <table className="table min-w-[560px]">
          <thead><tr><th>Culture</th><th>Zone</th><th>Saison</th><th>Début (MM-JJ)</th><th>Fin (MM-JJ)</th><th /></tr></thead>
          <tbody>
            {crops.flatMap((c) => c.windows.map((w) => (
              <tr key={w.id}>
                <td className="font-semibold">{c.name}</td><td>{w.zone === 'NORD' ? 'Nord' : 'Sud'}</td><td>{w.season}</td>
                <td><input className="input min-h-10 w-24" value={w.startMmDd} onChange={(e) => editWindow(c.id, w.id, { startMmDd: e.target.value })} aria-label={`Début ${c.name} ${w.zone}`} /></td>
                <td><input className="input min-h-10 w-24" value={w.endMmDd} onChange={(e) => editWindow(c.id, w.id, { endMmDd: e.target.value })} aria-label={`Fin ${c.name} ${w.zone}`} /></td>
                <td><button className="btn-ghost min-h-10 py-1" onClick={() => saveWindow(c.id, w)}>OK</button></td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DroughtTab() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/dashboard/drought').then(setD).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorNote error={error} />;
  if (!d) return <p className="card">Calcul…</p>;
  const top = d.communes.slice(0, 12);
  return (
    <>
      <section className="card">
        <h2 className="flex items-center gap-2 font-bold"><Sun className="h-5 w-5 text-warn" aria-hidden="true" />Indice de sécheresse par commune <Demo>simulation d’assurance indicielle</Demo></h2>
        <p className="mb-3 mt-1 text-sm text-soil-muted">{d.method}.</p>
        <HBars label="Indice de sécheresse, communes les plus exposées" rows={top.map((c) => ({ key: c.communeId, label: c.name, value: c.index }))} max={1} format={(v) => v.toFixed(2)} />
      </section>
      <div className="card mt-4 overflow-x-auto p-0">
        <table className="table min-w-[560px]">
          <thead><tr><th>Commune</th><th>Pôle</th><th>Pluie (mm)</th><th>ET0 (mm)</th><th>Indice</th><th>Versement indicatif / ha</th></tr></thead>
          <tbody>{d.communes.map((c) => <tr key={c.communeId}><td className="font-semibold">{c.name}</td><td>{c.pole}</td><td className="tabular-nums">{c.rainMm}</td><td className="tabular-nums">{c.et0Mm}</td><td className="tabular-nums">{c.index.toFixed(2)}</td><td className="tabular-nums">{fmtFcfa(c.payoutFcfaPerHa)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function InteropTab({ act }) {
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  const load = () => api('/integrations/log').then(setLog).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-2">
        <h2 className="flex items-center gap-2 font-bold"><FileSpreadsheet className="h-5 w-5 text-leaf" aria-hidden="true" />FAMEWS (FAO)</h2>
        <p className="text-sm text-soil-muted">Signalements validés de chenille légionnaire au format d’échange FAMEWS, sans donnée personnelle.</p>
        <button className="btn-ghost" onClick={() => downloadWithAuth('/exports/famews', 'famews-benin.csv').catch((e) => setError(e.message))}><Download className="h-5 w-5" aria-hidden="true" />Télécharger le CSV</button>
      </section>
      <section className="card space-y-2">
        <h2 className="flex items-center gap-2 font-bold"><Factory className="h-5 w-5 text-leaf" aria-hidden="true" />Marché terminal SIPI-Bénin <Demo>adaptateur simulé</Demo></h2>
        <p className="text-sm text-soil-muted">Envoie les lots traçés (culture, poids, humidité, origine) au marché terminal de la GDIZ.</p>
        <button className="btn-ghost" onClick={() => act(async () => { await api('/integrations/sipi/lots', { method: 'POST' }); await load(); })}><Send className="h-5 w-5" aria-hidden="true" />Envoyer les lots</button>
        <ul className="text-sm">{log.map((l) => <li key={l.id} className="border-t border-soil-line py-1.5">{new Date(l.createdAt).toLocaleString('fr-FR')} · {l.target} · {l.items} lot(s) · {l.status}{l.simulated ? ' (simulé)' : ''}</li>)}</ul>
      </section>
      <ErrorNote error={error} />
    </div>
  );
}

export function Dashboard() {
  const [session] = useSession();
  const role = session?.user.role;
  const staff = role === 'AGENT' || role === 'ADMIN';
  const [tab, setTab] = useState('overview');
  const [pole, setPole] = useState('');
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [value, setValue] = useState(null);
  const [gdiz, setGdiz] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const [o, a, v] = await Promise.all([api(`/dashboard/overview${pole ? `?pole=${pole}` : ''}`), api('/alerts'), api('/dashboard/protected-value')]);
      setOverview(o); setAlerts(a); setValue(v);
      if (staff) {
        const [r, ob, g] = await Promise.all([api('/reports'), api('/alerts/outbox'), api('/dashboard/gdiz')]);
        setReports(r.filter((x) => x.status === 'PENDING')); setOutbox(ob); setGdiz(g);
      }
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (session) load(); }, [pole, session]);
  const act = async (fn, label = 'x') => {
    setBusy(label); setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  if (!session || !['AGENT', 'ADMIN', 'COMMUNE'].includes(role)) return <Shell title="Tableau de bord"><Link className="btn-primary" to="/connexion">Connexion agent</Link></Shell>;
  const tabs = staff
    ? [['overview', 'Vue d’ensemble'], ['reports', `Signalements (${reports.length})`], ['alerts', 'Alertes et SMS'], ['rules', 'Règles et calendriers'], ['drought', 'Sécheresse'], ['interop', 'Interopérabilité']]
    : [['overview', 'Vue d’ensemble'], ['alerts', 'Alertes']];
  return (
    <Shell title="Tableau de bord" back={false} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={pole} onChange={(e) => setPole(e.target.value)} aria-label="Pôle de développement agricole">
          <option value="">Tous les pôles</option>
          {[1, 2, 3, 4, 5, 6, 7].map((p) => <option key={p} value={p}>Pôle {p}</option>)}
        </select>
        {staff && <button className="btn-ghost" disabled={!!busy} onClick={() => act(() => api('/weather/refresh', { method: 'POST' }), 'meteo')}><CloudDownload className="h-5 w-5" aria-hidden="true" />{busy === 'meteo' ? 'Relevé…' : 'Relever la météo'}</button>}
        {staff && <button className="btn-ghost" disabled={!!busy} onClick={() => act(async () => { await api('/alerts/evaluate', { method: 'POST' }); await api('/parcels/reminders/run', { method: 'POST' }); }, 'regles')}><RefreshCw className="h-5 w-5" aria-hidden="true" />{busy === 'regles' ? 'Analyse…' : 'Appliquer règles et rappels'}</button>}
        <span className="text-sm text-soil-muted">Dernier relevé : {overview?.lastWeatherRun ? new Date(overview.lastWeatherRun).toLocaleString('fr-FR') : 'jamais'}</span>
      </div>
      <ErrorNote error={error} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && <Overview overview={overview} alerts={alerts} value={value} gdiz={gdiz} reportsCount={reports.length} />}
      {tab === 'reports' && <ReportsTab reports={reports} act={act} />}
      {tab === 'alerts' && <AlertsTab alerts={alerts} outbox={outbox} staff={staff} act={act} />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'drought' && <DroughtTab />}
      {tab === 'interop' && <InteropTab act={act} />}
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
        <button className="btn-danger" type="button" onClick={() => { rec.stop(); setRec(null); }}><Square className="h-5 w-5" aria-hidden="true" />Arrêter et envoyer</button>
      )}
      <label className="btn-ghost cursor-pointer"><Upload className="h-5 w-5" aria-hidden="true" />Fichier
        <input type="file" accept="audio/*" className="sr-only" onChange={(e) => e.target.files[0] && upload(e.target.files[0], e.target.files[0].name)} />
      </label>
      {msg && <span className="font-semibold text-leaf" role="status">{msg}</span>}
      <ErrorNote error={error} />
    </div>
  );
}

const EMPTY = { kind: 'FICHE_LUTTE', title: '', body: '', pictogram: 'bug', officialRef: '', targetCrops: [] };

export function Cms() {
  const [session] = useSession();
  const canEdit = ['AGENT', 'ADMIN'].includes(session?.user.role);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = () => api(canEdit ? '/cms/contents' : '/contents').then((list) => setItems(list.map((c) => ({ versions: [], status: 'PUBLISHED', ...c })))).catch((e) => setError(e.message));
  useEffect(() => { if (session) load(); }, [session]);
  const save = async (e) => {
    e.preventDefault(); setError(''); setMsg('');
    const body = { ...form, officialRef: form.officialRef || undefined, targetCrops: form.targetCrops.length ? form.targetCrops : undefined };
    try {
      if (editing) await api(`/cms/contents/${editing}`, { method: 'PUT', body }); else await api('/cms/contents', { method: 'POST', body });
      setForm(EMPTY); setEditing(null); load();
    } catch (err) { setError(err.message); }
  };
  const toggle = async (c) => {
    const r = await api(`/cms/contents/${c.id}/${c.status === 'PUBLISHED' ? 'unpublish' : 'publish'}`, { method: 'POST' });
    if (r.notified) setMsg(`Publiée : ${r.notified} producteur(s) prévenu(s) par SMS.`);
    load();
  };
  const toggleCrop = (id) => setForm((f) => ({ ...f, targetCrops: f.targetCrops.includes(id) ? f.targetCrops.filter((x) => x !== id) : [...f.targetCrops, id] }));
  return (
    <Shell title={canEdit ? 'Contenus' : 'Audios des fiches'}>
      {msg && <p className="mb-3 rounded-xl bg-leaf-light p-3 font-semibold text-leaf" role="status">{msg}</p>}
      {canEdit && (
        <form className="card space-y-3" onSubmit={save} method="post">
          <h2 className="text-lg font-bold">{editing ? 'Modifier la fiche' : 'Nouvelle fiche'}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Type"><option value="FICHE_LUTTE">Fiche pratique</option><option value="REGLEMENTATION">Réglementation</option><option value="CALENDRIER">Calendrier</option></select>
            <select className="input" value={form.pictogram} onChange={(e) => setForm({ ...form, pictogram: e.target.value })} aria-label="Pictogramme">{['bug', 'sun', 'ban', 'flask', 'receipt', 'cloud-rain', 'sprout', 'wheat'].map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          <input className="input" placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={3} aria-label="Titre" />
          <textarea className="input min-h-28 py-2" placeholder="Texte simple, phrases courtes" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required minLength={10} aria-label="Texte" />
          <input className="input" placeholder="Référence officielle (texte, décret, source)" value={form.officialRef} onChange={(e) => setForm({ ...form, officialRef: e.target.value })} aria-label="Référence officielle" />
          {form.kind === 'REGLEMENTATION' && (
            <fieldset>
              <legend className="label">Prévenir par SMS les producteurs de :</legend>
              <div className="flex flex-wrap gap-2">
                {CROPS.map((c) => (
                  <button key={c.id} type="button" aria-pressed={form.targetCrops.includes(c.id)} onClick={() => toggleCrop(c.id)}
                    className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${form.targetCrops.includes(c.id) ? 'border-leaf-mid bg-leaf-mid text-leaf-ink' : 'border-soil-line bg-surface'}`}>{c.name}</button>
                ))}
              </div>
            </fieldset>
          )}
          <button className="btn-primary" type="submit">{editing ? 'Enregistrer une nouvelle version' : 'Créer en brouillon'}</button>
          <ErrorNote error={error} />
        </form>
      )}
      <div className="mt-4 space-y-3">
        {items.map((c) => (
          <article key={c.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex-1 font-bold">{c.title}</h3>
              <span className={`badge ${c.status === 'PUBLISHED' ? 'bg-leaf-light text-leaf' : 'bg-surface-raised text-soil-muted'}`}>{c.status === 'PUBLISHED' ? 'publiée' : 'brouillon'} · v{c.version}</span>
              {canEdit && <button className="btn-ghost min-h-10 py-2" onClick={() => toggle(c)}>{c.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}</button>}
              {canEdit && <button className="btn-ghost min-h-10 py-2" onClick={() => { setEditing(c.id); setForm({ kind: c.kind, title: c.title, body: c.body, pictogram: c.pictogram, officialRef: c.officialRef ?? '', targetCrops: c.targetCrops ?? [] }); window.scrollTo(0, 0); }}>Modifier</button>}
            </div>
            {c.targetCrops?.length > 0 && <p className="mt-1 text-sm text-soil-muted">Cible : {c.targetCrops.map(cropName).join(', ')}</p>}
            <p className="mt-1 text-sm text-soil-muted">Audios : {c.audios.length ? c.audios.map((a) => LANG_LABEL[a.lang] ?? a.lang).join(', ') : 'aucun'}</p>
            <AudioRecorder contentId={c.id} onDone={load} />
          </article>
        ))}
      </div>
    </Shell>
  );
}

export function Commune() {
  const [session] = useSession();
  const isCommune = session?.user.role === 'COMMUNE';
  const [rates, setRates] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [recon, setRecon] = useState(null);
  const [f, setF] = useState({ cropId: 'mais', quantityKg: 100 });
  const [newRate, setNewRate] = useState({ cropId: 'mais', fcfaPer100Kg: 150 });
  const [last, setLast] = useState(null);
  const [error, setError] = useState('');
  const communeId = session?.user.communeId;
  const load = async () => {
    try {
      setRates(await api(`/tax/rates${isCommune ? `?communeId=${communeId}` : ''}`, { auth: false }));
      setRevenue(await api('/tax/revenue'));
      if (isCommune || session?.user.role === 'ADMIN') setRecon(await api('/tax/reconciliation'));
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
  const saveRate = async (e) => {
    e.preventDefault(); setError('');
    try { await api('/tax/rates', { method: 'PUT', body: { communeId, cropId: newRate.cropId, fcfaPer100Kg: Number(newRate.fcfaPer100Kg) } }); load(); } catch (err) { setError(err.message); }
  };
  if (!session) return <Shell title="Recettes"><Link className="btn-primary" to="/connexion">Connexion</Link></Shell>;
  const total = revenue?.byCommuneAndCrop.reduce((s, r) => s + (r._sum.amountFcfa ?? 0), 0) ?? 0;
  return (
    <Shell title="Recettes communales (TDL)" back={!isCommune} wide>
      <ErrorNote error={error} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total encaissé" value={fmtFcfa(total)} tone="good" />
        <Stat label="Reçus" value={recon?.count ?? '–'} hint="émis et signés" />
        <Stat label="Reçus invalides" value={recon?.invalid ?? '–'} tone={recon?.invalid ? 'bad' : 'good'} hint="contrôle de signature" />
        <Stat label="Barèmes" value={rates.length} hint="produits taxés" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {isCommune && (
          <form className="card space-y-3" onSubmit={collect} method="post">
            <h2 className="text-lg font-bold">Encaisser sur le marché</h2>
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={f.cropId} onChange={(e) => setF({ ...f, cropId: e.target.value })} aria-label="Produit">{rates.map((r) => <option key={r.id} value={r.cropId}>{r.crop.name}</option>)}</select>
              <input className="input" type="number" min="1" value={f.quantityKg} onChange={(e) => setF({ ...f, quantityKg: e.target.value })} aria-label="Quantité (kg)" />
            </div>
            <button className="btn-primary w-full" type="submit">Encaisser et émettre le reçu</button>
            {last?.queued && <p className="font-semibold text-warn">Hors ligne : l’encaissement partira au retour du réseau, sans doublon.</p>}
            {last?.receiptId && <p className="font-semibold text-leaf">Reçu {last.receiptId} : {fmtFcfa(last.amountFcfa)}.</p>}
          </form>
        )}
        <section className="card">
          <h2 className="text-lg font-bold">Barème <Demo>fixé par le conseil communal</Demo></h2>
          <ul className="mt-2 divide-y divide-soil-line text-sm">{rates.map((r) => <li key={r.id} className="flex justify-between py-1.5"><span>{r.commune.name} · {r.crop.name}</span><span className="tabular-nums font-semibold">{r.fcfaPer100Kg} FCFA / 100 kg{r.illustrative ? ' (fictif)' : ''}</span></li>)}</ul>
          {isCommune && (
            <form className="mt-3 grid grid-cols-[1fr_7rem_auto] gap-2" onSubmit={saveRate} method="post">
              <select className="input" value={newRate.cropId} onChange={(e) => setNewRate({ ...newRate, cropId: e.target.value })} aria-label="Produit du barème">{CROPS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input className="input" type="number" min="0" value={newRate.fcfaPer100Kg} onChange={(e) => setNewRate({ ...newRate, fcfaPer100Kg: e.target.value })} aria-label="FCFA pour 100 kg" />
              <button className="btn-ghost" type="submit">OK</button>
            </form>
          )}
        </section>
      </div>
      {recon && (
        <section className="card mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Rapprochement</h2>
            <button className="btn-ghost" onClick={() => downloadWithAuth('/tax/reconciliation.csv', 'rapprochement-tdl.csv').catch((e) => setError(e.message))}><Download className="h-5 w-5" aria-hidden="true" />CSV pour le receveur</button>
          </div>
          <p className="text-sm text-soil-muted">Chaque reçu est revérifié par sa signature : un montant modifié en base apparaît ici comme invalide.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="table min-w-[560px]">
              <thead><tr><th>Reçu</th><th>Produit</th><th>kg</th><th>Montant</th><th>Date</th><th>Signature</th></tr></thead>
              <tbody>{recon.rows.slice(-15).reverse().map((r) => <tr key={r.receiptId}><td className="font-mono text-xs">{r.receiptId}</td><td>{cropName(r.cropId)}</td><td className="tabular-nums">{r.quantityKg}</td><td className="tabular-nums">{fmtFcfa(r.amountFcfa)}</td><td>{fmtDate(r.paidAt)}</td><td>{r.signatureValid ? <span className="badge bg-leaf-light text-leaf">valide</span> : <span className="badge bg-danger-light text-danger">invalide</span>}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </Shell>
  );
}
