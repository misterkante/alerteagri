export const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
export const fmtFcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
