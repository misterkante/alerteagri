// Messages go to Beninese phones: numbers in French notation (42,3 °C, not 42.3 °C).
export const fillMessage = (
  tpl: string,
  vars: Record<string, string | number>,
): string =>
  Object.entries(vars).reduce(
    (s, [k, v]) =>
      s
        .split(`{${k}}`)
        .join(typeof v === 'number' ? v.toLocaleString('fr-FR') : v),
    tpl,
  );
