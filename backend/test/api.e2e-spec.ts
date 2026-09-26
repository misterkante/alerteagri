import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { DROUGHT_WINDOW_DAYS } from '../src/dashboard/dashboard.constants';
import { AppModule } from '../src/app.module';
import { configure } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { WeatherService } from '../src/weather/weather.service';
import { AlertsService } from '../src/alerts/alerts.service';
import { SMS_PROVIDER } from '../src/alerts/sms.provider';
import {
  VOICE_PROVIDER,
  VoiceProvider,
  VoiceUnavailableError,
} from '../src/content/voice.provider';
import { signReceipt } from '../src/domain/tax';

process.env.RECEIPT_SECRET = 'test-receipt-secret-0123456789';
process.env.USSD_SECRET = 'test-ussd-secret';
process.env.DEMO_MODE = 'true';
process.env.RATE_LIMIT_PER_MIN = '100000';
process.env.LOGIN_LIMIT_PER_MIN = '12';
process.env.LOGIN_IP_LIMIT_PER_MIN = '40';
process.env.VOICE_LIMIT_PER_MIN = '8';
process.env.SEED_STAFF_PIN = '4821';

const uid = () => randomBytes(6).toString('hex');
const phone = () => `+2299${Math.floor(1e7 + Math.random() * 8.9e7)}`;

describe('AlerteAgri API (e2e, real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
  const login = async (p: string, pin: string) =>
    (await http().post('/auth/login').send({ phone: p, pin }).expect(201)).body
      .accessToken;

  beforeAll(async () => {
    execSync('npx ts-node prisma/seed.ts', {
      stdio: 'ignore',
      env: process.env,
    });
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

  it('health endpoint answers for the hosting health check', async () => {
    const r = await http().get('/health').expect(200);
    expect(r.body).toEqual({ status: 'ok', service: 'alerteagri-api' });
  });

  describe('F-01 roles and acting for', () => {
    it('AC2 self-registration as ADMIN is refused', async () => {
      const r = await http()
        .post('/auth/register')
        .send({
          phone: phone(),
          name: 'Intrus',
          role: 'ADMIN',
          communeId: 'parakou',
          pin: '1111',
        })
        .expect(400);
      expect(JSON.stringify(r.body.message)).toMatch(
        /rôle doit être PRODUCER ou BUYER/,
      );
    });
    it('AC2 self-registration as AGENT is refused', async () => {
      await http()
        .post('/auth/register')
        .send({
          phone: phone(),
          name: 'Intrus',
          role: 'AGENT',
          communeId: 'parakou',
          pin: '1111',
        })
        .expect(400);
    });
    it('AC1 registration with an unknown commune is refused', async () => {
      await http()
        .post('/auth/register')
        .send({
          phone: phone(),
          name: 'Awa',
          role: 'PRODUCER',
          communeId: 'atlantide',
          pin: '1111',
        })
        .expect(400);
    });
    it('AC4 a producer cannot act for another producer', async () => {
      const other = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000002' },
      });
      await http()
        .post('/reports')
        .set(as('producer'))
        .send({
          clientId: uid(),
          cropId: 'mais',
          symptom: 'chenilles',
          forUserId: other.id,
        })
        .expect(403);
    });
    it('AC3 an advisor acts for a producer of the commune, traced in the audit log', async () => {
      const awa = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000001' },
      });
      const res = await http()
        .post('/reports')
        .set(as('advisor'))
        .send({
          clientId: uid(),
          cropId: 'mais',
          symptom: 'taches',
          forUserId: awa.id,
        })
        .expect(201);
      expect(res.body.actingForId).toBe(awa.id);
      expect(
        await prisma.auditLog.count({
          where: { entityId: res.body.id, actingForId: awa.id },
        }),
      ).toBe(1);
    });
    it('AC3 an advisor cannot act for a producer of another commune', async () => {
      const kossi = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000004' },
      });
      await http()
        .post('/reports')
        .set(as('advisor'))
        .send({
          clientId: uid(),
          cropId: 'mais',
          symptom: 'taches',
          forUserId: kossi.id,
        })
        .expect(403);
    });
    it('AC3 an advisor enrols a producer in their own commune only', async () => {
      const res = await http()
        .post('/users/producers')
        .set(as('advisor'))
        .send({ phone: phone(), name: 'Nouveau producteur', pin: '2222' })
        .expect(201);
      expect(res.body).toMatchObject({
        role: 'PRODUCER',
        communeId: 'parakou',
      });
      expect(res.body.pinHash).toBeUndefined();
      await http()
        .post('/users/producers')
        .set(as('producer'))
        .send({ phone: phone(), name: 'X', pin: '2222' })
        .expect(403);
    });
  });

  describe('security: PIN brute force', () => {
    it('login attempts are limited per minute', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 14; i++)
        codes.push(
          (
            await http()
              .post('/auth/login')
              .send({ phone: '+22997000003', pin: '0000' })
          ).status,
        );
      expect(codes).toContain(429);
      expect(codes.filter((c) => c === 401).length).toBeLessThanOrEqual(12);
      // KI-020: the lock is on that account, not on everyone behind the same address.
      await http()
        .post('/auth/login')
        .send({ phone: '+22997000004', pin: '1234' })
        .expect(201);
    });
  });

  describe('F-02 weather', () => {
    it('AC2 a failing provider keeps previous data and records the error', async () => {
      const weather = app.get(WeatherService);
      const before = await prisma.weatherDaily.count();
      const original = weather.fetcher;
      weather.fetcher = async () => {
        throw new Error('réseau coupé');
      };
      const run = await weather.refresh();
      weather.fetcher = original;
      expect(run).toMatchObject({ ok: false, error: 'réseau coupé' });
      expect(await prisma.weatherDaily.count()).toBe(before);
    });
    it('AC1 a provider answer with the wrong number of series is rejected', async () => {
      const weather = app.get(WeatherService);
      const original = weather.fetcher;
      weather.fetcher = async () =>
        new Response(JSON.stringify([{ daily: { time: [] } }]), {
          status: 200,
        });
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
      const stale = await prisma.alert.findMany({
        where: { communeId: 'bohicon', ruleId: 'pluie-forte' },
        select: { id: true },
      });
      await prisma.notification.deleteMany({
        where: { alertId: { in: stale.map((x) => x.id) } },
      });
      await prisma.alert.deleteMany({
        where: { id: { in: stale.map((x) => x.id) } },
      });
      await prisma.weatherDaily.deleteMany({
        where: { communeId: 'bohicon', date: { gte: day(0) } },
      });
      await prisma.weatherDaily.createMany({
        data: [0, 1, 2].map((o) => ({
          communeId: 'bohicon',
          date: day(o),
          rainMm: o === 1 ? 72 : 3,
          tmaxC: 31,
          humidity: 70,
          et0Mm: 4,
          isForecast: true,
        })),
      });
      const alerts = app.get(AlertsService);
      await alerts.evaluateClimate();
      await alerts.evaluateClimate();
      const created = await prisma.alert.findMany({
        where: {
          communeId: 'bohicon',
          ruleId: 'pluie-forte',
          periodKey: day(0).toISOString().slice(0, 10),
        },
      });
      expect(created).toHaveLength(1);
      expect(created[0].message).toMatch(/72 mm/);
      const kossi = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000004' },
      });
      const n = await prisma.notification.findUniqueOrThrow({
        where: { alertId_userId: { alertId: created[0].id, userId: kossi.id } },
      });
      expect(n.status).toBe('SENT');
    });
    it('AC2 a producer acknowledges their own message but not someone else’s', async () => {
      const kossi = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000004' },
      });
      const n = await prisma.notification.findFirstOrThrow({
        where: { userId: kossi.id },
      });
      await http()
        .post(`/notifications/${n.id}/ack`)
        .set(as('producer'))
        .send({});
      await http()
        .post(`/alerts/notifications/${n.id}/ack`)
        .set(as('producer'))
        .send({})
        .expect(404);
      const ok = await http()
        .post(`/alerts/notifications/${n.id}/ack`)
        .set(as('otherProducer'))
        .send({ action: 'rigoles dégagées' })
        .expect(201);
      expect(ok.body).toMatchObject({
        status: 'READ',
        action: 'rigoles dégagées',
      });
    });
    it('AC3 an agent closes the alert and the loop shows read counts', async () => {
      const a = await prisma.alert.findFirstOrThrow({
        where: { communeId: 'bohicon', ruleId: 'pluie-forte' },
      });
      await http().post(`/alerts/${a.id}/close`).set(as('agent')).expect(201);
      const list = await http()
        .get('/alerts?communeId=bohicon')
        .set(as('agent'))
        .expect(200);
      const row = list.body.find((x: { id: string }) => x.id === a.id);
      expect(row.status).toBe('CLOSED');
      expect(row.loop.read).toBeGreaterThanOrEqual(1);
      expect(row.loop.alertToCloseMin).not.toBeNull();
    });
    it('AC4 a producer cannot close an alert or list alerts', async () => {
      const a = await prisma.alert.findFirstOrThrow({});
      await http()
        .post(`/alerts/${a.id}/close`)
        .set(as('producer'))
        .expect(403);
      await http().get('/alerts').set(as('producer')).expect(403);
    });
  });

  describe('F-04 AC4 delivery retries', () => {
    it('a failing phone is retried 3 times then marked FAILED, without blocking the others', async () => {
      const provider = app.get(SMS_PROVIDER);
      const original = provider.send;
      const calls: string[] = [];
      provider.send = async (phone: string) => {
        calls.push(phone);
        if (phone === '+22997000003') throw new Error('réseau opérateur');
      };
      const rule = await prisma.alertRule.findUniqueOrThrow({
        where: { id: 'chaleur' },
      });
      const alert = await prisma.alert.create({
        data: {
          kind: 'HEAT',
          ruleId: rule.id,
          communeId: 'tchaourou',
          periodKey: `retry-${uid()}`,
          measured: 42,
          threshold: 40,
          message: 'test',
          firstSignalAt: new Date(),
        },
      });
      const rose = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000003' },
      });
      const other = await http()
        .post('/auth/register')
        .send({
          phone: phone(),
          name: 'Voisin',
          role: 'PRODUCER',
          communeId: 'tchaourou',
          pin: '1111',
        })
        .expect(201);
      await app.get(AlertsService).dispatch(alert.id);
      provider.send = original;
      const failed = await prisma.notification.findUniqueOrThrow({
        where: { alertId_userId: { alertId: alert.id, userId: rose.id } },
      });
      expect(failed).toMatchObject({ status: 'FAILED', attempts: 3 });
      expect(calls.filter((c) => c === '+22997000003')).toHaveLength(3);
      const ok = await prisma.notification.findUniqueOrThrow({
        where: {
          alertId_userId: { alertId: alert.id, userId: other.body.user.id },
        },
      });
      expect(ok.status).toBe('SENT');
    });
  });

  describe('F-08 AC3 rules and calendars managed by agents', () => {
    it('an agent lists and updates an alert rule; incoherent values are refused', async () => {
      const list = await http()
        .get('/alerts/rules')
        .set(as('agent'))
        .expect(200);
      expect(list.body.map((r: { id: string }) => r.id)).toContain(
        'pluie-forte',
      );
      const r = await http()
        .put('/alerts/rules/pluie-forte')
        .set(as('agent'))
        .send({
          threshold: 45,
          windowDays: 3,
          neighborKm: 0,
          active: true,
          message: 'Forte pluie prévue ({measured} mm). Protégez vos récoltes.',
        })
        .expect(200);
      expect(r.body.threshold).toBe(45);
      await http()
        .put('/alerts/rules/pluie-forte')
        .set(as('agent'))
        .send({
          threshold: -5,
          windowDays: 3,
          neighborKm: 0,
          active: true,
          message: 'x'.repeat(20),
        })
        .expect(400);
      await http()
        .put('/alerts/rules/pluie-forte')
        .set(as('agent'))
        .send({
          threshold: 45,
          windowDays: 0,
          neighborKm: 0,
          active: true,
          message: 'x'.repeat(20),
        })
        .expect(400);
      await http()
        .put('/alerts/rules/pluie-forte')
        .set(as('producer'))
        .send({
          threshold: 45,
          windowDays: 3,
          neighborKm: 0,
          active: true,
          message: 'x'.repeat(20),
        })
        .expect(403);
      await http()
        .put('/alerts/rules/pluie-forte')
        .set(as('agent'))
        .send({
          threshold: 50,
          windowDays: 3,
          neighborKm: 0,
          active: true,
          message:
            'Forte pluie prévue ({measured} mm). Dégagez les rigoles, protégez récoltes et semences.',
        })
        .expect(200);
      expect(
        await prisma.auditLog.count({
          where: { entity: 'AlertRule', entityId: 'pluie-forte' },
        }),
      ).toBeGreaterThanOrEqual(2);
    });
    it('an agent updates a sowing window; an inverted window is refused', async () => {
      const w = await http()
        .put('/crops/mais/windows')
        .set(as('agent'))
        .send({ zone: 'SUD', season: 2, start: '08-25', end: '10-10' })
        .expect(200);
      expect(w.body).toMatchObject({ startMmDd: '08-25', endMmDd: '10-10' });
      await http()
        .put('/crops/mais/windows')
        .set(as('agent'))
        .send({ zone: 'SUD', season: 2, start: '10-10', end: '08-25' })
        .expect(400);
      await http()
        .put('/crops/mais/windows')
        .set(as('agent'))
        .send({ zone: 'SUD', season: 2, start: '13-40', end: '14-01' })
        .expect(400);
      await http()
        .put('/crops/mais/windows')
        .set(as('producer'))
        .send({ zone: 'SUD', season: 2, start: '08-25', end: '10-05' })
        .expect(403);
      await http()
        .put('/crops/mais/windows')
        .set(as('agent'))
        .send({ zone: 'SUD', season: 2, start: '08-25', end: '10-05' })
        .expect(200);
    });
  });

  describe('F-06 pest reports', () => {
    it('AC4 the same clientId is stored once', async () => {
      const clientId = uid();
      const a = await http()
        .post('/reports')
        .set(as('producer'))
        .send({ clientId, cropId: 'mais', symptom: 'chenilles' })
        .expect(201);
      const b = await http()
        .post('/reports')
        .set(as('producer'))
        .send({ clientId, cropId: 'mais', symptom: 'chenilles' })
        .expect(201);
      expect(b.body.id).toBe(a.body.id);
    });
    it('AC4 missing symptom is refused', async () => {
      await http()
        .post('/reports')
        .set(as('producer'))
        .send({ clientId: uid(), cropId: 'mais' })
        .expect(400);
    });
    it('AC2+AC3 three validated fall armyworm reports alert the commune and its neighbours', async () => {
      await prisma.pestReport.deleteMany({
        where: { communeId: 'parakou', cropId: 'mais' },
      });
      const stale = await prisma.alert.findMany({
        where: { ruleId: 'chenille-legionnaire' },
        select: { id: true },
      });
      await prisma.notification.deleteMany({
        where: { alertId: { in: stale.map((a) => a.id) } },
      });
      await prisma.alert.deleteMany({
        where: { ruleId: 'chenille-legionnaire' },
      });
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await http()
          .post('/reports')
          .set(as('producer'))
          .send({
            clientId: uid(),
            cropId: 'mais',
            symptom: 'feuilles-trouees',
            lat: 9.34,
            lon: 2.63,
          })
          .expect(201);
        expect(r.body.status).toBe('PENDING');
        ids.push(r.body.id);
      }
      await http()
        .post(`/reports/${ids[0]}/validate`)
        .set(as('agent'))
        .expect(201);
      const second = await http()
        .post(`/reports/${ids[1]}/validate`)
        .set(as('agent'))
        .expect(201);
      expect(second.body.alerts).toHaveLength(0);
      const third = await http()
        .post(`/reports/${ids[2]}/validate`)
        .set(as('agent'))
        .expect(201);
      const communes = third.body.alerts.map(
        (a: { communeId: string }) => a.communeId,
      );
      expect(communes).toContain('parakou');
      expect(communes).toEqual(expect.arrayContaining(['tchaourou', 'n-dali']));
      expect(communes.length).toBeLessThanOrEqual(6);
    });
    it('AC5 a producer does not see the exact position of other people’s reports', async () => {
      const list = await http()
        .get('/reports?communeId=parakou')
        .set(as('otherProducer'))
        .expect(200);
      expect(list.body.length).toBeGreaterThan(0);
      expect(
        list.body.every((r: { lat: number | null }) => r.lat === null),
      ).toBe(true);
      const staff = await http()
        .get('/reports?communeId=parakou')
        .set(as('agent'))
        .expect(200);
      expect(
        staff.body.some((r: { lat: number | null }) => r.lat !== null),
      ).toBe(true);
    });
    it('a producer cannot validate a report', async () => {
      const r = await prisma.pestReport.findFirstOrThrow({});
      await http()
        .post(`/reports/${r.id}/validate`)
        .set(as('producer'))
        .expect(403);
    });
  });

  describe('F-08 synthetic voice in local languages', () => {
    const ogg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60)]);
    let voice: VoiceProvider;
    let saved: Pick<VoiceProvider, 'translate' | 'synthesize'>;
    beforeAll(() => {
      voice = app.get(VOICE_PROVIDER);
      saved = { translate: voice.translate, synthesize: voice.synthesize };
    });
    afterEach(() => Object.assign(voice, saved));
    afterAll(async () => {
      const ids = (
        await prisma.content.findMany({ where: { title: 'Voix test' } })
      ).map((c) => c.id);
      await prisma.contentAudio.deleteMany({
        where: { contentId: { in: ids } },
      });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.content.deleteMany({ where: { id: { in: ids } } });
    });
    const draftSheet = () =>
      prisma.content.create({
        data: {
          kind: 'FICHE_LUTTE',
          title: 'Voix test',
          body: 'Texte de la fiche.',
          pictogram: 'bug',
          status: 'PUBLISHED',
        },
      });

    it('machine translates, voices and labels the audio; the public list shows it as synthetic', async () => {
      const said: string[] = [];
      voice.translate = async () => 'Wema ɖé ɖò fɔn mɛ';
      voice.synthesize = async (text) => {
        said.push(text);
        return ogg;
      };
      const c = await draftSheet();
      const r = await http()
        .post(`/cms/contents/${c.id}/voice/fon`)
        .set(as('agent'))
        .send({})
        .expect(201);
      expect(r.body).toMatchObject({
        origin: 'SYNTHETIC',
        machineTranslated: true,
        transcript: 'Wema ɖé ɖò fɔn mɛ',
      });
      expect(said).toStrictEqual(['Wema ɖé ɖò fɔn mɛ']);
      const listed = (await http().get('/contents').expect(200)).body.find(
        (x: { id: string }) => x.id === c.id,
      );
      expect(listed.audios).toStrictEqual([
        expect.objectContaining({
          lang: 'fon',
          origin: 'SYNTHETIC',
          machineTranslated: true,
          provider: '229langues',
        }),
      ]);
      await http().get(`/contents/${c.id}/audio/fon`).expect(200);
    });

    it('voices a text written by a speaker without translating it', async () => {
      voice.translate = async () => {
        throw new Error('must not translate');
      };
      voice.synthesize = async () => ogg;
      const c = await draftSheet();
      const r = await http()
        .post(`/cms/contents/${c.id}/voice/yoruba`)
        .set(as('advisor'))
        .send({ text: 'Ẹ má ṣe lo oògùn tí a kò fọwọ́ sí' })
        .expect(201);
      expect(r.body.machineTranslated).toBe(false);
    });

    it('an agent removes an audio, traced; a producer cannot; a second removal is a 404', async () => {
      voice.synthesize = async () => ogg;
      const c = await draftSheet();
      await http()
        .post(`/cms/contents/${c.id}/voice/fon`)
        .set(as('agent'))
        .send({ text: 'Wema' })
        .expect(201);
      await http()
        .delete(`/cms/contents/${c.id}/audio/fon`)
        .set(as('producer'))
        .expect(403);
      await http()
        .delete(`/cms/contents/${c.id}/audio/fon`)
        .set(as('agent'))
        .expect(200);
      await http().get(`/contents/${c.id}/audio/fon`).expect(404);
      await http()
        .delete(`/cms/contents/${c.id}/audio/fon`)
        .set(as('agent'))
        .expect(404);
      expect(
        await prisma.auditLog.count({
          where: { entityId: c.id, action: 'content.audio.remove' },
        }),
      ).toBe(1);
    });

    it('never replaces a recording made by a person', async () => {
      voice.synthesize = async () => ogg;
      const c = await draftSheet();
      await http()
        .post(`/cms/contents/${c.id}/audio/fon`)
        .set(as('advisor'))
        .attach('file', ogg, 'fiche.ogg')
        .expect(201);
      await http()
        .post(`/cms/contents/${c.id}/voice/fon`)
        .set(as('agent'))
        .send({ text: 'Wema' })
        .expect(409);
    });

    it('a language without a voice, a producer, a provider outage and a non-audio answer are refused', async () => {
      const c = await draftSheet();
      await http()
        .post(`/cms/contents/${c.id}/voice/bariba`)
        .set(as('agent'))
        .send({ text: 'Texte' })
        .expect(400);
      await http()
        .post(`/cms/contents/${c.id}/voice/fon`)
        .set(as('producer'))
        .send({ text: 'Texte' })
        .expect(403);
      voice.synthesize = async () => {
        throw new VoiceUnavailableError('Service de voix injoignable');
      };
      const down = await http()
        .post(`/cms/contents/${c.id}/voice/fon`)
        .set(as('agent'))
        .send({ text: 'Texte' })
        .expect(502);
      expect(down.body.message).toBe('Service de voix injoignable');
      voice.synthesize = async () => Buffer.from('<html>quota exceeded</html>');
      await http()
        .post(`/cms/contents/${c.id}/voice/fon`)
        .set(as('agent'))
        .send({ text: 'Texte' })
        .expect(502);
      expect(
        await prisma.contentAudio.count({ where: { contentId: c.id } }),
      ).toBe(0);
    });

    it('stays under the provider quota: a burst of generations is cut off', async () => {
      voice.synthesize = async () => ogg;
      const c = await draftSheet();
      const statuses: number[] = [];
      for (let i = 0; i < 10; i++)
        statuses.push(
          (
            await http()
              .post(`/cms/contents/${c.id}/voice/fon`)
              .set(as('agent'))
              .send({ text: 'Texte' })
          ).status,
        );
      expect(statuses).toContain(429);
    });
  });

  describe('F-08 / F-09 content and inputs', () => {
    it('AC4 a producer cannot publish content', async () => {
      await http()
        .post('/cms/contents')
        .set(as('producer'))
        .send({
          kind: 'FICHE_LUTTE',
          title: 'Test',
          body: 'Contenu de test assez long',
          pictogram: 'bug',
        })
        .expect(403);
    });
    it('AC1 an agent creates, versions and publishes a sheet', async () => {
      const c = await http()
        .post('/cms/contents')
        .set(as('agent'))
        .send({
          kind: 'FICHE_LUTTE',
          title: 'Fiche test',
          body: 'Premier texte de la fiche',
          pictogram: 'bug',
        })
        .expect(201);
      const u = await http()
        .put(`/cms/contents/${c.body.id}`)
        .set(as('agent'))
        .send({
          kind: 'FICHE_LUTTE',
          title: 'Fiche test',
          body: 'Deuxième texte de la fiche',
          pictogram: 'bug',
        })
        .expect(200);
      expect(u.body.version).toBe(2);
      expect(
        (await http().get('/contents').expect(200)).body.some(
          (x: { id: string }) => x.id === c.body.id,
        ),
      ).toBe(false);
      await http()
        .post(`/cms/contents/${c.body.id}/publish`)
        .set(as('agent'))
        .expect(201);
      expect(
        (await http().get('/contents').expect(200)).body.some(
          (x: { id: string }) => x.id === c.body.id,
        ),
      ).toBe(true);
    });
    it('captions of a published sheet are WebVTT, a draft has none', async () => {
      const pub = await prisma.content.findFirstOrThrow({
        where: { status: 'PUBLISHED' },
      });
      const r = await http()
        .get(`/contents/${pub.id}/captions.vtt`)
        .expect(200);
      expect(r.headers['content-type']).toMatch(/text\/vtt/);
      expect(r.text.startsWith('WEBVTT\n\n1\n00:00:00.000 --> ')).toBe(true);
      expect(r.text).toContain(pub.title);
      const draft = await prisma.content.create({
        data: {
          kind: 'FICHE_LUTTE',
          title: 'Brouillon',
          body: 'Texte non publié.',
          pictogram: 'bug',
        },
      });
      await http().get(`/contents/${draft.id}/captions.vtt`).expect(404);
      await prisma.content.delete({ where: { id: draft.id } });
    });
    it('AC2 a real audio is accepted, a disguised file is refused', async () => {
      const c = await prisma.content.findFirstOrThrow({
        where: { status: 'PUBLISHED' },
      });
      const ogg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60)]);
      await http()
        .post(`/cms/contents/${c.id}/audio/fon`)
        .set(as('advisor'))
        .attach('file', ogg, 'fiche.ogg')
        .expect(201);
      const audio = await http().get(`/contents/${c.id}/audio/fon`).expect(200);
      expect(audio.headers['content-type']).toMatch(/audio\/ogg/);
      await http()
        .post(`/cms/contents/${c.id}/audio/fon`)
        .set(as('advisor'))
        .attach(
          'file',
          Buffer.from('<script>alert(1)</script> not audio'),
          'fiche.mp3',
        )
        .expect(400);
      await http()
        .post(`/cms/contents/${c.id}/audio/klingon`)
        .set(as('advisor'))
        .attach('file', ogg, 'x.ogg')
        .expect(400);
    });
    it('F-09 AC1-3 input check: banned, typo tolerated, unknown never allowed', async () => {
      expect(
        (await http().get('/inputs/check?name=sniper').expect(200)).body
          .verdict,
      ).toBe('NON_HOMOLOGUE');
      expect(
        (await http().get('/inputs/check?name=Snipper').expect(200)).body
          .verdict,
      ).toBe('NON_HOMOLOGUE');
      const unknown = await http()
        .get('/inputs/check?name=produit-miracle')
        .expect(200);
      expect(unknown.body.verdict).toBe('INCONNU');
    });
  });

  describe('F-10 USSD', () => {
    const ussd = (
      text: string,
      p = '+22997000001',
      secret = 'test-ussd-secret',
    ) =>
      http()
        .post('/ussd')
        .set('x-ussd-secret', secret)
        .send({ sessionId: uid(), phoneNumber: p, text });
    it('AC4 a request without the gateway secret is refused', async () => {
      await http()
        .post('/ussd')
        .send({ sessionId: uid(), phoneNumber: '+22997000001', text: '' })
        .expect(401);
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
      expect((await ussd('', '+22911111111').expect(200)).text).toMatch(
        /^END Numéro inconnu/,
      );
    });
    it('the demo phone only uses the logged-in user’s own number', async () => {
      const r = await http()
        .post('/ussd/simulate')
        .set(as('producer'))
        .send({ sessionId: uid(), text: '' })
        .expect(200);
      expect(r.body.response).toMatch(/^CON AlerteAgri/);
      await http()
        .post('/ussd/simulate')
        .set(as('producer'))
        .send({ sessionId: uid(), text: '', phoneNumber: '+22997000004' })
        .expect(400);
    });
  });

  describe('F-11 / F-12 market and local tax', () => {
    it('AC2 exporting raw soy without a licence is refused with the decree', async () => {
      const r = await http()
        .post('/market/listings')
        .set(as('producer'))
        .send({
          clientId: uid(),
          cropId: 'soja',
          quantityKg: 500,
          pricePerKg: 300,
          forExport: true,
        })
        .expect(400);
      expect(r.body.message).toMatch(/1er avril 2024/);
    });
    it('PS-02 two concurrent orders can never exceed the listed quantity', async () => {
      const l = await http()
        .post('/market/listings')
        .set(as('producer'))
        .send({
          clientId: uid(),
          cropId: 'mais',
          quantityKg: 100,
          pricePerKg: 220,
        })
        .expect(201);
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          http()
            .post('/market/orders')
            .set(as('buyer'))
            .send({ clientId: uid(), listingId: l.body.id, quantityKg: 60 }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409).length).toBe(2);
    });
    it('AC1-2 paying an order computes the TDL and issues a verifiable receipt; tampering is detected', async () => {
      const l = await http()
        .post('/market/listings')
        .set(as('producer'))
        .send({
          clientId: uid(),
          cropId: 'mais',
          quantityKg: 300,
          pricePerKg: 220,
        })
        .expect(201);
      const o = await http()
        .post('/market/orders')
        .set(as('buyer'))
        .send({ clientId: uid(), listingId: l.body.id, quantityKg: 250 })
        .expect(201);
      const p = await http()
        .post(`/tax/orders/${o.body.id}/pay`)
        .set(as('buyer'))
        .expect(201);
      expect(p.body.amountFcfa).toBe(375);
      const again = await http()
        .post(`/tax/orders/${o.body.id}/pay`)
        .set(as('buyer'))
        .expect(201);
      expect(again.body.receiptId).toBe(p.body.receiptId);
      const v = await http()
        .get(`/receipts/${p.body.receiptId}?sig=${p.body.signature}`)
        .expect(200);
      expect(v.body).toMatchObject({
        valid: true,
        amountFcfa: 375,
        commune: 'Parakou',
      });
      expect(JSON.stringify(v.body)).not.toMatch(/\+229/);
      const bad = p.body.signature.replace(/.$/, (c: string) =>
        c === '0' ? '1' : '0',
      );
      expect(
        (
          await http()
            .get(`/receipts/${p.body.receiptId}?sig=${bad}`)
            .expect(200)
        ).body,
      ).toEqual({ valid: false });
    });
    it('a buyer cannot pay someone else’s order', async () => {
      const o = await prisma.order.findFirstOrThrow({});
      await http()
        .post(`/tax/orders/${o.id}/pay`)
        .set(as('producer'))
        .expect(403);
    });
    it('AC3 a commune collector records a market payment once, even if sent twice', async () => {
      const clientId = uid();
      const a = await http()
        .post('/tax/collect')
        .set(as('commune'))
        .send({ clientId, cropId: 'mais', quantityKg: 100 })
        .expect(201);
      const b = await http()
        .post('/tax/collect')
        .set(as('commune'))
        .send({ clientId, cropId: 'mais', quantityKg: 100 })
        .expect(201);
      expect(b.body.id).toBe(a.body.id);
    });
    it('a commune cannot change another commune’s rates', async () => {
      await http()
        .put('/tax/rates')
        .set(as('commune'))
        .send({ communeId: 'bohicon', cropId: 'mais', fcfaPer100Kg: 1 })
        .expect(403);
    });
  });

  describe('V2', () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(200),
    ]);
    it('F-16 AC1-2 a report photo is accepted, validated by content, visible to agents only', async () => {
      const r = await http()
        .post('/reports')
        .set(as('producer'))
        .send({ clientId: uid(), cropId: 'mais', symptom: 'chenilles' })
        .expect(201);
      await http()
        .post(`/reports/${r.body.id}/photo`)
        .set(as('producer'))
        .attach('file', jpeg, 'champ.jpg')
        .expect(201);
      const img = await http()
        .get(`/reports/${r.body.id}/photo`)
        .set(as('agent'))
        .expect(200);
      expect(img.headers['content-type']).toMatch(/image\/jpeg/);
      await http()
        .get(`/reports/${r.body.id}/photo`)
        .set(as('otherProducer'))
        .expect(403);
      await http()
        .post(`/reports/${r.body.id}/photo`)
        .set(as('producer'))
        .attach(
          'file',
          Buffer.from('<svg onload=alert(1)>'.padEnd(40, ' ')),
          'x.jpg',
        )
        .expect(400);
      await http()
        .post(`/reports/${r.body.id}/photo`)
        .set(as('otherProducer'))
        .attach('file', jpeg, 'x.jpg')
        .expect(404);
    });

    it('F-17 AC1-3 a sown parcel gets its steps, reminders are sent once', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const sown = new Date(Date.now() - 25 * 86400000)
        .toISOString()
        .slice(0, 10);
      const p = await http()
        .post('/parcels')
        .set(as('producer'))
        .send({ cropId: 'mais', areaHa: 1, lat: 9.34, lon: 2.62, sownAt: sown })
        .expect(201);
      const steps = await http()
        .get(`/parcels/${p.body.id}/steps`)
        .set(as('producer'))
        .expect(200);
      expect(steps.body.map((s: { code: string }) => s.code)).toStrictEqual([
        'levee',
        'sarclage',
        'fertilisation',
        'recolte',
      ]);
      const run1 = await http()
        .post('/parcels/reminders/run')
        .set(as('agent'))
        .expect(201);
      const run2 = await http()
        .post('/parcels/reminders/run')
        .set(as('agent'))
        .expect(201);
      expect(run1.body.sent).toBeGreaterThanOrEqual(2);
      expect(run2.body.sent).toBe(0);
      expect(run2.body.due).toBe(0);
      const mine = await http()
        .get('/alerts/me')
        .set(as('producer'))
        .expect(200);
      expect(
        mine.body.some(
          (n: { kind: string; body: string }) =>
            n.kind === 'RAPPEL' && /sarclage/i.test(n.body),
        ),
      ).toBe(true);
      await http()
        .post('/parcels')
        .set(as('producer'))
        .send({
          cropId: 'mais',
          areaHa: 1,
          lat: 9.34,
          lon: 2.62,
          sownAt: '2099-01-01',
        })
        .expect(400);
      expect(today).toBeTruthy();
    });

    it('USSD "mes alertes" works with a reminder that has no alert', async () => {
      const r = await http()
        .post('/ussd')
        .set('x-ussd-secret', 'test-ussd-secret')
        .send({ sessionId: uid(), phoneNumber: '+22997000001', text: '5' })
        .expect(200);
      expect(r.text).toMatch(/^CON /);
    });

    it('F-18 AC1-2 water balance of a parcel with and without weather data', async () => {
      const p = await prisma.parcel.findFirstOrThrow({
        where: { sownAt: { not: null }, owner: { phone: '+22997000001' } },
        orderBy: { createdAt: 'desc' },
      });
      const r = await http()
        .get(`/parcels/${p.id}/water`)
        .set(as('producer'))
        .expect(200);
      expect(['NORMAL', 'SURVEILLER', 'STRESS', 'INCONNU']).toContain(
        r.body.level,
      );
      await prisma.weatherDaily.deleteMany({ where: { communeId: 'kalale' } });
      const empty = await prisma.parcel.create({
        data: {
          ownerId: (
            await prisma.user.findUniqueOrThrow({
              where: { phone: '+22997000001' },
            })
          ).id,
          communeId: 'kalale',
          cropId: 'mais',
          areaHa: 1,
          lat: 10.3,
          lon: 3.4,
          sownAt: new Date('2026-06-01T00:00:00Z'),
        },
      });
      const u = await http()
        .get(`/parcels/${empty.id}/water`)
        .set(as('producer'))
        .expect(200);
      expect(u.body.level).toBe('INCONNU');
      await http()
        .get(`/parcels/${p.id}/water`)
        .set(as('otherProducer'))
        .expect(404);
    });

    it('F-19 AC1-2 publishing a regulation for soy notifies soy growers once', async () => {
      const c = await http()
        .post('/cms/contents')
        .set(as('agent'))
        .send({
          kind: 'REGLEMENTATION',
          title: 'Nouvelle norme soja',
          body: 'Humidité maximale du soja livré : 12 pour cent.',
          pictogram: 'ban',
          targetCrops: ['soja'],
        })
        .expect(201);
      const p1 = await http()
        .post(`/cms/contents/${c.body.id}/publish`)
        .set(as('agent'))
        .expect(201);
      const p2 = await http()
        .post(`/cms/contents/${c.body.id}/publish`)
        .set(as('agent'))
        .expect(201);
      expect(p1.body.notified).toBeGreaterThanOrEqual(1);
      expect(p2.body.notified).toBe(0);
      const awa = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000001' },
      });
      expect(
        await prisma.notification.count({
          where: { kind: 'REGLEMENTATION', refId: c.body.id, userId: awa.id },
        }),
      ).toBe(1);
      const none = await http()
        .post('/cms/contents')
        .set(as('agent'))
        .send({
          kind: 'REGLEMENTATION',
          title: 'Sans cible',
          body: 'Fiche sans culture ciblée.',
          pictogram: 'ban',
        })
        .expect(201);
      expect(
        (
          await http()
            .post(`/cms/contents/${none.body.id}/publish`)
            .set(as('agent'))
            .expect(201)
        ).body.notified,
      ).toBe(0);
    });

    it('F-20 AC1-2 an advisor groups producers of the commune into one offer', async () => {
      const producers = await http()
        .get('/users/producers')
        .set(as('advisor'))
        .expect(200);
      const ids = producers.body.slice(0, 2).map((p: { id: string }) => p.id);
      const g = await http()
        .post('/market/group-listings')
        .set(as('advisor'))
        .send({
          clientId: uid(),
          cropId: 'mais',
          pricePerKg: 215,
          shares: ids.map((id: string, i: number) => ({
            producerId: id,
            quantityKg: 100 * (i + 1),
          })),
        })
        .expect(201);
      expect(g.body.quantityKg).toBe(300);
      expect(
        await prisma.listingShare.count({ where: { listingId: g.body.id } }),
      ).toBe(2);
      const kossi = await prisma.user.findUniqueOrThrow({
        where: { phone: '+22997000004' },
      });
      await http()
        .post('/market/group-listings')
        .set(as('advisor'))
        .send({
          clientId: uid(),
          cropId: 'mais',
          pricePerKg: 215,
          shares: [{ producerId: kossi.id, quantityKg: 50 }],
        })
        .expect(403);
      await http()
        .post('/market/group-listings')
        .set(as('advisor'))
        .send({
          clientId: uid(),
          cropId: 'soja',
          pricePerKg: 300,
          forExport: true,
          shares: ids.map((id: string) => ({ producerId: id, quantityKg: 10 })),
        })
        .expect(400);
    });

    it('F-21 AC1-2 FAMEWS export has no personal data', async () => {
      const r = await http()
        .get('/exports/famews')
        .set(as('agent'))
        .expect(200);
      expect(r.headers['content-type']).toMatch(/text\/csv/);
      expect(r.text.split('\n')[0]).toBe(
        'date,country,admin1,admin2,latitude,longitude,crop,pest,observation',
      );
      expect(r.text).not.toMatch(/\+229|Awa/);
      await http().get('/exports/famews').set(as('producer')).expect(403);
    });

    it('F-22 AC1-2 TDL reconciliation checks every signature, scoped to the commune', async () => {
      const paidAt = new Date();
      const other = {
        receiptId: `TDL-B${uid()}`,
        communeId: 'bohicon',
        amountFcfa: 150,
        paidAt: paidAt.toISOString(),
      };
      await prisma.taxPayment.create({
        data: {
          ...other,
          paidAt,
          clientId: uid(),
          cropId: 'mais',
          quantityKg: 100,
          signature: signReceipt(other, process.env.RECEIPT_SECRET!),
        },
      });
      const r = await http()
        .get('/tax/reconciliation')
        .set(as('commune'))
        .expect(200);
      expect(r.body.invalid).toBe(0);
      expect(r.body.count).toBeGreaterThan(0);
      expect(r.body.communes).toStrictEqual(['parakou']);
      const csv = await http()
        .get('/tax/reconciliation.csv')
        .set(as('commune'))
        .expect(200);
      expect(csv.text.split('\n')[0]).toMatch(
        /^receiptId,commune,crop,quantityKg,amountFcfa,paidAt,signatureValid/,
      );
      await prisma.taxPayment.updateMany({
        where: { communeId: 'parakou' },
        data: {},
      });
      const one = await prisma.taxPayment.findFirstOrThrow({
        where: { communeId: 'parakou' },
      });
      await prisma.taxPayment.update({
        where: { id: one.id },
        data: { amountFcfa: one.amountFcfa + 1 },
      });
      expect(
        (await http().get('/tax/reconciliation').set(as('commune')).expect(200))
          .body.invalid,
      ).toBe(1);
      await prisma.taxPayment.update({
        where: { id: one.id },
        data: { amountFcfa: one.amountFcfa },
      });
    });

    it('F-23 AC1 lots are sent to the SIPI connector, logged as simulated', async () => {
      const r = await http()
        .post('/integrations/sipi/lots')
        .set(as('agent'))
        .expect(201);
      expect(r.body).toMatchObject({
        target: 'SIPI-Bénin marché terminal',
        simulated: true,
      });
      expect(r.body.items).toBeGreaterThan(0);
      expect(JSON.stringify(r.body.payload)).not.toMatch(/\+229/);
      await http()
        .post('/integrations/sipi/lots')
        .set(as('producer'))
        .expect(403);
    });

    it('F-24 AC1-2 drought index per commune, labelled as a simulation, reproducible', async () => {
      // Own readings, so the test does not depend on a weather fetch having run on this database.
      const today = new Date(
        new Date().toISOString().slice(0, 10) + 'T00:00:00Z',
      );
      const days = Array.from(
        { length: DROUGHT_WINDOW_DAYS },
        (_, i) => new Date(today.getTime() - (i + 1) * 86400000),
      );
      const rows = days.flatMap((date) => [
        { communeId: 'kandi', date, rainMm: 0, et0Mm: 6 },
        { communeId: 'ouidah', date, rainMm: 25, et0Mm: 3 },
      ]);
      const saved = await prisma.weatherDaily.findMany({
        where: { communeId: { in: ['kandi', 'ouidah'] }, date: { in: days } },
      });
      for (const r of rows)
        await prisma.weatherDaily.upsert({
          where: { communeId_date: { communeId: r.communeId, date: r.date } },
          update: { ...r, isForecast: false },
          create: { ...r, tmaxC: 33, humidity: 50, isForecast: false },
        });
      try {
        const a = await http()
          .get('/dashboard/drought')
          .set(as('agent'))
          .expect(200);
        const b = await http()
          .get('/dashboard/drought')
          .set(as('agent'))
          .expect(200);
        expect(a.body.simulation).toBe(true);
        expect(a.body.communes).toStrictEqual(b.body.communes);
        expect(
          a.body.communes.every(
            (c: { index: number }) => c.index >= 0 && c.index <= 1,
          ),
        ).toBe(true);
        const find = (id: string) =>
          a.body.communes.find(
            (c: { communeId: string }) => c.communeId === id,
          );
        expect(find('kandi').index).toBeGreaterThan(find('ouidah').index);
        expect(find('kandi').rainMm).toBe(0);
      } finally {
        await prisma.weatherDaily.deleteMany({
          where: { communeId: { in: ['kandi', 'ouidah'] }, date: { in: days } },
        });
        for (const s of saved) await prisma.weatherDaily.create({ data: s });
      }
    });
  });

  describe('F-13 / F-14 traceability and dashboard', () => {
    it('AC2 the public lot page shows origin, never the producer', async () => {
      const parcel = await http()
        .post('/parcels')
        .set(as('producer'))
        .send({ cropId: 'soja', areaHa: 2, lat: 9.345678, lon: 2.612345 })
        .expect(201);
      const lot = await http()
        .post('/lots')
        .set(as('advisor'))
        .send({
          parcelId: parcel.body.id,
          harvestDate: '2026-09-10',
          weightKg: 1800,
          humidityPct: 12,
        })
        .expect(201);
      const page = await http().get(`/lots/${lot.body.code}`).expect(200);
      expect(page.body).toMatchObject({
        commune: 'Parakou',
        crop: 'Soja',
        parcelLocation: { lat: 9.346, lon: 2.612 },
      });
      expect(page.body.eudr).toMatch(/2026/);
      expect(JSON.stringify(page.body)).not.toMatch(/Awa|\+229/);
    });
    it('AC3 a lot with a negative weight is refused', async () => {
      const parcel = await prisma.parcel.findFirstOrThrow({});
      await http()
        .post('/lots')
        .set(as('advisor'))
        .send({ parcelId: parcel.id, harvestDate: '2026-09-10', weightKg: -5 })
        .expect(400);
    });
    it('AC6 a commune sees only itself, a producer sees nothing', async () => {
      const r = await http()
        .get('/dashboard/overview')
        .set(as('commune'))
        .expect(200);
      expect(r.body.communes.map((c: { id: string }) => c.id)).toStrictEqual([
        'parakou',
      ]);
      await http().get('/dashboard/overview').set(as('producer')).expect(403);
      const all = await http()
        .get('/dashboard/overview')
        .set(as('agent'))
        .expect(200);
      expect(all.body.communes).toHaveLength(77);
    });
    it('AC4 expected supply is compared with GDIZ capacities, with the source', async () => {
      const r = await http()
        .get('/dashboard/gdiz')
        .set(as('agent'))
        .expect(200);
      expect(r.body.source).toMatch(/GDIZ/);
      expect(
        r.body.crops.find((c: { cropId: string }) => c.cropId === 'soja')
          .capacityT,
      ).toBe(260000);
    });
  });

  // Last on purpose: it spends the address's login budget for the rest of the minute.
  describe('security: PIN spraying across accounts', () => {
    it('one address trying many accounts is cut off', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 45; i++)
        codes.push(
          (
            await http()
              .post('/auth/login')
              .send({ phone: `+229970${String(10000 + i)}`, pin: '1234' })
          ).status,
        );
      expect(codes).toContain(429);
    });
  });
});
