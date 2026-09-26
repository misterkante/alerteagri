export type Zone = 'NORD' | 'SUD';

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

export function neighborIds(communes: { id: string; lat: number; lon: number }[], id: string, km: number): string[] {
  const origin = communes.find((c) => c.id === id);
  if (!origin || km <= 0) return [];
  return communes
    .filter((c) => c.id !== id && haversineKm(origin.lat, origin.lon, c.lat, c.lon) <= km)
    .map((c) => c.id);
}

// The unimodal rainfall regime starts around 8.5 N; south of it there are two rainy seasons.
export function zoneForLat(lat: number): Zone {
  return lat >= 8.5 ? 'NORD' : 'SUD';
}
