import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configure } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { WeatherService } from '../src/weather/weather.service';
import { AlertsService } from '../src/alerts/alerts.service';

process.env.RECEIPT_SECRET = 'test-receipt-secret-0123456789';
process.env.USSD_SECRET = 'test-ussd-secret';
process.env.DEMO_MODE = 'true';
process.env.RATE_LIMIT_PER_MIN = '100000';
process.env.SEED_STAFF_PIN = '4821';

const uid = () => randomBytes(6).toString('hex');
const phone = () => `+2299${Math.floor(1e7 + Math.random() * 8.9e7)}`;

describe('AlerteAgri API (e2e, real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
  const login = async (p: string, pin: string) => (await http().post('/auth/login').send({ phone: p, pin }).expect(201)).body.accessToken;

  beforeAll(async () => {
    execSync('npx ts-node prisma/seed.ts', { stdio: 'ignore', env: process.env });
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configure(mod.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
    tokens.admin = await login('+22990000001', '4821');
    tokens.agent = await login('+22990000002', '4821');
    tokens.commune = await login('+22990000003', '4821');
    tokens.advisor = await login('+22990000004', '4821');
    tokens.producer = await login('+22997000001', '1234');
    tokens.otherProducer = await login('+22997000004', '1234');
    tokens.buyer = await login('+22996000001', '1234');
  }, 120000);

  afterAll(() => app.close());

  describe('F-01 roles and acting for', () => {
    it('AC2 self-registration as ADMIN is refused', async () => {
      const r = await http().post('/auth/register').send({ phone: phone(), name: 'Intrus', role: 'ADMIN', communeId: 'parakou', pin: '1111' }).expect(400);
      expect(JSON.stringify(r.body.message)).toMatch(/rôle doit être PRODUCER ou BUYER/);
    });
    it('AC2 self-registration as AGENT is refused', async () => {
      await http().post('/auth/register').send({ phone: phone(), name: 'Intrus', role: 'AGENT', communeId: 'parakou', pin: '1111' }).expect(400);
    });
    it('AC1 registration with an unknown commune is refused', async () => {
      await http().post('/auth/register').send({ phone: phone(), name: 'Awa', role: 'PRODUCER', communeId: 'atlantide', pin: '1111' }).expect(400);
    });
    it('AC4 a producer cannot act for another producer', async () => {
      const other = await prisma.user.findUniqueOrThrow({ where: { phone: '+22997000002' } });
      await http().post('/reports').set(as('producer')).send({ clientId: uid(), cropId: 'mais', symptom: 'chenilles', forUserId: other.id }).expect(403);
    });
    it('AC3 an advisor acts for a producer of the commune, traced in the audit log', async () => {
      const awa = await prisma.user.findUniqueOrThrow({ where: { phone: '+22997000001' } });
      const res = await http().post('/reports').set(as('advisor')).send({ clientId: uid(), cropId: 'mais', symptom: 'taches', forUserId: awa.id }).expect(201);
      expect(res.body.actingForId).toBe(awa.id);
      expect(await prisma.auditLog.count({ where: { entityId: res.body.id, actingForId: awa.id } })).toBe(1);
    });
    it('AC3 an advisor cannot act for a producer of another commune', async () => {
      const kossi = await prisma.user.findUniqueOrThrow({ where: { phone: '+22997000004' } });
      await http().post('/reports').set(as('advisor')).send({ clientId: uid(), cropId: 'mais', symptom: 'taches', forUserId: kossi.id }).expect(403);
    });
    it('AC3 an advisor enrols a producer in their own commune only', async () => {
      const res = await http().post('/users/producers').set(as('advisor')).send({ phone: phone(), name: 'Nouveau producteur', pin: '2222' }).expect(201);
      expect(res.body).toMatchObject({ role: 'PRODUCER', communeId: 'parakou' });
      expect(res.body.pinHash).toBeUndefined();
      await http().post('/users/producers').set(as('producer')).send({ phone: phone(), name: 'X', pin: '2222' }).expect(403);
    });
  });

  describe('F-02 weather', () => {
    it('AC2 a failing provider keeps previous data and records the error', async () => {
      const weather = app.get(WeatherService);
      const before = await prisma.weatherDaily.count();
      const original = weather.fetcher;
      weather.fetcher = async () => { throw new Error('réseau coupé'); };
      const run = await weather.refresh();
      weather.fetcher = original;
      expect(run).toMatchObject({ ok: false, error: 'réseau coupé' });
      expect(await prisma.weatherDaily.count()).toBe(before);
    });
    it('AC1 a provider answer with the wrong number of series is rejected', async () => {
      const weather = app.get(WeatherService);
      const original = weather.fetcher;
      weather.fetcher = async () => new Response(JSON.stringify([{ daily: { time: [] } }]), { status: 200 });
      const run = await weather.refresh();
      weather.fetcher = original;
      expect(run.ok).toBe(false);
      expect(run.error).toMatch(/1 séries pour 77 communes/);
    });
  });

  describe('F-03 / F-04 climate alerts and the loop', () => {
    const day = (offset: number) => {
      const d = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
      return new Date(d.getTime() + offset * 86400000);
    };
    it('AC2 heavy rain creates one alert, re-evaluation does not duplicate it, producers are notified', async () => {
      const stale = await prisma.alert.findMany({ where: { communeId: 'bohicon', ruleId: 'pluie-forte' }, select: { id: true } });
      await prisma.notification.deleteMany({ where: { alertId: { in: stale.map((x) => x.id) } } });
      await prisma.alert.deleteMany({ where: { id: { in: stale.map((x) => x.id) } } });
      await prisma.weatherDaily.deleteMany({ where: { communeId: 'bohicon', date: { gte: day(0) } } });
      await prisma.weatherDaily.createMany({ data: [0, 1, 2].map((o) => ({ communeId: 'bohicon', date: day(o), rainMm: o === 1 ? 72 : 3, tmaxC: 31, humidity: 70, et0Mm: 4, isForecast: true })) });
      const alerts = app.get(AlertsService);
      await alerts.evaluateClimate();
      await alerts.evaluateClimate();
      const created = await prisma.alert.findMany({ where: { communeId: 'bohicon', ruleId: 'pluie-forte', periodKey: day(0).toISOString().slice(0, 10) } });
      expect(created).toHaveLength(1);
      expect(created[0].message).toMatch(/72 mm/);
      const kossi = await prisma.user.findUniqueOrThrow({ where: { phone: '+22997000004' } });
      const n = await prisma.notification.findUniqueOrThrow({ where: { alertId_userId: { alertId: created[0].id, userId: kossi.id } } });
      expect(n.status).toBe('SENT');
    });
    it('AC2 a producer acknowledges their own message but not someone else’s', async () => {
      const kossi = await prisma.user.findUniqueOrThrow({ where: { phone: '+22997000004' } });
      const n = await prisma.notification.findFirstOrThrow({ where: { userId: kossi.id } });
      await http().post(`/notifications/${n.id}/ack`).set(as('producer')).send({});
      await http().post(`/alerts/notifications/${n.id}/ack`).set(as('producer')).send({}).expect(404);
      const ok = await http().post(`/alerts/notifications/${n.id}/ack`).set(as('otherProducer')).send({ action: 'rigoles dégagées' }).expect(201);
      expect(ok.body).toMatchObject({ status: 'READ', action: 'rigoles dégagées' });
    });
    it('AC3 an agent closes the alert and the loop shows read counts', async () => {
      const a = await prisma.alert.findFirstOrThrow({ where: { communeId: 'bohicon', ruleId: 'pluie-forte' } });
      await http().post(`/alerts/${a.id}/close`).set(as('agent')).expect(201);
      const list = await http().get('/alerts?communeId=bohicon').set(as('agent')).expect(200);
      const row = list.body.find((x: { id: string }) => x.id === a.id);
      expect(row.status).toBe('CLOSED');
      expect(row.loop.read).toBeGreaterThanOrEqual(1);
      expect(row.loop.alertToCloseMin).not.toBeNull();
    });
    it('AC4 a producer cannot close an alert or list alerts', async () => {
      const a = await prisma.alert.findFirstOrThrow({});
      await http().post(`/alerts/${a.id}/close`).set(as('producer')).expect(403);
      await http().get('/alerts').set(as('producer')).expect(403);
    });
  });

  describe('F-06 pest reports', () => {
    it('AC4 the same clientId is stored once', async () => {
      const clientId = uid();
      const a = await http().post('/reports').set(as('producer')).send({ clientId, cropId: 'mais', symptom: 'chenilles' }).expect(201);
      const b = await http().post('/reports').set(as('producer')).send({ clientId, cropId: 'mais', symptom: 'chenilles' }).expect(201);
      expect(b.body.id).toBe(a.body.id);
    });
    it('AC4 missing symptom is refused', async () => {
      await http().post('/reports').set(as('producer')).send({ clientId: uid(), cropId: 'mais' }).expect(400);
    });
    it('AC2+AC3 three validated fall armyworm reports alert the commune and its neighbours', async () => {
      await prisma.pestReport.deleteMany({ where: { communeId: 'parakou', cropId: 'mais' } });
      const stale = await prisma.alert.findMany({ where: { ruleId: 'chenille-legionnaire' }, select: { id: true } });
      await prisma.notification.deleteMany({ where: { alertId: { in: stale.map((a) => a.id) } } });
      await prisma.alert.deleteMany({ where: { ruleId: 'chenille-legionnaire' } });
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await http().post('/reports').set(as('producer')).send({ clientId: uid(), cropId: 'mais', symptom: 'feuilles-trouees', lat: 9.34, lon: 2.63 }).expect(201);
        expect(r.body.status).toBe('PENDING');
        ids.push(r.body.id);
      }
      await http().post(`/reports/${ids[0]}/validate`).set(as('agent')).expect(201);
      const second = await http().post(`/reports/${ids[1]}/validate`).set(as('agent')).expect(201);
      expect(second.body.alerts).toHaveLength(0);
      const third = await http().post(`/reports/${ids[2]}/validate`).set(as('agent')).expect(201);
      const communes = third.body.alerts.map((a: { communeId: string }) => a.communeId);
      expect(communes).toContain('parakou');
      expect(communes).toEqual(expect.arrayContaining(['tchaourou', 'n-dali']));
      expect(communes.length).toBeLessThanOrEqual(6);
    });
    it('AC5 a producer does not see the exact position of other people’s reports', async () => {
      const list = await http().get('/reports?communeId=parakou').set(as('otherProducer')).expect(200);
      expect(list.body.length).toBeGreaterThan(0);
      expect(list.body.every((r: { lat: number | null }) => r.lat === null)).toBe(true);
      const staff = await http().get('/reports?communeId=parakou').set(as('agent')).expect(200);
      expect(staff.body.some((r: { lat: number | null }) => r.lat !== null)).toBe(true);
    });
    it('a producer cannot validate a report', async () => {
      const r = await prisma.pestReport.findFirstOrThrow({});
      await http().post(`/reports/${r.id}/validate`).set(as('producer')).expect(403);
    });
  });

  describe('F-08 / F-09 content and inputs', () => {
    it('AC4 a producer cannot publish content', async () => {
      await http().post('/cms/contents').set(as('producer')).send({ kind: 'FICHE_LUTTE', title: 'Test', body: 'Contenu de test assez long', pictogram: 'bug' }).expect(403);
    });
    it('AC1 an agent creates, versions and publishes a sheet', async () => {
      const c = await http().post('/cms/contents').set(as('agent')).send({ kind: 'FICHE_LUTTE', title: 'Fiche test', body: 'Premier texte de la fiche', pictogram: 'bug' }).expect(201);
      const u = await http().put(`/cms/contents/${c.body.id}`).set(as('agent')).send({ kind: 'FICHE_LUTTE', title: 'Fiche test', body: 'Deuxième texte de la fiche', pictogram: 'bug' }).expect(200);
      expect(u.body.version).toBe(2);
      expect((await http().get('/contents').expect(200)).body.some((x: { id: string }) => x.id === c.body.id)).toBe(false);
      await http().post(`/cms/contents/${c.body.id}/publish`).set(as('agent')).expect(201);
      expect((await http().get('/contents').expect(200)).body.some((x: { id: string }) => x.id === c.body.id)).toBe(true);
    });
    it('AC2 a real audio is accepted, a disguised file is refused', async () => {
      const c = await prisma.content.findFirstOrThrow({ where: { status: 'PUBLISHED' } });
      const ogg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60)]);
      await http().post(`/cms/contents/${c.id}/audio/fon`).set(as('advisor')).attach('file', ogg, 'fiche.ogg').expect(201);
      const audio = await http().get(`/contents/${c.id}/audio/fon`).expect(200);
      expect(audio.headers['content-type']).toMatch(/audio\/ogg/);
      await http().post(`/cms/contents/${c.id}/audio/fon`).set(as('advisor')).attach('file', Buffer.from('<script>alert(1)</script> not audio'), 'fiche.mp3').expect(400);
      await http().post(`/cms/contents/${c.id}/audio/klingon`).set(as('advisor')).attach('file', ogg, 'x.ogg').expect(400);
    });
    it('F-09 AC1-3 input check: banned, typo tolerated, unknown never allowed', async () => {
      expect((await http().get('/inputs/check?name=sniper').expect(200)).body.verdict).toBe('NON_HOMOLOGUE');
      expect((await http().get('/inputs/check?name=Snipper').expect(200)).body.verdict).toBe('NON_HOMOLOGUE');
      const unknown = await http().get('/inputs/check?name=produit-miracle').expect(200);
      expect(unknown.body.verdict).toBe('INCONNU');
    });
  });

  describe('F-10 USSD', () => {
    const ussd = (text: string, p = '+22997000001', secret = 'test-ussd-secret') =>
      http().post('/ussd').set('x-ussd-secret', secret).send({ sessionId: uid(), phoneNumber: p, text });
    it('AC4 a request without the gateway secret is refused', async () => {
      await http().post('/ussd').send({ sessionId: uid(), phoneNumber: '+22997000001', text: '' }).expect(401);
      await ussd('', '+22997000001', 'wrong-secret-xxx').expect(401);
    });
    it('AC1 home menu fits the USSD limit', async () => {
      const r = await ussd('').expect(200);
      expect(r.text).toMatch(/^CON AlerteAgri/);
      expect(r.text.length).toBeLessThanOrEqual(182);
    });
    it('AC2 checking a pesticide by USSD', async () => {
      const r = await ussd('3*SNIPER').expect(200);
      expect(r.text).toMatch(/^END .*n’est pas homologué/);
    });
    it('AC2 reporting a pest by USSD creates a pending report', async () => {
      const r = await ussd('2*1*2').expect(200);
      expect(r.text).toMatch(/^END Signalement reçu/);
    });
    it('AC3 invalid choice returns a menu, unknown number is told to enrol', async () => {
      expect((await ussd('9').expect(200)).text).toMatch(/^CON Choix invalide/);
      expect((await ussd('', '+22911111111').expect(200)).text).toMatch(/^END Numéro inconnu/);
    });
    it('the demo phone only uses the logged-in user’s own number', async () => {
      const r = await http().post('/ussd/simulate').set(as('producer')).send({ sessionId: uid(), text: '' }).expect(200);
      expect(r.body.response).toMatch(/^CON AlerteAgri/);
      await http().post('/ussd/simulate').set(as('producer')).send({ sessionId: uid(), text: '', phoneNumber: '+22997000004' }).expect(400);
    });
  });

  describe('F-11 / F-12 market and local tax', () => {
    it('AC2 exporting raw soy without a licence is refused with the decree', async () => {
      const r = await http().post('/market/listings').set(as('producer')).send({ clientId: uid(), cropId: 'soja', quantityKg: 500, pricePerKg: 300, forExport: true }).expect(400);
      expect(r.body.message).toMatch(/1er avril 2024/);
    });
    it('PS-02 two concurrent orders can never exceed the listed quantity', async () => {
      const l = await http().post('/market/listings').set(as('producer')).send({ clientId: uid(), cropId: 'mais', quantityKg: 100, pricePerKg: 220 }).expect(201);
      const results = await Promise.all([1, 2, 3].map(() => http().post('/market/orders').set(as('buyer')).send({ clientId: uid(), listingId: l.body.id, quantityKg: 60 })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409).length).toBe(2);
    });
    it('AC1-2 paying an order computes the TDL and issues a verifiable receipt; tampering is detected', async () => {
      const l = await http().post('/market/listings').set(as('producer')).send({ clientId: uid(), cropId: 'mais', quantityKg: 300, pricePerKg: 220 }).expect(201);
      const o = await http().post('/market/orders').set(as('buyer')).send({ clientId: uid(), listingId: l.body.id, quantityKg: 250 }).expect(201);
      const p = await http().post(`/tax/orders/${o.body.id}/pay`).set(as('buyer')).expect(201);
      expect(p.body.amountFcfa).toBe(375);
      const again = await http().post(`/tax/orders/${o.body.id}/pay`).set(as('buyer')).expect(201);
      expect(again.body.receiptId).toBe(p.body.receiptId);
      const v = await http().get(`/receipts/${p.body.receiptId}?sig=${p.body.signature}`).expect(200);
      expect(v.body).toMatchObject({ valid: true, amountFcfa: 375, commune: 'Parakou' });
      expect(JSON.stringify(v.body)).not.toMatch(/\+229/);
      const bad = p.body.signature.replace(/.$/, (c: string) => (c === '0' ? '1' : '0'));
      expect((await http().get(`/receipts/${p.body.receiptId}?sig=${bad}`).expect(200)).body).toEqual({ valid: false });
    });
    it('a buyer cannot pay someone else’s order', async () => {
      const o = await prisma.order.findFirstOrThrow({});
      await http().post(`/tax/orders/${o.id}/pay`).set(as('producer')).expect(403);
    });
    it('AC3 a commune collector records a market payment once, even if sent twice', async () => {
      const clientId = uid();
      const a = await http().post('/tax/collect').set(as('commune')).send({ clientId, cropId: 'mais', quantityKg: 100 }).expect(201);
      const b = await http().post('/tax/collect').set(as('commune')).send({ clientId, cropId: 'mais', quantityKg: 100 }).expect(201);
      expect(b.body.id).toBe(a.body.id);
    });
    it('a commune cannot change another commune’s rates', async () => {
      await http().put('/tax/rates').set(as('commune')).send({ communeId: 'bohicon', cropId: 'mais', fcfaPer100Kg: 1 }).expect(403);
    });
  });

  describe('F-13 / F-14 traceability and dashboard', () => {
    it('AC2 the public lot page shows origin, never the producer', async () => {
      const parcel = await http().post('/parcels').set(as('producer')).send({ cropId: 'soja', areaHa: 2, lat: 9.345678, lon: 2.612345 }).expect(201);
      const lot = await http().post('/lots').set(as('advisor')).send({ parcelId: parcel.body.id, harvestDate: '2026-09-10', weightKg: 1800, humidityPct: 12 }).expect(201);
      const page = await http().get(`/lots/${lot.body.code}`).expect(200);
      expect(page.body).toMatchObject({ commune: 'Parakou', crop: 'Soja', parcelLocation: { lat: 9.346, lon: 2.612 } });
      expect(page.body.eudr).toMatch(/2026/);
      expect(JSON.stringify(page.body)).not.toMatch(/Awa|\+229/);
    });
    it('AC3 a lot with a negative weight is refused', async () => {
      const parcel = await prisma.parcel.findFirstOrThrow({});
      await http().post('/lots').set(as('advisor')).send({ parcelId: parcel.id, harvestDate: '2026-09-10', weightKg: -5 }).expect(400);
    });
    it('AC6 a commune sees only itself, a producer sees nothing', async () => {
      const r = await http().get('/dashboard/overview').set(as('commune')).expect(200);
      expect(r.body.communes.map((c: { id: string }) => c.id)).toEqual(['parakou']);
      await http().get('/dashboard/overview').set(as('producer')).expect(403);
      const all = await http().get('/dashboard/overview').set(as('agent')).expect(200);
      expect(all.body.communes).toHaveLength(77);
    });
    it('AC4 expected supply is compared with GDIZ capacities, with the source', async () => {
      const r = await http().get('/dashboard/gdiz').set(as('agent')).expect(200);
      expect(r.body.source).toMatch(/GDIZ/);
      expect(r.body.crops.find((c: { cropId: string }) => c.cropId === 'soja').capacityT).toBe(260000);
    });
  });
});
