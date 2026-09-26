// Every date and number is shown the Beninese way: French notation, Benin time, whatever the device settings.
const TZ = 'Africa/Porto-Novo';

export const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: TZ });
export const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
export const fmtNum = (n, digits = 0) =>
  Number(n).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmtFcfa = (n) => `${fmtNum(Math.round(n))} FCFA`;
export const fmtDay = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: TZ });
export const fmtLongDate = (d) => {
  const s = new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
// +2290197000001 is shown as people write it: 01 97 00 00 01.
export const fmtPhone = (p) => {
  const local = String(p).replace(/^\+229/, '');
  return /^[0-9]{10}$/.test(local) ? local.replace(/(\d{2})(?=\d)/g, '$1 ') : String(p);
};
