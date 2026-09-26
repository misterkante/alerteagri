export const USSD_MAX = 182;

export const menu = (items: [string, string][]) =>
  items.map(([, label], i) => `${i + 1}. ${label}`).join('\n');
