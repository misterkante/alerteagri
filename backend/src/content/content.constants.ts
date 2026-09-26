export const LANGS = ['fon', 'yoruba', 'bariba', 'dendi', 'francais'];

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export const PICTOGRAMS = [
  'bug',
  'sun',
  'ban',
  'flask',
  'receipt',
  'cloud-rain',
  'sprout',
  'wheat',
];

// Audio type is decided by the file's first bytes, never by its name or declared type.
export function sniffAudio(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WAVE'
  )
    return 'audio/wav';
  if (
    buf.subarray(0, 3).toString('ascii') === 'ID3' ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  )
    return 'audio/mpeg';
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return 'audio/webm';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
  return null;
}
