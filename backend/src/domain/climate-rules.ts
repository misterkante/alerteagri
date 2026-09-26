export type ClimateKind =
  'HEAVY_RAIN' | 'DRY_SPELL' | 'HEAT' | 'DISEASE_HUMIDITY';
export interface WeatherDay {
  date: Date;
  rainMm: number;
  tmaxC: number;
  humidity: number;
  isForecast: boolean;
}
export interface ClimateRule {
  kind: ClimateKind;
  threshold: number;
  windowDays: number;
}
export interface RuleResult {
  triggered: boolean;
  measured: number;
  periodKey: string;
}

const DRY_DAY_MM = 1;

function longestRun(
  days: WeatherDay[],
  pred: (d: WeatherDay) => boolean,
): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = pred(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function evaluateClimateRule(
  rule: ClimateRule,
  series: WeatherDay[],
): RuleResult {
  const window = [...series]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, Math.max(rule.windowDays, 0));
  if (window.length === 0)
    return { triggered: false, measured: 0, periodKey: '' };
  const periodKey = window[0].date.toISOString().slice(0, 10);
  let measured: number;
  switch (rule.kind) {
    case 'HEAVY_RAIN':
      measured = Math.max(...window.map((d) => d.rainMm));
      break;
    case 'HEAT':
      measured = Math.max(...window.map((d) => d.tmaxC));
      break;
    case 'DRY_SPELL':
      measured = longestRun(window, (d) => d.rainMm < DRY_DAY_MM);
      break;
    case 'DISEASE_HUMIDITY':
      measured = longestRun(window, (d) => d.humidity >= rule.threshold);
      return { triggered: measured >= rule.windowDays, measured, periodKey };
  }
  return { triggered: measured >= rule.threshold, measured, periodKey };
}
