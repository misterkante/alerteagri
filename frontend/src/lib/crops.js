// Each crop carries the pictogram a farmer recognises, not a generic icon.
export const CROPS = [
  { id: 'mais', name: 'Maïs', picto: 'mais' },
  { id: 'soja', name: 'Soja', picto: 'soja' },
  { id: 'arachide', name: 'Arachide', picto: 'arachide' },
  { id: 'niebe', name: 'Niébé', picto: 'niebe' },
  { id: 'riz', name: 'Riz', picto: 'riz' },
  { id: 'sorgho', name: 'Sorgho', picto: 'sorgho' },
  { id: 'manioc', name: 'Manioc', picto: 'manioc' },
  { id: 'coton', name: 'Coton', picto: 'coton' },
  { id: 'tomate', name: 'Tomate', picto: 'tomate' },
  { id: 'anacarde', name: 'Anacarde', picto: 'anacarde' },
  { id: 'igname', name: 'Igname', picto: 'igname' },
];

export const cropPicto = (id) => CROPS.find((c) => c.id === id)?.picto ?? 'semis';
