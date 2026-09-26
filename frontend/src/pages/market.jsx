import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, MapPin, PackageCheck, Phone, ShieldX } from 'lucide-react';
import { api, newClientId, sendOrQueue, API_URL } from '../api';
import { CropPicker, Demo, ErrorNote, Qr, Shell, Verdict, fmtDate, fmtFcfa, useSession } from '../ui';
import { ProducerFor } from './farmer';

export function Market() {
  const [session] = useSession();
  const role = session?.user.role;
  const [listings, setListings] = useState([]);
  const [prices, setPrices] = useState([]);
  const [error, setError] = useState('');
  const load = () => {
    api('/market/listings', { auth: false }).then(setListings).catch((e) => setError(e.message));
    api('/market/prices', { auth: false }).then(setPrices).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  return (
    <Shell title="Marché">
      <ErrorNote error={error} />
      <section className="card">
        <h2 className="text-lg font-bold">Prix de référence</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {prices.map((p) => <li key={p.id}>{p.crop.name} à {p.commune.name} : <strong>{p.pricePerKg} FCFA/kg</strong> {p.illustrative && <Demo />}</li>)}
        </ul>
        {prices[0] && <p className="mt-2 text-sm">Source : {prices[0].source}, {fmtDate(prices[0].observedAt)}.</p>}
      </section>
      {(role === 'PRODUCER' || role === 'ADVISOR') && <NewListing onDone={load} />}
      <h2 className="mb-2 mt-6 text-lg font-bold">Offres ouvertes</h2>
      <div className="space-y-2">
        {listings.map((l) => <ListingRow key={l.id} l={l} canBuy={role === 'BUYER'} onDone={load} />)}
        {!listings.length && <p className="card">Aucune offre pour le moment.</p>}
      </div>
      {role === 'BUYER' && <MyOrders />}
      <p className="mt-6 text-sm">Les places de marché partenaires peuvent se brancher sur l’API ouverte (<a className="underline" href={`${API_URL}/docs`}>documentation</a>).</p>
    </Shell>
  );
}

function NewListing({ onDone }) {
  const [cropId, setCropId] = useState('mais');
  const [f, setF] = useState({ quantityKg: 100, pricePerKg: 220, forExport: false, exportLicense: '' });
  const [forUserId, setFor] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      const r = await sendOrQueue('/market/listings', { clientId: newClientId(), cropId, quantityKg: Number(f.quantityKg), pricePerKg: Number(f.pricePerKg), forExport: f.forExport, ...(f.exportLicense ? { exportLicense: f.exportLicense } : {}), ...(forUserId ? { forUserId } : {}) }, 'offre');
      setOk(r.sent ? 'Offre publiée.' : 'Pas de réseau : l’offre partira au retour de la connexion.'); onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form className="card mt-4 space-y-3" onSubmit={submit} method="post">
      <h2 className="text-lg font-bold">Vendre</h2>
      <ProducerFor value={forUserId} onChange={setFor} />
      <CropPicker value={cropId} onChange={setCropId} only={['mais', 'soja', 'arachide', 'niebe', 'riz', 'manioc', 'tomate']} />
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="q">Quantité (kg)</label><input id="q" className="input" type="number" min="1" value={f.quantityKg} onChange={(e) => setF({ ...f, quantityKg: e.target.value })} /></div>
        <div><label className="label" htmlFor="p">Prix (FCFA/kg)</label><input id="p" className="input" type="number" min="1" value={f.pricePerKg} onChange={(e) => setF({ ...f, pricePerKg: e.target.value })} /></div>
      </div>
      <label className="flex min-h-12 items-center gap-3 font-semibold"><input type="checkbox" className="h-6 w-6" checked={f.forExport} onChange={(e) => setF({ ...f, forExport: e.target.checked })} /> Pour l’exportation</label>
      {f.forExport && <input className="input" placeholder="Numéro d’agrément export" value={f.exportLicense} onChange={(e) => setF({ ...f, exportLicense: e.target.value })} aria-label="Numéro d’agrément export" />}
      <button className="btn-primary w-full" type="submit">Publier l’offre</button>
      {ok && <p className="font-semibold text-leaf" role="status">{ok}</p>}
      <ErrorNote error={error} />
    </form>
  );
}

function ListingRow({ l, canBuy, onDone }) {
  const [qty, setQty] = useState(Math.min(50, l.quantityKg));
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const order = async () => {
    setError(''); setOk('');
    try { await api('/market/orders', { method: 'POST', body: { clientId: newClientId(), listingId: l.id, quantityKg: Number(qty) } }); setOk('Réservé. Payez depuis « Mes commandes ».'); onDone(); } catch (e) { setError(e.message); }
  };
  return (
    <div className="card">
      <p className="font-bold">{l.crop.name} · {l.quantityKg} kg · {l.pricePerKg} FCFA/kg</p>
      <p className="text-sm"><MapPin className="mr-1 inline h-4 w-4" aria-hidden="true" />{l.commune.name} · {fmtDate(l.createdAt)} {l.forExport && <span className="badge bg-warn-light text-warn">export</span>}</p>
      {canBuy && (
        <div className="mt-2 flex gap-2">
          <input className="input w-28" type="number" min="1" max={l.quantityKg} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantité à réserver (kg)" />
          <button className="btn-primary" onClick={order}>Réserver</button>
        </div>
      )}
      {ok && <p className="mt-2 font-semibold text-leaf">{ok}</p>}
      <ErrorNote error={error} />
    </div>
  );
}

function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const load = () => api('/market/orders/me').then(setOrders).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const pay = async (id) => {
    setError('');
    try { await api(`/tax/orders/${id}/pay`, { method: 'POST' }); load(); } catch (e) { setError(e.message); }
  };
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-bold">Mes commandes</h2>
      <ErrorNote error={error} />
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="card">
            <p className="font-bold">{o.listing.crop.name} · {o.quantityKg} kg · {o.listing.commune.name}</p>
            {!o.taxPayment && <button className="btn-primary mt-2" onClick={() => pay(o.id)}>Payer (mobile money, simulé) et régler la TDL</button>}
            {o.taxPayment && <ReceiptCard p={o.taxPayment} />}
          </div>
        ))}
        {!orders.length && <p className="card">Aucune commande.</p>}
      </div>
    </section>
  );
}

export function ReceiptCard({ p }) {
  const url = `${window.location.origin}/recu/${p.receiptId}?sig=${p.signature}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-leaf-light p-3">
      <Qr value={url} size={140} label={`QR du reçu ${p.receiptId}`} />
      <div>
        <p className="font-bold">Reçu TDL {p.receiptId}</p>
        <p>{fmtFcfa(p.amountFcfa)} pour {p.quantityKg} kg <Demo>barème fictif</Demo></p>
        <a className="text-sm font-semibold text-leaf underline" href={url}>Vérifier ce reçu</a>
      </div>
    </div>
  );
}

export function ReceiptCheck() {
  const { id } = useParams();
  const sig = new URLSearchParams(window.location.search).get('sig') ?? '';
  const [r, setR] = useState(null);
  useEffect(() => { api(`/receipts/${encodeURIComponent(id)}?sig=${encodeURIComponent(sig)}`, { auth: false }).then(setR).catch(() => setR({ valid: false })); }, [id, sig]);
  return (
    <Shell title="Vérification de reçu">
      {r && (r.valid
        ? <Verdict tone="good" Icon={BadgeCheck} title="Reçu authentique" text={`${fmtFcfa(r.amountFcfa)} payés à la commune de ${r.commune} le ${fmtDate(r.paidAt)} pour ${r.quantityKg} kg.`} />
        : <Verdict tone="bad" Icon={ShieldX} title="Reçu invalide" text="Ce reçu n’a pas été émis par la plateforme ou a été modifié." />)}
    </Shell>
  );
}

export function LotPage() {
  const { code } = useParams();
  const [lot, setLot] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/lots/${encodeURIComponent(code)}`, { auth: false }).then(setLot).catch((e) => setError(e.message)); }, [code]);
  return (
    <Shell title={`Lot ${code}`}>
      <ErrorNote error={error} />
      {lot && (
        <div className="card space-y-2">
          <p className="flex items-center gap-2 text-xl font-black text-leaf"><PackageCheck className="h-7 w-7" aria-hidden="true" />{lot.crop} · {lot.weightKg} kg</p>
          <p>Origine : commune de {lot.commune} ({lot.department}), parcelle de {lot.parcelAreaHa} ha.</p>
          <p>Récolté le {fmtDate(lot.harvestDate)}{lot.humidityPct != null ? `, humidité déclarée ${lot.humidityPct} %` : ''}.</p>
          <p>Position de la parcelle : {lot.parcelLocation.lat}, {lot.parcelLocation.lon} ({lot.parcelLocation.precision}).</p>
          <p className="rounded-lg bg-warn-light p-2 text-warn">{lot.exportCompliance}</p>
          {lot.eudr && <p className="rounded-lg bg-leaf-light p-2 text-leaf">{lot.eudr}</p>}
          <Qr value={window.location.href} size={140} label="QR de ce lot" />
        </div>
      )}
    </Shell>
  );
}

export function UssdPhone() {
  const [session] = useSession();
  const [screen, setScreen] = useState('');
  const [input, setInput] = useState('');
  const [path, setPath] = useState([]);
  const [error, setError] = useState('');
  const sessionId = useRef(newClientId());
  const send = async (parts) => {
    setError('');
    try {
      const r = await api('/ussd/simulate', { method: 'POST', body: { sessionId: sessionId.current, text: parts.join('*') } });
      setScreen(r.response);
      if (r.response.startsWith('END')) { setPath([]); sessionId.current = newClientId(); } else setPath(parts);
    } catch (e) { setError(e.message); }
  };
  const dial = () => { sessionId.current = newClientId(); setPath([]); send([]); };
  const reply = (e) => { e.preventDefault(); if (!input) return; const p = [...path, input]; setInput(''); send(p); };
  const open = screen.startsWith('CON');
  return (
    <Shell title="Téléphone USSD">
      {!session && <p className="card">Connectez-vous avec un compte de démonstration pour utiliser votre propre numéro.</p>}
      {session && (
        <div className="mx-auto max-w-xs rounded-[2rem] border-8 border-soil bg-soil p-3">
          <div className="min-h-64 rounded-lg bg-[#d9e4d0] p-3 font-mono text-sm text-black" aria-live="polite">
            <p className="mb-2 text-xs">{session.user.phone}</p>
            <pre className="whitespace-pre-wrap">{screen ? screen.replace(/^(CON|END) /, '') : 'Composez le code AlerteAgri.'}</pre>
          </div>
          {open ? (
            <form className="mt-3 flex gap-2" onSubmit={reply} method="post">
              <input className="input font-mono" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Réponse" autoFocus />
              <button className="btn-primary" type="submit">OK</button>
            </form>
          ) : (
            <button className="btn-primary mt-3 w-full" onClick={dial}><Phone className="h-5 w-5" aria-hidden="true" /> Composer</button>
          )}
        </div>
      )}
      <ErrorNote error={error} />
      <p className="mt-4 text-sm">Simulation : le menu est celui du vrai contrôleur USSD, qui parle le protocole des agrégateurs (session, texte saisi, réponses CON et END, 182 caractères). En production, il se branche sur un agrégateur ou sur l’API de l’opérateur, avec un code court attribué par l’ARCEP. <Demo /></p>
    </Shell>
  );
}
