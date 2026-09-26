export const EXPORT_DECREE =
  'Depuis le 1er avril 2024, l’exportation de soja grain et de noix brute de cajou est interdite sauf agrément et autorisation du ministère chargé du Commerce.';

export function checkExport(crop: { id: string; exportBanned: boolean }, forExport: boolean, license: string | undefined | null) {
  if (!forExport || !crop.exportBanned) return { allowed: true, reason: '' };
  if (license && license.trim().length > 0) return { allowed: true, reason: 'Exportation sous agrément déclaré.' };
  return { allowed: false, reason: `${EXPORT_DECREE} Indiquez votre numéro d’agrément.` };
}
