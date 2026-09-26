import { haversineKm, neighborIds, zoneForLat } from './geo';
import { sowingAdvice, DayRain } from './sowing';
import { evaluateClimateRule, WeatherDay } from './climate-rules';
import { pestClusterReached } from './pest';
import { postHarvestAdvice } from './postharvest';
import { normalizeName, matchInput } from './inputs';
import { checkExport } from './market';
import { computeTdl, signReceipt, verifyReceipt } from './tax';
import { protectedValueFcfa } from './value';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const days = (start: string, rains: number[], forecastFrom?: number): DayRain[] =>
  rains.map((rainMm, i) => {
    const date = new Date(d(start).getTime() + i * 86400000);
    return { date, rainMm, isForecast: forecastFrom !== undefined && i >= forecastFrom };
  });

describe('geo (F-01, Q-01)', () => {
  it('distance Cotonou-Parakou is about 350 km', () => {
    const km = haversineKm(6.3654, 2.4183, 9.3372, 2.6303);
    expect(km).toBeGreaterThan(320);
    expect(km).toBeLessThan(345);
  });
  it('neighbors are communes within the radius, excluding itself', () => {
    const communes = [
      { id: 'a', lat: 9.0, lon: 2.0 },
      { id: 'b', lat: 9.2, lon: 2.0 },
      { id: 'c', lat: 10.0, lon: 2.0 },
    ];
    expect(neighborIds(communes, 'a', 40)).toEqual(['b']);
    expect(neighborIds(communes, 'a', 0)).toEqual([]);
  });
  it('zone is NORD from 8.5 degrees of latitude', () => {
    expect(zoneForLat(8.5)).toBe('NORD');
    expect(zoneForLat(8.49)).toBe('SUD');
  });
});

describe('F-05 sowing advice (Sivakumar 1988)', () => {
  const inWindow = { today: d('2026-05-20'), inWindow: true, nextWindow: null };
  it('AC1 SEMEZ when 20 mm fell in 3 days and no 7-day dry spell is forecast', () => {
    const series = days('2026-05-17', [8, 7, 5, ...Array(16).fill(3)], 3);
    const r = sowingAdvice(series, inWindow);
    expect(r.verdict).toBe('SEMEZ');
    expect(r.reason).toMatch(/20 mm/);
    expect(r.reason).toMatch(/16 jours/);
  });
  it('AC4 exactly 20 mm counts as onset', () => {
    const series = days('2026-05-17', [10, 5, 5, ...Array(16).fill(2)], 3);
    expect(sowingAdvice(series, inWindow).verdict).toBe('SEMEZ');
  });
  it('AC4 19.9 mm is not an onset', () => {
    const series = days('2026-05-17', [10, 5, 4.9, ...Array(16).fill(2)], 3);
    const r = sowingAdvice(series, inWindow);
    expect(r.verdict).toBe('ATTENDEZ');
    expect(r.reason).toMatch(/pas encore/);
  });
  it('AC4 a forecast dry spell of 7 days blocks sowing', () => {
    const series = days('2026-05-17', [10, 10, 5, 2, 0, 0, 0, 0, 0, 0, 0, 3, 3], 3);
    const r = sowingAdvice(series, inWindow);
    expect(r.verdict).toBe('ATTENDEZ');
    expect(r.reason).toMatch(/7 jours/);
  });
  it('AC4 a forecast dry spell of 6 days does not block sowing', () => {
    const series = days('2026-05-17', [10, 10, 5, 2, 0, 0, 0, 0, 0, 0, 3, 3], 3);
    expect(sowingAdvice(series, inWindow).verdict).toBe('SEMEZ');
  });
  it('AC4 a day with less than 1 mm counts as dry', () => {
    const series = days('2026-05-17', [10, 10, 5, 0.5, 0.9, 0, 0, 0, 0, 0.2, 3], 3);
    expect(sowingAdvice(series, inWindow).verdict).toBe('ATTENDEZ');
  });
  it('AC4 no forecast available: ATTENDEZ with an explicit reason', () => {
    const series = days('2026-05-17', [10, 10, 5]);
    const r = sowingAdvice(series, inWindow);
    expect(r.verdict).toBe('ATTENDEZ');
    expect(r.reason).toMatch(/prévision/);
  });
  it('AC3 outside the crop window: HORS_SAISON with the next window', () => {
    const r = sowingAdvice([], { today: d('2026-01-10'), inWindow: false, nextWindow: '15/03' });
    expect(r.verdict).toBe('HORS_SAISON');
    expect(r.reason).toMatch(/15\/03/);
  });
});

describe('F-03 climate rules', () => {
  const series = (vals: Partial<WeatherDay>[]): WeatherDay[] =>
    vals.map((v, i) => ({ date: new Date(d('2026-06-01').getTime() + i * 86400000), rainMm: 0, tmaxC: 30, humidity: 70, isForecast: false, ...v }));
  it('AC1 heavy rain triggers on the max daily rain in the window', () => {
    const r = evaluateClimateRule({ kind: 'HEAVY_RAIN', threshold: 50, windowDays: 3 }, series([{ rainMm: 10 }, { rainMm: 62 }, { rainMm: 5 }]));
    expect(r).toMatchObject({ triggered: true, measured: 62 });
  });
  it('AC1 heavy rain at 49.9 does not trigger', () => {
    expect(evaluateClimateRule({ kind: 'HEAVY_RAIN', threshold: 50, windowDays: 3 }, series([{ rainMm: 49.9 }])).triggered).toBe(false);
  });
  it('AC1 dry spell counts the longest run of days under 1 mm', () => {
    const r = evaluateClimateRule({ kind: 'DRY_SPELL', threshold: 7, windowDays: 10 },
      series([{ rainMm: 3 }, ...Array(7).fill({ rainMm: 0.4 }), { rainMm: 5 }]));
    expect(r).toMatchObject({ triggered: true, measured: 7 });
  });
  it('AC1 heat triggers on max temperature', () => {
    expect(evaluateClimateRule({ kind: 'HEAT', threshold: 40, windowDays: 2 }, series([{ tmaxC: 41 }])).measured).toBe(41);
  });
  it('AC1 disease humidity needs consecutive humid days', () => {
    const rule = { kind: 'DISEASE_HUMIDITY' as const, threshold: 90, windowDays: 3 };
    expect(evaluateClimateRule(rule, series([{ humidity: 92 }, { humidity: 95 }, { humidity: 91 }])).triggered).toBe(true);
    expect(evaluateClimateRule(rule, series([{ humidity: 92 }, { humidity: 80 }, { humidity: 91 }])).triggered).toBe(false);
  });
  it('AC2 the period key is stable for the same window, so re-evaluation does not duplicate', () => {
    const s = series([{ rainMm: 70 }]);
    const rule = { kind: 'HEAVY_RAIN' as const, threshold: 50, windowDays: 3 };
    expect(evaluateClimateRule(rule, s).periodKey).toBe(evaluateClimateRule(rule, s).periodKey);
    expect(evaluateClimateRule(rule, s).periodKey).toBe('2026-06-01');
  });
  it('AC4 an empty series never triggers', () => {
    expect(evaluateClimateRule({ kind: 'HEAT', threshold: 40, windowDays: 3 }, []).triggered).toBe(false);
  });
});

describe('F-06 pest cluster', () => {
  const now = d('2026-06-10');
  const at = (iso: string) => ({ status: 'VALIDATED' as const, createdAt: d(iso) });
  it('AC3 reaches the threshold with validated reports in the last 7 days', () => {
    expect(pestClusterReached([at('2026-06-09'), at('2026-06-05'), at('2026-06-04')], 3, now)).toBe(true);
  });
  it('AC2 pending reports never count', () => {
    expect(pestClusterReached([at('2026-06-09'), at('2026-06-08'), { status: 'PENDING', createdAt: d('2026-06-09') }], 3, now)).toBe(false);
  });
  it('AC3 a report older than 7 days does not count', () => {
    expect(pestClusterReached([at('2026-06-09'), at('2026-06-08'), at('2026-06-02')], 3, now)).toBe(false);
  });
});

describe('F-07 post-harvest advice', () => {
  const f = (humidity: number[], rain: number[]) => humidity.map((h, i) => ({ humidity: h, rainMm: rain[i] ?? 0 }));
  it('AC2 rain forecast: cover and shelter', () => {
    expect(postHarvestAdvice('mais', f([70, 75, 80], [0, 12, 0])).code).toBe('COUVREZ');
  });
  it('AC2 high humidity without rain: dry now', () => {
    expect(postHarvestAdvice('arachide', f([88, 90, 86], [0, 0, 0])).code).toBe('SECHEZ');
  });
  it('AC2 dry weather: drying possible', () => {
    expect(postHarvestAdvice('mais', f([60, 55, 65], [0, 0, 0])).code).toBe('SECHAGE_POSSIBLE');
  });
  it('AC3 unconcerned crop or no forecast: no advice', () => {
    expect(postHarvestAdvice('coton', f([90], [20])).code).toBe('NON_CONCERNE');
    expect(postHarvestAdvice('mais', []).code).toBe('PAS_DE_PREVISION');
  });
});

describe('F-09 input check', () => {
  const list = [
    { normalized: 'sniper', status: 'NOT_HOMOLOGATED' as const, name: 'SNIPER' },
    { normalized: 'emamectine benzoate', status: 'HOMOLOGATED' as const, name: 'Émamectine benzoate' },
  ];
  it('AC2 normalizes case, accents and spaces', () => {
    expect(normalizeName('  Émamectine   BENZOATE ')).toBe('emamectine benzoate');
  });
  it('AC1 exact and AC2 one-typo matches are found', () => {
    expect(matchInput('Sniper', list)?.status).toBe('NOT_HOMOLOGATED');
    expect(matchInput('snipper', list)?.name).toBe('SNIPER');
  });
  it('AC3 unknown never returns a product', () => {
    expect(matchInput('glyphotruc', list)).toBeNull();
    expect(matchInput('sn', list)).toBeNull();
  });
});

describe('F-11 export check', () => {
  const soja = { id: 'soja', exportBanned: true };
  it('AC2 banned crop for export without license is refused with the decree reference', () => {
    const r = checkExport(soja, true, undefined);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/2024/);
  });
  it('AC2 with a license it is allowed; local sale is always allowed', () => {
    expect(checkExport(soja, true, 'AGR-2026-0042').allowed).toBe(true);
    expect(checkExport(soja, false, undefined).allowed).toBe(true);
  });
  it('AC2 a blank license does not count', () => {
    expect(checkExport(soja, true, '   ').allowed).toBe(false);
  });
});

describe('F-12 TDL', () => {
  it('AC1 amount is an integer in FCFA, rounded up', () => {
    expect(computeTdl(250, 150)).toBe(375);
    expect(computeTdl(101, 150)).toBe(152);
    expect(computeTdl(0, 150)).toBe(0);
  });
  it('AC1 rejects negative quantities or rates', () => {
    expect(() => computeTdl(-1, 150)).toThrow(/négati/);
    expect(() => computeTdl(10, -5)).toThrow(/négati/);
  });
  it('AC4 a receipt verifies, a tampered one does not', () => {
    const r = { receiptId: 'R1', communeId: 'parakou', amountFcfa: 375, paidAt: '2026-06-10T10:00:00.000Z' };
    const sig = signReceipt(r, 'secret');
    expect(verifyReceipt(r, sig, 'secret')).toBe(true);
    expect(verifyReceipt({ ...r, amountFcfa: 3750 }, sig, 'secret')).toBe(false);
    expect(verifyReceipt(r, sig, 'other')).toBe(false);
    expect(verifyReceipt(r, 'not-hex', 'secret')).toBe(false);
  });
});

describe('F-14 protected value', () => {
  it('AC3 area x yield x price, integer FCFA', () => {
    expect(protectedValueFcfa(2.5, 1800, 200)).toBe(900000);
    expect(protectedValueFcfa(0, 1800, 200)).toBe(0);
  });
});
