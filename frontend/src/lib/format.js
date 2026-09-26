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
