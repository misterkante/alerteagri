import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Delete, MapPin, Phone, Plus } from 'lucide-react';
import { api, newClientId, sendOrQueue, API_URL } from '../api';
import { CropPicker, Demo, ErrorNote, Qr, ScrollArea, Shell, Verdict } from '../ui';
import { Picto } from '../picto';
import { cropPicto } from '../lib/crops';
import { fmtDate, fmtFcfa, fmtNum, fmtPhone } from '../lib/format';
import { useSession } from '../lib/session';
import { ProducerFor } from './farmer';

export function Market() {
  const [session] = useSession();
  const role = session?.user.role;
  const [listings, setListings] = useState([]);
  const [prices, setPrices] = useState([]);
  const [error, setError] = useState('');
  const load = () => {
    api('/market/listings', { auth: false })
      .then(setListings)
      .catch((e) => setError(e.message));
    api('/market/prices', { auth: false })
      .then(setPrices)
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <Shell title="Marché">
      <ErrorNote error={error} />
      <section aria-labelledby="prix">
        <div className="flex items-baseline justify-between">
          <h2 id="prix" className="text-[17px] font-semibold">
            Prix de référence
          </h2>
          {prices.some((p) => p.illustrative) && <Demo />}
        </div>
        <ScrollArea label="Prix de référence" className="no-scrollbar -mx-4 mt-3 rounded-2xl px-4 pb-1">
          <ul className="flex gap-3">
            {prices.map((p) => (
              <li key={p.id} className="card min-w-[132px] shrink-0 p-3">
                <Picto name={cropPicto(p.cropId ?? p.crop.id)} size={36} />
                <p className="mt-2 text-[14px] font-semibold">{p.crop.name}</p>
                <p className="font-display text-[20px] font-bold leading-tight">
                  {fmtNum(p.pricePerKg)} <span className="text-[13px] font-semibold text-soil-muted">F/kg</span>
                </p>
                <p className="text-[13px] text-soil-muted">{p.commune.name}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
        {prices[0] && (
          <p className="mt-2 text-[13px] text-soil-muted">
            Source : {prices[0].source}, {fmtDate(prices[0].observedAt)}.
          </p>
        )}
      </section>
      {(role === 'PRODUCER' || role === 'ADVISOR') && <NewListing onDone={load} />}
      <h2 className="section-title">Offres ouvertes ({listings.length})</h2>
      <div className="space-y-3">
        {listings.map((l) => (
          <ListingRow key={l.id} l={l} canBuy={role === 'BUYER'} onDone={load} />
        ))}
        {!listings.length && (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <Picto name="marche" size={64} />
            <p className="mt-3 font-semibold">Aucune offre pour le moment</p>
          </div>
        )}
      </div>
      {role === 'BUYER' && <MyOrders />}
      <p className="mt-6 text-[13px] text-soil-muted">
        Les places de marché partenaires peuvent se brancher sur l’API ouverte (
        <a className="font-semibold text-leaf underline" href={`${API_URL}/docs`}>
          documentation
        </a>
        ).
      </p>
    </Shell>
  );
}

function NewListing({ onDone }) {
  const [cropId, setCropId] = useState('mais');
  const [f, setF] = useState({ quantityKg: 100, pricePerKg: 220, forExport: false, exportLicense: '' });
  const [forUserId, setFor] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [open, setOpen] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const r = await sendOrQueue(
        '/market/listings',
        {
          clientId: newClientId(),
          cropId,
          quantityKg: Number(f.quantityKg),
          pricePerKg: Number(f.pricePerKg),
          forExport: f.forExport,
          ...(f.exportLicense ? { exportLicense: f.exportLicense } : {}),
          ...(forUserId ? { forUserId } : {}),
        },
        'offre',
      );
      setOk(r.sent ? 'Offre publiée.' : 'Pas de réseau : l’offre partira au retour de la connexion.');
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  if (!open)
    return (
      <button type="button" className="btn-primary mt-5 w-full" onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5" aria-hidden="true" /> Vendre ma récolte
      </button>
    );
  return (
    <form className="card mt-5 space-y-4" onSubmit={submit} method="post">
      <h2 className="text-[17px] font-semibold">Vendre</h2>
      <ProducerFor value={forUserId} onChange={setFor} />
      <CropPicker value={cropId} onChange={setCropId} only={['mais', 'soja', 'arachide', 'niebe', 'riz', 'manioc', 'tomate']} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="q">
            Quantité (kg)
          </label>
          <input
            id="q"
            className="input"
            type="number"
            min="1"
            value={f.quantityKg}
            onChange={(e) => setF({ ...f, quantityKg: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="p">
            Prix (FCFA/kg)
          </label>
          <input
            id="p"
            className="input"
            type="number"
            min="1"
            value={f.pricePerKg}
            onChange={(e) => setF({ ...f, pricePerKg: e.target.value })}
          />
        </div>
      </div>
      <label className="flex min-h-12 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          className="h-6 w-6 accent-leaf-mid"
          checked={f.forExport}
          onChange={(e) => setF({ ...f, forExport: e.target.checked })}
        />{' '}
        Pour l’exportation
      </label>
      {f.forExport && (
        <input
          className="input"
          placeholder="Numéro d’agrément export"
          value={f.exportLicense}
          onChange={(e) => setF({ ...f, exportLicense: e.target.value })}
          aria-label="Numéro d’agrément export"
        />
      )}
      <button className="btn-primary w-full" type="submit">
        Publier l’offre
      </button>
      {ok && (
        <p className="font-semibold text-leaf" role="status">
          {ok}
        </p>
      )}
      <ErrorNote error={error} />
    </form>
  );
}

function ListingRow({ l, canBuy, onDone }) {
  const [qty, setQty] = useState(Math.min(50, l.quantityKg));
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const order = async () => {
    setError('');
    setOk('');
    try {
      await api('/market/orders', { method: 'POST', body: { clientId: newClientId(), listingId: l.id, quantityKg: Number(qty) } });
      setOk('Réservé. Payez depuis « Mes commandes ».');
      onDone();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <article className="card">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-warn-light">
          <Picto name={cropPicto(l.cropId ?? l.crop.id)} size={36} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">
            {l.crop.name} · {fmtNum(l.quantityKg)} kg
          </p>
          <p className="flex items-center gap-1 text-[13px] text-soil-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {l.commune.name} · {fmtDate(l.createdAt)}
            {l.forExport && <span className="badge ml-1 bg-warn-light text-warn">export</span>}
          </p>
        </div>
        <p className="text-right font-display text-[20px] font-bold leading-none">
          {fmtNum(l.pricePerKg)}
          <span className="block text-[12px] font-semibold text-soil-muted">FCFA/kg</span>
        </p>
      </div>
      {canBuy && (
        <div className="mt-3 flex gap-2">
          <input
            className="input w-28"
            type="number"
            min="1"
            max={l.quantityKg}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label="Quantité à réserver (kg)"
          />
          <button className="btn-primary flex-1" onClick={order}>
            Réserver
          </button>
        </div>
      )}
      {ok && <p className="mt-2 font-semibold text-leaf">{ok}</p>}
      <ErrorNote error={error} />
    </article>
  );
}

function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const load = () =>
    api('/market/orders/me')
      .then(setOrders)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const pay = async (id) => {
    setError('');
    try {
      await api(`/tax/orders/${id}/pay`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="mt-6">
      <h2 className="section-title">Mes commandes</h2>
      <ErrorNote error={error} />
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="card">
            <p className="flex items-center gap-3 font-semibold">
              <Picto name={cropPicto(o.listing.cropId ?? o.listing.crop.id)} size={32} />
              {o.listing.crop.name} · {fmtNum(o.quantityKg)} kg · {o.listing.commune.name}
            </p>
            {!o.taxPayment && (
              <button className="btn-primary mt-3 w-full" onClick={() => pay(o.id)}>
                Payer (mobile money, simulé) et régler la TDL
              </button>
            )}
            {o.taxPayment && <ReceiptCard p={o.taxPayment} />}
          </div>
        ))}
        {!orders.length && <p className="card text-soil-muted">Aucune commande pour le moment.</p>}
      </div>
    </section>
  );
}

export function ReceiptCard({ p }) {
  const url = `${window.location.origin}/recu/${p.receiptId}?sig=${p.signature}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl bg-leaf-light p-4">
      <Qr value={url} size={140} label={`QR du reçu ${p.receiptId}`} />
      <div>
        <p className="flex items-center gap-2 font-semibold">
          <Picto name="recu" size={24} /> Reçu TDL {p.receiptId}
        </p>
        <p>
          {fmtFcfa(p.amountFcfa)} pour {p.quantityKg} kg <Demo>barème fictif</Demo>
        </p>
        <a className="text-sm font-semibold text-leaf underline" href={url}>
          Vérifier ce reçu
        </a>
      </div>
    </div>
  );
}

export function ReceiptCheck() {
  const { id } = useParams();
  const sig = new URLSearchParams(window.location.search).get('sig') ?? '';
  const [r, setR] = useState(null);
  useEffect(() => {
    api(`/receipts/${encodeURIComponent(id)}?sig=${encodeURIComponent(sig)}`, { auth: false })
      .then(setR)
      .catch(() => setR({ valid: false }));
  }, [id, sig]);
  return (
    <Shell title="Vérification de reçu">
      {r &&
        (r.valid ? (
          <Verdict
            tone="good"
            picto="ok"
            title="Reçu authentique"
            text={`${fmtFcfa(r.amountFcfa)} payés à la commune de ${r.commune} le ${fmtDate(r.paidAt)} pour ${r.quantityKg} kg.`}
          />
        ) : (
          <Verdict tone="bad" picto="non" title="Reçu invalide" text="Ce reçu n’a pas été émis par la plateforme ou a été modifié." />
        ))}
    </Shell>
  );
}

export function LotPage() {
  const { code } = useParams();
  const [lot, setLot] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/lots/${encodeURIComponent(code)}`, { auth: false })
      .then(setLot)
      .catch((e) => setError(e.message));
  }, [code]);
  return (
    <Shell title={`Lot ${code}`}>
      <ErrorNote error={error} />
      {lot && (
        <div className="space-y-4">
          <div className="card flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-leaf-light">
              <Picto name="colis" size={42} />
            </span>
            <div>
              <p className="font-display text-[22px] font-bold leading-tight">
                {lot.crop} · {fmtNum(lot.weightKg)} kg
              </p>
              <p className="text-[14px] text-soil-muted">Lot {code}</p>
            </div>
          </div>
          <dl className="card divide-y divide-soil-line/70 p-0 text-[15px]">
            {[
              ['Origine', `Commune de ${lot.commune} (${lot.department}), parcelle de ${fmtNum(lot.parcelAreaHa, 1)} ha`],
              [
                'Récolte',
                `${fmtDate(lot.harvestDate)}${lot.humidityPct !== null && lot.humidityPct !== undefined ? `, humidité déclarée ${fmtNum(lot.humidityPct, 1)} %` : ''}`,
              ],
              ['Position', `${fmtNum(lot.parcelLocation.lat, 3)} ; ${fmtNum(lot.parcelLocation.lon, 3)} (${lot.parcelLocation.precision})`],
            ].map(([k, v]) => (
              <div key={k} className="row items-start">
                <dt className="w-24 shrink-0 text-soil-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="rounded-2xl bg-warn-light p-4 text-[15px] text-warn">{lot.exportCompliance}</p>
          {lot.eudr && <p className="rounded-2xl bg-leaf-light p-4 text-[15px] text-leaf">{lot.eudr}</p>}
          <div className="card flex flex-col items-center gap-2">
            <Qr value={window.location.href} size={160} label="QR de ce lot" />
            <p className="text-[13px] text-soil-muted">Scannez pour vérifier l’origine</p>
          </div>
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
  const inputRef = useRef(null);
  const send = async (parts) => {
    setError('');
    try {
      const r = await api('/ussd/simulate', { method: 'POST', body: { sessionId: sessionId.current, text: parts.join('*') } });
      setScreen(r.response);
      if (r.response.startsWith('END')) {
        setPath([]);
        sessionId.current = newClientId();
      } else setPath(parts);
    } catch (e) {
      setError(e.message);
    }
  };
  const dial = () => {
    sessionId.current = newClientId();
    setPath([]);
    send([]);
  };
  const reply = (e) => {
    e.preventDefault();
    if (!input) return;
    const p = [...path, input];
    setInput('');
    send(p);
  };
  const open = screen.startsWith('CON');
  // Move focus to the answer field only when a menu screen arrives, not on page load.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, screen]);
  return (
    <Shell title="Téléphone USSD">
      {!session && (
        <div className="card flex items-center gap-4">
          <Picto name="telephone" size={44} />
          <p className="text-[15px]">Connectez-vous avec un compte de démonstration pour utiliser votre propre numéro.</p>
        </div>
      )}
      {session && (
        <div className="mx-auto max-w-[320px] rounded-[2.5rem] bg-[#1f2421] p-4 shadow-lift">
          <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/20" aria-hidden="true" />
          <div className="min-h-60 rounded-2xl bg-[#d9e4d0] p-4 font-mono text-[14px] leading-snug text-black" aria-live="polite">
            <p className="mb-2 text-[12px] text-[#3b4a34]">{fmtPhone(session.user.phone)}</p>
            <pre className="whitespace-pre-wrap font-mono">
              {screen ? screen.replace(/^(CON|END) /, '') : 'Composez le code AlerteAgri.'}
            </pre>
          </div>
          {open ? (
            <form className="mt-3 space-y-3" onSubmit={reply} method="post">
              <div className="flex gap-2">
                <input
                  className="input bg-white font-mono text-[18px] text-black"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  aria-label="Réponse"
                  inputMode="numeric"
                  ref={inputRef}
                />
                <button className="btn-primary px-6" type="submit">
                  OK
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="h-12 rounded-2xl bg-white/10 font-display text-[20px] font-semibold text-white transition active:bg-white/25"
                    onClick={() => setInput((v) => v + k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mx-auto flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] text-white/80"
                onClick={() => setInput((v) => v.slice(0, -1))}
                aria-label="Effacer le dernier chiffre"
              >
                <Delete className="h-4 w-4" aria-hidden="true" /> Effacer
              </button>
            </form>
          ) : (
            <button className="btn-primary mt-4 w-full" onClick={dial}>
              <Phone className="h-5 w-5" aria-hidden="true" /> Composer
            </button>
          )}
        </div>
      )}
      <ErrorNote error={error} />
      <p className="mt-5 text-[13px] text-soil-muted">
        Simulation : le menu est celui du vrai contrôleur USSD, qui parle le protocole des agrégateurs (session, texte saisi, réponses CON
        et END, 182 caractères). En production, il se branche sur un agrégateur ou sur l’API de l’opérateur, avec un code court attribué par
        l’ARCEP. <Demo />
      </p>
    </Shell>
  );
}
