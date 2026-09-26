export interface Step {
  code: string;
  label: string;
  due: Date;
}

const DAY = 86400000;

// Indicative cycles (days after sowing), to be refined per variety with INRAB and ATDA.
export const CROP_CYCLES: Record<
  string,
  { days: number; steps: [string, string, number][] }
> = {
  mais: {
    days: 100,
    steps: [
      ['levee', 'Vérifier la levée', 7],
      ['sarclage', 'Premier sarclage', 21],
      ['fertilisation', 'Apport d’engrais', 30],
    ],
  },
  sorgho: {
    days: 110,
    steps: [
      ['levee', 'Vérifier la levée', 7],
      ['sarclage', 'Premier sarclage', 21],
      ['fertilisation', 'Apport d’engrais', 35],
    ],
  },
  riz: {
    days: 120,
    steps: [
      ['levee', 'Vérifier la levée', 7],
      ['sarclage', 'Désherbage', 25],
      ['fertilisation', 'Apport d’urée', 40],
    ],
  },
  soja: {
    days: 110,
    steps: [
      ['levee', 'Vérifier la levée', 7],
      ['sarclage', 'Premier sarclage', 21],
      ['fertilisation', 'Contrôle des ravageurs', 45],
    ],
  },
  arachide: {
    days: 100,
    steps: [
      ['levee', 'Vérifier la levée', 7],
      ['sarclage', 'Sarclage et buttage', 25],
      ['fertilisation', 'Contrôle des feuilles', 45],
    ],
  },
  niebe: {
    days: 75,
    steps: [
      ['levee', 'Vérifier la levée', 6],
      ['sarclage', 'Premier sarclage', 20],
      ['fertilisation', 'Traitement contre les insectes à la floraison', 35],
    ],
  },
  coton: {
    days: 150,
    steps: [
      ['levee', 'Vérifier la levée', 8],
      ['sarclage', 'Démariage et sarclage', 20],
      ['fertilisation', 'Apport d’engrais', 30],
    ],
  },
  manioc: {
    days: 300,
    steps: [
      ['levee', 'Vérifier la reprise des boutures', 14],
      ['sarclage', 'Premier sarclage', 30],
      ['fertilisation', 'Deuxième sarclage', 90],
    ],
  },
  tomate: {
    days: 90,
    steps: [
      ['levee', 'Reprise après repiquage', 7],
      ['sarclage', 'Tuteurage et sarclage', 20],
      ['fertilisation', 'Apport d’engrais', 30],
    ],
  },
};

export function cropSteps(cropId: string, sownAt: Date): Step[] {
  const cycle = CROP_CYCLES[cropId];
  if (!cycle) return [];
  const at = (days: number) => new Date(sownAt.getTime() + days * DAY);
  return [
    ...cycle.steps.map(([code, label, days]) => ({
      code,
      label,
      due: at(days),
    })),
    {
      code: 'recolte',
      label: 'Récolte estimée : préparez le séchage et le stockage',
      due: at(cycle.days),
    },
  ];
}

export interface WaterDay {
  date: Date;
  rainMm: number;
  et0Mm: number;
}
export const WATCH_MM = -40;
export const STRESS_MM = -80;

export function waterBalance(days: WaterDay[], sownAt: Date, now: Date) {
  const kept = days.filter(
    (d) =>
      d.date.getTime() >= sownAt.getTime() && d.date.getTime() <= now.getTime(),
  );
  if (!kept.length)
    return { balanceMm: null, level: 'INCONNU' as const, days: 0 };
  const balanceMm =
    Math.round(kept.reduce((s, d) => s + d.rainMm - d.et0Mm, 0) * 10) / 10;
  const level =
    balanceMm <= STRESS_MM
      ? ('STRESS' as const)
      : balanceMm <= WATCH_MM
        ? ('SURVEILLER' as const)
        : ('NORMAL' as const);
  return { balanceMm, level, days: kept.length };
}

// Illustrative index insurance: payout proportional to the share of crop water demand not met by rain.
export const MAX_PAYOUT_FCFA_PER_HA = 100000;

export function droughtIndex(rainMm: number, et0Mm: number) {
  if (et0Mm <= 0) return { index: 0, payoutFcfaPerHa: 0 };
  const index =
    Math.round(Math.min(1, Math.max(0, (et0Mm - rainMm) / et0Mm)) * 100) / 100;
  return { index, payoutFcfaPerHa: Math.round(index * MAX_PAYOUT_FCFA_PER_HA) };
}
