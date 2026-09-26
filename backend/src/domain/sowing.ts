export interface DayRain {
  date: Date;
  rainMm: number;
  isForecast: boolean;
}
export interface SowingContext {
  today: Date;
  inWindow: boolean;
  nextWindow: string | null;
}
export interface SowingResult {
  verdict: 'SEMEZ' | 'ATTENDEZ' | 'HORS_SAISON';
  reason: string;
}

export const ONSET_MM = 20;
export const ONSET_DAYS = 3;
export const DRY_DAY_MM = 1;
export const DRY_SPELL_DAYS = 7;
export const FORECAST_HORIZON = 16;

export function sowingAdvice(
  series: DayRain[],
  ctx: SowingContext,
): SowingResult {
  if (!ctx.inWindow) {
    return {
      verdict: 'HORS_SAISON',
      reason: `Hors de la période de semis de votre zone. Prochaine période : ${ctx.nextWindow ?? 'à préciser par votre conseiller'}.`,
    };
  }
  const sorted = [...series].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const observed = sorted.filter((d) => !d.isForecast);
  const forecast = sorted.filter((d) => d.isForecast);

  let onsetIndex = -1;
  for (let i = 0; i + ONSET_DAYS <= observed.length; i++) {
    const sum = observed
      .slice(i, i + ONSET_DAYS)
      .reduce((s, d) => s + d.rainMm, 0);
    if (sum >= ONSET_MM) onsetIndex = i;
  }
  if (onsetIndex < 0) {
    return {
      verdict: 'ATTENDEZ',
      reason: `Les pluies n'ont pas encore vraiment commencé : il faut au moins ${ONSET_MM} mm en ${ONSET_DAYS} jours.`,
    };
  }
  if (forecast.length === 0) {
    return {
      verdict: 'ATTENDEZ',
      reason:
        'Démarrage des pluies détecté, mais aucune prévision disponible pour vérifier les jours suivants.',
    };
  }
  const after = [...observed.slice(onsetIndex + ONSET_DAYS), ...forecast];
  let run = 0;
  for (const day of after) {
    run = day.rainMm < DRY_DAY_MM ? run + 1 : 0;
    if (run >= DRY_SPELL_DAYS) {
      return {
        verdict: 'ATTENDEZ',
        reason: `Une période sèche de ${DRY_SPELL_DAYS} jours est prévue : les jeunes plants risquent de mourir.`,
      };
    }
  }
  return {
    verdict: 'SEMEZ',
    reason:
      `Au moins ${ONSET_MM} mm sont tombés en ${ONSET_DAYS} jours et aucune période sèche de ${DRY_SPELL_DAYS} jours n'est prévue. ` +
      `Le critère complet regarde 30 jours ; la prévision n'en couvre que ${FORECAST_HORIZON} jours au maximum.`,
  };
}
