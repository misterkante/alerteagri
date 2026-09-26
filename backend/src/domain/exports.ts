export interface FamewsRow { date: Date; commune: string; department: string; lat: number | null; lon: number | null; crop: string; symptom: string }

const cell = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function famewsCsv(rows: FamewsRow[]): string {
  const header = 'date,country,admin1,admin2,latitude,longitude,crop,pest,observation';
  const lines = rows.map((r) => [r.date.toISOString().slice(0, 10), 'BJ', r.department, r.commune, r.lat, r.lon, r.crop, 'Spodoptera frugiperda', r.symptom].map(cell).join(','));
  return [header, ...lines].join('\n') + '\n';
}

export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
