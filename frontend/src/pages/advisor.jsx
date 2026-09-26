import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, LocateFixed, PackagePlus, Sprout, Users } from 'lucide-react';
import { api, newClientId, sendOrQueue } from '../api';
import { CROPS, CropPicker, Demo, ErrorNote, Qr, Shell, fmtDate, useSession } from '../ui';

const LEVEL = {
  NORMAL: ['bg-leaf-light text-leaf', 'Eau suffisante'],
  SURVEILLER: ['bg-warn-light text-warn', 'À surveiller'],
  STRESS: ['bg-danger-light text-danger', 'Stress hydrique'],
  INCONNU: ['bg-surface-raised text-soil-muted', 'Données insuffisantes'],
};

function ParcelDetail({ parcel }) {
  const [steps, setSteps] = useState([]);
  const [water, setWater] = useState(null);
  useEffect(() => {
    if (!parcel.sownAt) return;
    api(`/parcels/${parcel.id}/steps`).then(setSteps).catch(() => {});
    api(`/parcels/${parcel.id}/water`).then(setWater).catch(() => {});
  }, [parcel.id, parcel.sownAt]);
  const now = Date.now();
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {parcel.sownAt ? (
        <ol className="space-y-1" aria-label="Étapes de culture">
          {steps.map((s) => {
            const done = new Date(s.due).getTime() <= now;
            return (
              <li key={s.id} className={`flex items-center gap-2 text-sm ${done ? 'text-soil-muted' : ''}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? 'bg-status-calm' : 'border-2 border-soil-line'}`} aria-hidden="true" />
                <span className="w-16 shrink-0 tabular-nums">{fmtDate(s.due)}</span>
                <span>{s.label}{s.sentAt ? ' · SMS envoyé' : ''}</span>
              </li>
            );
          })}
        </ol>
      ) : <p className="text-sm text-soil-muted">Date de semis non déclarée : pas d’étapes ni de rappels.</p>}
      {water && (
        <div className={`rounded-xl p-3 ${LEVEL[water.level][0]}`}>
          <p className="flex items-center gap-2 font-bold"><Droplets className="h-5 w-5" aria-hidden="true" />{LEVEL[water.level][1]}</p>
          {water.balanceMm !== null && <p className="text-sm">Bilan pluie moins évaporation depuis le semis : <strong className="tabular-nums">{water.balanceMm} mm</strong> sur {water.days} jours.</p>}
          <p className="mt-1 text-xs opacity-80">{water.source ?? water.reason}</p>
        </div>
      )}
    </div>
  );
}

export function MyParcels() {
  const [parcels, setParcels] = useState([]);
  useEffect(() => { api('/parcels/mine').then(setParcels).catch(() => {}); }, []);
  if (!parcels.length) return null;
  return (
    <section className="mt-6">
      <h2 className="section-title">Mes parcelles</h2>
      <div className="space-y-3">
        {parcels.map((p) => (
          <article key={p.id} className="card">
            <p className="font-bold">{p.crop.name} · {p.areaHa} ha{p.sownAt ? ` · semé le ${fmtDate(p.sownAt)}` : ''}</p>
            <ParcelDetail parcel={p} />
          </article>
        ))}
      </div>
    </section>
  );
}

function NewParcel({ producers, onDone }) {
  const [f, setF] = useState({ forUserId: '', cropId: 'mais', areaHa: 1, sownAt: '', lat: '', lon: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setF((x) => ({ ...x, lat: p.coords.latitude.toFixed(5), lon: p.coords.longitude.toFixed(5) })),
    () => setError('Position indisponible : saisissez-la ou autorisez la localisation.'), { enableHighAccuracy: true, timeout: 10000 },
  );
  const submit = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      await api('/parcels', { method: 'POST', body: { cropId: f.cropId, areaHa: Number(f.areaHa), lat: Number(f.lat), lon: Number(f.lon), ...(f.sownAt ? { sownAt: f.sownAt } : {}), ...(f.forUserId ? { forUserId: f.forUserId } : {}) } });
      setOk('Parcelle enregistrée. Les rappels de culture partiront par SMS.'); onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form className="card space-y-3" onSubmit={submit} method="post">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Sprout className="h-5 w-5 text-leaf" aria-hidden="true" />Nouvelle parcelle</h2>
      <div>
        <label className="label" htmlFor="owner">Producteur</label>
        <select id="owner" className="input" value={f.forUserId} onChange={(e) => setF({ ...f, forUserId: e.target.value })} required>
          <option value="">Choisir…</option>
          {producers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <CropPicker value={f.cropId} onChange={(cropId) => setF({ ...f, cropId })} />
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="area">Surface (ha)</label><input id="area" className="input" type="number" step="0.1" min="0.01" value={f.areaHa} onChange={(e) => setF({ ...f, areaHa: e.target.value })} required /></div>
        <div><label className="label" htmlFor="sown">Date de semis</label><input id="sown" className="input" type="date" value={f.sownAt} onChange={(e) => setF({ ...f, sownAt: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <div><label className="label" htmlFor="lat">Latitude</label><input id="lat" className="input" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} required /></div>
        <div><label className="label" htmlFor="lon">Longitude</label><input id="lon" className="input" inputMode="decimal" value={f.lon} onChange={(e) => setF({ ...f, lon: e.target.value })} required /></div>
        <button type="button" className="btn-ghost" onClick={locate} aria-label="Utiliser ma position"><LocateFixed className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <button className="btn-primary w-full" type="submit">Enregistrer la parcelle</button>
      {ok && <p className="font-semibold text-leaf" role="status">{ok}</p>}
      <ErrorNote error={error} />
    </form>
  );
}

function NewLot({ parcel, onDone }) {
  const [f, setF] = useState({ harvestDate: new Date().toISOString().slice(0, 10), weightKg: '', humidityPct: '' });
  const [lot, setLot] = useState(null);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      setLot(await api('/lots', { method: 'POST', body: { parcelId: parcel.id, harvestDate: f.harvestDate, weightKg: Number(f.weightKg), ...(f.humidityPct ? { humidityPct: Number(f.humidityPct) } : {}) } }));
      onDone();
    } catch (err) { setError(err.message); }
  };
  if (lot) {
    const url = `${window.location.origin}/lot/${lot.code}`;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-leaf-light p-3">
        <Qr value={url} size={120} label={`QR du lot ${lot.code}`} />
        <div><p className="font-bold">Lot {lot.code}</p><Link className="text-sm font-semibold text-leaf underline" to={`/lot/${lot.code}`}>Voir la page publique</Link></div>
      </div>
    );
  }
  return (
    <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={submit} method="post" aria-label={`Livraison de la parcelle ${parcel.crop.name}`}>
      <input className="input" type="date" value={f.harvestDate} onChange={(e) => setF({ ...f, harvestDate: e.target.value })} aria-label="Date de récolte" />
      <input className="input" type="number" min="1" placeholder="Poids (kg)" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} required aria-label="Poids en kg" />
      <input className="input" type="number" min="0" max="100" step="0.1" placeholder="Humidité %" value={f.humidityPct} onChange={(e) => setF({ ...f, humidityPct: e.target.value })} aria-label="Humidité en pourcentage" />
      <button className="btn-primary" type="submit"><PackagePlus className="h-5 w-5" aria-hidden="true" />Créer le lot</button>
      <ErrorNote error={error} />
    </form>
  );
}

function GroupSale({ producers, onDone }) {
  const [cropId, setCropId] = useState('mais');
  const [price, setPrice] = useState(215);
  const [qty, setQty] = useState({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const shares = Object.entries(qty).filter(([, q]) => Number(q) > 0).map(([producerId, q]) => ({ producerId, quantityKg: Number(q) }));
  const total = shares.reduce((s, x) => s + x.quantityKg, 0);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try { await api('/market/group-listings', { method: 'POST', body: { clientId: newClientId(), cropId, pricePerKg: Number(price), shares } }); setOk(`Offre groupée publiée : ${total} kg.`); setQty({}); onDone(); } catch (err) { setError(err.message); }
  };
  return (
    <form className="card space-y-3" onSubmit={submit} method="post">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-leaf" aria-hidden="true" />Vente groupée</h2>
      <p className="text-sm text-soil-muted">Réunissez les récoltes de plusieurs producteurs : un acheteur, un prix, et chaque part reste au nom de son producteur.</p>
      <CropPicker value={cropId} onChange={setCropId} only={['mais', 'soja', 'arachide', 'niebe', 'riz', 'manioc']} />
      <ul className="divide-y divide-soil-line">
        {producers.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className="flex-1">{p.name}</span>
            <input className="input w-28" type="number" min="0" placeholder="kg" value={qty[p.id] ?? ''} onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })} aria-label={`Quantité de ${p.name} en kg`} />
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 items-end gap-2">
        <div><label className="label" htmlFor="gp">Prix (FCFA/kg)</label><input id="gp" className="input" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <p className="text-right text-lg font-black tabular-nums">{total} kg</p>
      </div>
      <button className="btn-primary w-full" type="submit" disabled={!shares.length}>Publier l’offre groupée</button>
      {ok && <p className="font-semibold text-leaf" role="status">{ok}</p>}
      <ErrorNote error={error} />
    </form>
  );
}

export function Parcels() {
  const [session] = useSession();
  const [producers, setProducers] = useState([]);
  const [parcels, setParcels] = useState([]);
  const load = () => {
    api('/users/producers').then(setProducers).catch(() => {});
    api('/parcels/mine').then(setParcels).catch(() => {});
  };
  useEffect(() => { if (session) load(); }, [session]);
  if (session?.user.role !== 'ADVISOR') return <Shell title="Parcelles"><p className="card">Espace réservé aux conseillers agricoles.</p></Shell>;
  const cropName = (id) => CROPS.find((c) => c.id === id)?.name ?? id;
  return (
    <Shell title="Parcelles et ventes">
      <div className="grid gap-4 lg:grid-cols-2">
        <NewParcel producers={producers} onDone={load} />
        <GroupSale producers={producers} onDone={load} />
      </div>
      <h2 className="section-title">Parcelles de la commune ({parcels.length})</h2>
      <div className="space-y-3">
        {parcels.map((p) => (
          <article key={p.id} className="card">
            <p className="font-bold">{p.owner.name} · {cropName(p.cropId)} · {p.areaHa} ha{p.sownAt ? ` · semé le ${fmtDate(p.sownAt)}` : ''}</p>
            <p className="text-xs text-soil-muted">{p.lat.toFixed(4)}, {p.lon.toFixed(4)}{p.lots.length ? ` · ${p.lots.length} lot(s) : ${p.lots.map((l) => l.code).join(', ')}` : ''}</p>
            <details className="mt-2">
              <summary className="min-h-10 cursor-pointer py-2 font-semibold text-leaf">Suivi de culture</summary>
              <ParcelDetail parcel={p} />
            </details>
            <details>
              <summary className="min-h-10 cursor-pointer py-2 font-semibold text-leaf">Enregistrer une livraison (lot traçable)</summary>
              <NewLot parcel={p} onDone={load} />
            </details>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-soil-muted">Cycles de culture indicatifs, à préciser par variété avec l’INRAB et l’ATDA. <Demo>indicatif</Demo></p>
    </Shell>
  );
}

export { sendOrQueue };
