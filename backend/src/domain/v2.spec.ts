import { cropSteps, waterBalance, droughtIndex } from './season';
import { famewsCsv, sniffImage } from './exports';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('F-17 crop steps', () => {
  it('AC1 maize steps are dated from the sowing date, harvest last', () => {
    const steps = cropSteps('mais', d('2026-06-01'));
    expect(steps.map((s) => s.code)).toEqual(['levee', 'sarclage', 'fertilisation', 'recolte']);
    expect(steps[0].due.toISOString().slice(0, 10)).toBe('2026-06-08');
    expect(steps[3].due.toISOString().slice(0, 10)).toBe('2026-09-09');
  });
  it('AC1 an unknown crop has no steps', () => {
    expect(cropSteps('inconnue', d('2026-06-01'))).toEqual([]);
  });
});

describe('F-18 water balance', () => {
  const days = (start: string, rain: number[], et0: number) => rain.map((r, i) => ({ date: new Date(d(start).getTime() + i * 86400000), rainMm: r, et0Mm: et0 }));
  it('AC1 sums rain minus ET0 from sowing to now', () => {
    const r = waterBalance(days('2026-06-01', [10, 0, 0, 5], 4), d('2026-06-01'), d('2026-06-04'));
    expect(r.balanceMm).toBe(-1);
    expect(r.days).toBe(4);
    expect(r.level).toBe('NORMAL');
  });
  it('AC1 levels: surveiller from -40 mm, stress from -80 mm', () => {
    expect(waterBalance(days('2026-06-01', Array(10).fill(0), 4), d('2026-06-01'), d('2026-06-10')).level).toBe('SURVEILLER');
    expect(waterBalance(days('2026-06-01', Array(20).fill(0), 4), d('2026-06-01'), d('2026-06-20')).level).toBe('STRESS');
    expect(waterBalance(days('2026-06-01', Array(9).fill(0), 4.3), d('2026-06-01'), d('2026-06-09')).level).toBe('NORMAL');
  });
  it('AC1 days before sowing or after now are ignored', () => {
    const r = waterBalance(days('2026-05-30', [50, 50, 1, 1, 50], 0), d('2026-06-01'), d('2026-06-02'));
    expect(r.balanceMm).toBe(2);
  });
  it('AC2 no data means unknown, never normal', () => {
    expect(waterBalance([], d('2026-06-01'), d('2026-06-10'))).toEqual({ balanceMm: null, level: 'INCONNU', days: 0 });
  });
});

describe('F-24 drought index', () => {
  it('AC1 rain covering ET0 gives index 0 and no payout', () => {
    expect(droughtIndex(300, 250)).toEqual({ index: 0, payoutFcfaPerHa: 0 });
  });
  it('AC1 the deficit share drives the index and the payout, capped at 1', () => {
    expect(droughtIndex(100, 200)).toEqual({ index: 0.5, payoutFcfaPerHa: 50000 });
    expect(droughtIndex(0, 200)).toEqual({ index: 1, payoutFcfaPerHa: 100000 });
  });
  it('AC2 reproducible and safe with zero ET0', () => {
    expect(droughtIndex(0, 0)).toEqual({ index: 0, payoutFcfaPerHa: 0 });
    expect(droughtIndex(137, 211)).toEqual(droughtIndex(137, 211));
  });
});

describe('F-21 FAMEWS export', () => {
  it('AC1-2 CSV with a header, one line per report, escaped fields', () => {
    const csv = famewsCsv([
      { date: d('2026-09-20'), commune: 'Parakou', department: 'Borgou', lat: 9.3372, lon: 2.6303, crop: 'Maïs', symptom: 'feuilles-trouees' },
      { date: d('2026-09-21'), commune: 'N\'Dali, "nord"', department: 'Borgou', lat: null, lon: null, crop: 'Maïs', symptom: 'chenilles' },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('date,country,admin1,admin2,latitude,longitude,crop,pest,observation');
    expect(lines[1]).toBe('2026-09-20,BJ,Borgou,Parakou,9.3372,2.6303,Maïs,Spodoptera frugiperda,feuilles-trouees');
    expect(lines[2]).toBe('2026-09-21,BJ,Borgou,"N\'Dali, ""nord""",,,Maïs,Spodoptera frugiperda,chenilles');
  });
});

describe('F-16 image sniffing', () => {
  it('AC1 recognises JPEG, PNG and WebP by content', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(12).fill(0)]))).toBe('image/jpeg');
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(8).fill(0)]))).toBe('image/png');
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]))).toBe('image/webp');
  });
  it('AC2 rejects anything else', () => {
    expect(sniffImage(Buffer.from('<svg onload=alert(1)></svg>........'))).toBeNull();
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(4)]))).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

import { CROP_CYCLES } from './season';
import { neighborIds } from './geo';

describe('mutation survivors V2', () => {
  it('F-17 every crop cycle has four ordered steps, non-empty labels, harvest at the end of the cycle', () => {
    const sown = d('2026-05-01');
    expect(Object.keys(CROP_CYCLES).sort()).toEqual(['arachide', 'coton', 'mais', 'manioc', 'niebe', 'riz', 'soja', 'sorgho', 'tomate']);
    for (const [crop, cycle] of Object.entries(CROP_CYCLES)) {
      const steps = cropSteps(crop, sown);
      expect(steps.map((s) => s.code)).toEqual(['levee', 'sarclage', 'fertilisation', 'recolte']);
      steps.forEach((s) => expect(s.label.length).toBeGreaterThan(8));
      for (let i = 1; i < steps.length; i++) expect(steps[i].due.getTime()).toBeGreaterThan(steps[i - 1].due.getTime());
      expect((steps[3].due.getTime() - sown.getTime()) / 86400000).toBe(cycle.days);
      expect(cycle.days).toBeGreaterThanOrEqual(60);
      expect(steps[0].due.getTime()).toBeGreaterThan(sown.getTime());
    }
  });
  it('F-17 documented cycle lengths (indicative, KI-018)', () => {
    expect(Object.fromEntries(Object.entries(CROP_CYCLES).map(([k, v]) => [k, v.days]))).toEqual({
      mais: 100, sorgho: 110, riz: 120, soja: 110, arachide: 100, niebe: 75, coton: 150, manioc: 300, tomate: 90,
    });
  });
  it('F-16 partial or shifted magic bytes are not images', () => {
    const pad = (b: number[]) => Buffer.from([...b, ...Array(12).fill(0)]);
    expect(sniffImage(pad([0xff, 0xd8, 0x00]))).toBeNull();
    expect(sniffImage(pad([0x00, 0xd8, 0xff]))).toBeNull();
    expect(sniffImage(pad([0xff, 0x00, 0xff]))).toBeNull();
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('image/webp');
    expect(sniffImage(Buffer.concat([Buffer.from('RIFX'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBeNull();
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b, 0, 0, 0, 0]))).toBeNull();
    expect(sniffImage(Buffer.alloc(11, 0xff))).toBeNull();
  });
  it('F-21 the CSV ends with a newline and has no trailing separator', () => {
    const csv = famewsCsv([]);
    expect(csv).toBe('date,country,admin1,admin2,latitude,longitude,crop,pest,observation\n');
  });
  it('F-01 an unknown commune has no neighbours', () => {
    expect(neighborIds([{ id: 'a', lat: 9, lon: 2 }], 'zzz', 80, 5)).toEqual([]);
  });
});
