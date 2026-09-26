export type PostHarvestCode =
  | 'SECHEZ'
  | 'COUVREZ'
  | 'SECHAGE_POSSIBLE'
  | 'NON_CONCERNE'
  | 'PAS_DE_PREVISION';

export const AFLATOXIN_CROPS = ['mais', 'arachide'];
export const RAIN_MM = 5;
export const HUMID_PCT = 85;

export function postHarvestAdvice(
  cropId: string,
  forecast: { humidity: number; rainMm: number }[],
): { code: PostHarvestCode; message: string } {
  if (!AFLATOXIN_CROPS.includes(cropId)) {
    return {
      code: 'NON_CONCERNE',
      message:
        'Ce conseil concerne le maïs et l’arachide, les cultures les plus exposées aux aflatoxines.',
    };
  }
  if (forecast.length === 0)
    return {
      code: 'PAS_DE_PREVISION',
      message: 'Pas de prévision disponible pour votre commune.',
    };
  if (forecast.some((d) => d.rainMm >= RAIN_MM)) {
    return {
      code: 'COUVREZ',
      message:
        'Pluie prévue : couvrez la récolte et mettez-la à l’abri, sur une surface surélevée.',
    };
  }
  const avgHumidity =
    forecast.reduce((s, d) => s + d.humidity, 0) / forecast.length;
  if (avgHumidity >= HUMID_PCT) {
    return {
      code: 'SECHEZ',
      message:
        'Air très humide : séchez les épis sans spathes dès maintenant, au soleil, et triez les grains abîmés avant de stocker.',
    };
  }
  return {
    code: 'SECHAGE_POSSIBLE',
    message:
      'Temps sec : bonne période pour sécher. Ne stockez que des grains bien secs et triés.',
  };
}
