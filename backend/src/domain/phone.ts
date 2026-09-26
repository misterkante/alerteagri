// Since 1 January 2025 Beninese numbers have 10 digits: 01 followed by the former 8 (ARCEP).
// People still write them in every way; the platform stores one form: +2290XXXXXXXXX.
const SEPARATORS = /[\s().-]/g;

export function toBeninPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' || /[^0-9+\s().-]/.test(raw)) return null;
  let digits = raw.replace(SEPARATORS, '');
  if (digits.startsWith('+229')) digits = digits.slice(4);
  else if (digits.startsWith('00229')) digits = digits.slice(5);
  else if (digits.startsWith('+')) return null;
  else if (
    digits.startsWith('229') &&
    (digits.length === 11 || digits.length === 13)
  )
    digits = digits.slice(3);
  if (/^[0-9]{8}$/.test(digits)) digits = `01${digits}`;
  return /^01[0-9]{8}$/.test(digits) ? `+229${digits}` : null;
}

export const BENIN_PHONE = /^\+22901[0-9]{8}$/;
export const BENIN_PHONE_MESSAGE =
  'Numéro béninois à 10 chiffres attendu, par exemple 01 97 00 00 01';
