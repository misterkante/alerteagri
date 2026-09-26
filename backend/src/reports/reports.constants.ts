export const SYMPTOMS = [
  'feuilles-trouees',
  'chenilles',
  'sciure-cornet',
  'jaunissement',
  'taches',
  'fletrissement',
  'insectes-piqueurs',
] as const;

// Symptoms of fall armyworm (Spodoptera frugiperda): the ones that count towards a cluster and FAMEWS.
export const FAW_SYMPTOMS: string[] = [
  'feuilles-trouees',
  'chenilles',
  'sciure-cornet',
];

export const PEST_CROPS = [
  'mais',
  'sorgho',
  'riz',
  'niebe',
  'soja',
  'coton',
  'arachide',
  'manioc',
  'tomate',
];

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
