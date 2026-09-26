import { PrismaClient, Role, Zone } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import communes from './data/communes.json';

const prisma = new PrismaClient();

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Indicative reference yields (kg/ha), used only for the "valeur protégée" estimate, always labelled as an estimate.
const CROPS = [
  { id: 'mais', name: 'Maïs', yieldKgPerHa: 1400, aflatoxinRisk: true },
  { id: 'sorgho', name: 'Sorgho', yieldKgPerHa: 1000 },
  { id: 'riz', name: 'Riz', yieldKgPerHa: 3000 },
  { id: 'manioc', name: 'Manioc', yieldKgPerHa: 14000 },
  { id: 'igname', name: 'Igname', yieldKgPerHa: 12000 },
  { id: 'arachide', name: 'Arachide', yieldKgPerHa: 900, aflatoxinRisk: true },
  { id: 'niebe', name: 'Niébé', yieldKgPerHa: 800 },
  {
    id: 'soja',
    name: 'Soja',
    yieldKgPerHa: 1100,
    cashCrop: true,
    exportBanned: true,
  },
  { id: 'coton', name: 'Coton', yieldKgPerHa: 1000, cashCrop: true },
  {
    id: 'anacarde',
    name: 'Anacarde (cajou)',
    yieldKgPerHa: 450,
    cashCrop: true,
    exportBanned: true,
  },
  { id: 'tomate', name: 'Tomate', yieldKgPerHa: 10000 },
];

// Indicative sowing windows (MM-DD), to be validated by ATDA and INRAB for each pole.
const WINDOWS: [string, Zone, number, string, string][] = [
  ['mais', 'NORD', 1, '05-15', '07-15'],
  ['sorgho', 'NORD', 1, '06-01', '07-15'],
  ['soja', 'NORD', 1, '06-01', '07-10'],
  ['coton', 'NORD', 1, '05-20', '06-30'],
  ['arachide', 'NORD', 1, '05-15', '06-30'],
  ['riz', 'NORD', 1, '06-01', '07-31'],
  ['niebe', 'NORD', 1, '07-01', '08-15'],
  ['manioc', 'NORD', 1, '05-01', '08-31'],
  ['mais', 'SUD', 1, '03-15', '05-15'],
  ['arachide', 'SUD', 1, '03-20', '05-15'],
  ['manioc', 'SUD', 1, '03-15', '06-30'],
  ['niebe', 'SUD', 1, '04-01', '05-31'],
  ['soja', 'SUD', 1, '04-01', '05-31'],
  ['tomate', 'SUD', 1, '03-01', '05-31'],
  ['mais', 'SUD', 2, '08-25', '10-05'],
  ['niebe', 'SUD', 2, '09-01', '10-10'],
  ['arachide', 'SUD', 2, '08-25', '09-30'],
];

const RULES = [
  {
    id: 'pluie-forte',
    kind: 'HEAVY_RAIN',
    label: 'Forte pluie',
    threshold: 50,
    windowDays: 3,
    neighborKm: 0,
    message:
      'Forte pluie prévue ({measured} mm). Dégagez les rigoles, protégez récoltes et semences.',
  },
  {
    id: 'poche-seche',
    kind: 'DRY_SPELL',
    label: 'Poche sèche',
    threshold: 7,
    windowDays: 10,
    neighborKm: 0,
    message:
      'Période sèche de {measured} jours prévue. Retardez les semis, paillez les jeunes plants.',
  },
  {
    id: 'chaleur',
    kind: 'HEAT',
    label: 'Forte chaleur',
    threshold: 40,
    windowDays: 3,
    neighborKm: 0,
    message:
      'Forte chaleur prévue ({measured} °C). Arrosez tôt le matin, protégez les pépinières.',
  },
  {
    id: 'humidite-maladies',
    kind: 'DISEASE_HUMIDITY',
    label: 'Humidité favorable aux maladies',
    threshold: 90,
    windowDays: 3,
    neighborKm: 0,
    message:
      'Air très humide plusieurs jours de suite : surveillez les taches et moisissures sur les feuilles.',
  },
  {
    id: 'chenille-legionnaire',
    kind: 'PEST_CLUSTER',
    label: 'Foyer de chenille légionnaire',
    threshold: 3,
    windowDays: 7,
    neighborKm: 80,
    message:
      'Chenille légionnaire signalée près de chez vous. Inspectez vos champs de maïs aujourd’hui. Écoutez la fiche de lutte.',
  },
  {
    id: 'post-recolte',
    kind: 'POSTHARVEST',
    label: 'Risque aflatoxines après récolte',
    threshold: 85,
    windowDays: 3,
    neighborKm: 0,
    message: 'Risque de moisissure sur votre récolte. {advice}',
  },
] as const;

const CONTENTS = [
  {
    kind: 'FICHE_LUTTE',
    pictogram: 'bug',
    title: 'Chenille légionnaire d’automne sur le maïs',
    body: 'Inspectez vos champs 2 fois par semaine. Cherchez les feuilles trouées et la sciure dans le cornet. Écrasez les masses d’œufs. Signalez tout foyer à votre conseiller. Traitez seulement avec un produit homologué, sur conseil de l’ATDA.',
    officialRef:
      'FAO, programme de lutte contre la chenille légionnaire d’automne',
  },
  {
    kind: 'FICHE_LUTTE',
    pictogram: 'sun',
    title: 'Sécher et stocker maïs et arachide sans aflatoxines',
    body: 'Séchez les épis sans spathes, au soleil, sur une bâche. Triez et retirez les épis abîmés. Stockez seulement des grains bien secs, au sec et en hauteur. Les grains moisis ne se mangent pas et ne se vendent pas.',
    officialRef: 'Hell et al. (2003), IITA, pratiques de stockage au Bénin',
  },
  {
    kind: 'REGLEMENTATION',
    pictogram: 'ban',
    title: 'Exportation du soja grain et de la noix de cajou brute',
    body: 'Depuis le 1er avril 2024, l’exportation de soja grain et de noix brute de cajou est interdite sauf agrément et autorisation du ministère chargé du Commerce. L’exportation par voie terrestre de ces produits et des intrants agricoles est interdite.',
    officialRef:
      'Décret d’avril 2024 ; communiqué de la Direction générale des Douanes',
  },
  {
    kind: 'REGLEMENTATION',
    pictogram: 'flask',
    title: 'N’utilisez que des pesticides homologués',
    body: 'Aucun pesticide ne peut être vendu au Bénin sans homologation. Avant d’acheter, vérifiez le nom du produit avec AlerteAgri ou votre conseiller. Un produit non homologué peut vous rendre malade et abîmer votre sol.',
    officialRef: 'Conseil des ministres du 1er juillet 2026',
  },
  {
    kind: 'REGLEMENTATION',
    pictogram: 'receipt',
    title: 'La taxe de développement local (TDL)',
    body: 'La TDL est due sur les produits agricoles vendus. Son montant est fixé par le conseil de votre commune. Payez-la par mobile money et gardez votre reçu : il prouve que vous avez payé une seule fois.',
    officialRef: 'Code général des impôts ; délibération du conseil communal',
  },
] as const;

const INPUTS = [
  {
    name: 'SNIPER',
    status: 'NOT_HOMOLOGATED',
    source:
      'Conseil des ministres du 1er juillet 2026 (Banouto, 2 juillet 2026)',
    alternative:
      'Demandez à votre conseiller ATDA un produit homologué pour votre culture',
    illustrative: false,
  },
  {
    name: 'Emamectine benzoate',
    status: 'HOMOLOGATED',
    source: 'Exemple de démonstration, à remplacer par la liste officielle',
    alternative: null,
    illustrative: true,
  },
  {
    name: 'Spinetoram',
    status: 'HOMOLOGATED',
    source: 'Exemple de démonstration, à remplacer par la liste officielle',
    alternative: null,
    illustrative: true,
  },
  {
    name: 'Lambda Super',
    status: 'NOT_HOMOLOGATED',
    source: 'Exemple de démonstration, à remplacer par la liste officielle',
    alternative: 'Demandez à votre conseiller ATDA un produit homologué',
    illustrative: true,
  },
] as const;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

async function main() {
  for (const c of communes as {
    name: string;
    department: string;
    pole: number;
    lat: number;
    lon: number;
    geocodedAs: string;
  }[]) {
    const data = {
      name: c.name,
      department: c.department,
      pole: c.pole,
      lat: c.lat,
      lon: c.lon,
      geoSource: c.geocodedAs.startsWith('manuel')
        ? 'approximatif (saisie manuelle)'
        : 'Open-Meteo geocoding',
      zone: (c.lat >= 8.5 ? 'NORD' : 'SUD') as Zone,
    };
    await prisma.commune.upsert({
      where: { id: slug(c.name) },
      update: data,
      create: { id: slug(c.name), ...data },
    });
  }
  for (const c of CROPS) {
    await prisma.crop.upsert({ where: { id: c.id }, update: c, create: c });
  }
  for (const [cropId, zone, season, startMmDd, endMmDd] of WINDOWS) {
    await prisma.cropWindow.upsert({
      where: { cropId_zone_season: { cropId, zone, season } },
      update: { startMmDd, endMmDd },
      create: { cropId, zone, season, startMmDd, endMmDd },
    });
  }
  for (const r of RULES) {
    await prisma.alertRule.upsert({
      where: { id: r.id },
      update: { neighborKm: r.neighborKm },
      create: { ...r },
    });
  }
  for (const i of INPUTS) {
    const data = { ...i, normalized: normalize(i.name) };
    await prisma.inputProduct.upsert({
      where: { normalized: data.normalized },
      update: data,
      create: data,
    });
  }
  if ((await prisma.content.count()) === 0) {
    for (const c of CONTENTS) {
      const content = await prisma.content.create({
        data: { ...c, status: 'PUBLISHED' },
      });
      await prisma.contentVersion.create({
        data: {
          contentId: content.id,
          version: 1,
          title: c.title,
          body: c.body,
          authorId: 'seed',
        },
      });
    }
  }

  const producerPin = await bcrypt.hash('1234', 10);
  const staffPin = process.env.SEED_STAFF_PIN;
  if (!staffPin || !/^[0-9]{4}$/.test(staffPin))
    throw new Error(
      'SEED_STAFF_PIN (4 chiffres) est requis pour créer les comptes du personnel',
    );
  const staffHash = await bcrypt.hash(staffPin, 10);
  const users: {
    phone: string;
    name: string;
    role: Role;
    communeId: string;
    pinHash: string;
  }[] = [
    {
      phone: '+22990000001',
      name: 'Administrateur AlerteAgri',
      role: 'ADMIN',
      communeId: 'cotonou',
      pinHash: staffHash,
    },
    {
      phone: '+22990000002',
      name: 'Agent ATDA Pôle 4',
      role: 'AGENT',
      communeId: 'parakou',
      pinHash: staffHash,
    },
    {
      phone: '+22990000003',
      name: 'Mairie de Parakou (TDL)',
      role: 'COMMUNE',
      communeId: 'parakou',
      pinHash: staffHash,
    },
    {
      phone: '+22990000004',
      name: 'Conseillère Parakou',
      role: 'ADVISOR',
      communeId: 'parakou',
      pinHash: staffHash,
    },
    {
      phone: '+22997000001',
      name: 'Awa Dossou',
      role: 'PRODUCER',
      communeId: 'parakou',
      pinHash: producerPin,
    },
    {
      phone: '+22997000002',
      name: 'Issa Bio',
      role: 'PRODUCER',
      communeId: 'n-dali',
      pinHash: producerPin,
    },
    {
      phone: '+22997000003',
      name: 'Rose Sabi',
      role: 'PRODUCER',
      communeId: 'tchaourou',
      pinHash: producerPin,
    },
    {
      phone: '+22997000004',
      name: 'Kossi Houngbo',
      role: 'PRODUCER',
      communeId: 'bohicon',
      pinHash: producerPin,
    },
    {
      phone: '+22996000001',
      name: 'Coopérative d’achat Borgou',
      role: 'BUYER',
      communeId: 'parakou',
      pinHash: producerPin,
    },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: { role: u.role, communeId: u.communeId },
      create: u,
    });
  }

  const illustrativeRates: [string, string, number][] = [
    ['parakou', 'mais', 150],
    ['parakou', 'soja', 300],
    ['parakou', 'anacarde', 400],
    ['n-dali', 'mais', 150],
    ['tchaourou', 'mais', 120],
    ['bohicon', 'mais', 150],
    ['bohicon', 'tomate', 100],
  ];
  for (const [communeId, cropId, fcfaPer100Kg] of illustrativeRates) {
    await prisma.taxRate.upsert({
      where: { communeId_cropId: { communeId, cropId } },
      update: {},
      create: { communeId, cropId, fcfaPer100Kg },
    });
  }
  if ((await prisma.referencePrice.count()) === 0) {
    const observedAt = new Date('2026-08-31T00:00:00Z');
    const prices: [string, string, number][] = [
      ['mais', 'parakou', 210],
      ['mais', 'bohicon', 230],
      ['soja', 'parakou', 320],
      ['manioc', 'bohicon', 90],
      ['tomate', 'bohicon', 350],
      ['niebe', 'parakou', 480],
      ['riz', 'parakou', 420],
    ];
    for (const [cropId, communeId, pricePerKg] of prices) {
      await prisma.referencePrice.create({
        data: {
          cropId,
          communeId,
          pricePerKg,
          observedAt,
          source:
            'Valeur de démonstration (à remplacer par le bulletin du SIM agricole)',
        },
      });
    }
  }
  if (!(await prisma.lot.findUnique({ where: { code: 'LOT-DEMO0001' } }))) {
    const byPhone = async (phone: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { phone } })).id;
    const demoParcels: [string, string, string, number, number, number][] = [
      ['+22997000001', 'parakou', 'mais', 2.5, 9.352, 2.611],
      ['+22997000001', 'parakou', 'soja', 2, 9.341, 2.655],
      ['+22997000002', 'n-dali', 'mais', 3, 9.871, 2.705],
      ['+22997000003', 'tchaourou', 'soja', 4, 8.893, 2.61],
      ['+22997000003', 'tchaourou', 'anacarde', 5, 8.9, 2.585],
      ['+22997000004', 'bohicon', 'mais', 1.5, 7.18, 2.07],
    ];
    for (const [phone, communeId, cropId, areaHa, lat, lon] of demoParcels) {
      await prisma.parcel.create({
        data: {
          ownerId: await byPhone(phone),
          communeId,
          cropId,
          areaHa,
          lat,
          lon,
        },
      });
    }
    const soja = await prisma.parcel.findFirstOrThrow({
      where: { communeId: 'tchaourou', cropId: 'soja' },
      orderBy: { createdAt: 'desc' },
    });
    await prisma.lot.create({
      data: {
        code: 'LOT-DEMO0001',
        parcelId: soja.id,
        harvestDate: new Date('2026-09-15T00:00:00Z'),
        weightKg: 3200,
        humidityPct: 11.5,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(
    `Seed: ${await prisma.commune.count()} communes, ${await prisma.crop.count()} cultures, ${await prisma.user.count()} comptes`,
  );
}

main()
  .catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Seed échoué :', e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
