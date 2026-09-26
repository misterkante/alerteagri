import { Injectable } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import { ReportsService } from '../reports/reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdviceService } from '../advice/advice.service';
import { AlertsService } from '../alerts/alerts.service';
import { toBeninPhone } from '../domain/phone';
import { menu, USSD_MAX } from './ussd.constants';

const CROPS: [string, string][] = [
  ['mais', 'Maïs'],
  ['soja', 'Soja'],
  ['arachide', 'Arachide'],
  ['niebe', 'Niébé'],
  ['riz', 'Riz'],
];

const SYMPTOMS: [string, string][] = [
  ['feuilles-trouees', 'Feuilles trouées'],
  ['chenilles', 'Chenilles'],
  ['sciure-cornet', 'Sciure dans le cornet'],
  ['jaunissement', 'Jaunissement'],
  ['taches', 'Taches'],
];

const con = (s: string) => `CON ${s}`.slice(0, USSD_MAX);

const end = (s: string) => `END ${s}`.slice(0, USSD_MAX);

const HOME =
  'AlerteAgri\n1. Conseil semis\n2. Signaler ravageur\n3. Vérifier pesticide\n4. Prix du jour\n5. Mes alertes';

@Injectable()
export class UssdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly advice: AdviceService,
    private readonly reports: ReportsService,
    private readonly content: ContentService,
    private readonly alerts: AlertsService,
  ) {}

  async handle(sessionId: string, phone: string, text = ''): Promise<string> {
    // Aggregators send numbers in their own format; a malformed one simply finds no account.
    const user = await this.prisma.user.findUnique({
      where: { phone: toBeninPhone(phone) ?? phone },
    });
    if (!user)
      return end(
        'Numéro inconnu. Demandez à votre conseiller agricole de vous inscrire.',
      );
    const parts = text === '' ? [] : text.split('*');
    const [choice, a, b] = parts;
    const pick = <T>(list: T[], v?: string) =>
      v && /^[1-9]$/.test(v) ? list[Number(v) - 1] : undefined;
    const auth = { userId: user.id, phone: user.phone, role: user.role };

    switch (choice) {
      case undefined:
        return con(HOME);
      case '1': {
        const crop = pick(CROPS, a);
        if (!a) return con(`Quelle culture ?\n${menu(CROPS)}`);
        if (!crop) return con(`Choix invalide.\n${menu(CROPS)}`);
        const r = await this.advice.sowing(user.communeId, crop[0]);
        return end(`${r.verdict} (${crop[1]}, ${r.commune}). ${r.reason}`);
      }
      case '2': {
        const crop = pick(CROPS, a);
        if (!a) return con(`Quelle culture ?\n${menu(CROPS)}`);
        if (!crop) return con(`Choix invalide.\n${menu(CROPS)}`);
        const symptom = pick(SYMPTOMS, b);
        if (!b) return con(`Que voyez-vous ?\n${menu(SYMPTOMS)}`);
        if (!symptom) return con(`Choix invalide.\n${menu(SYMPTOMS)}`);
        if (user.role !== 'PRODUCER' && user.role !== 'ADVISOR')
          return end('Signalement réservé aux producteurs.');
        await this.reports.create(auth, {
          clientId: `ussd-${sessionId}`,
          cropId: crop[0],
          symptom: symptom[0],
        });
        return end(
          'Signalement reçu. Un agent va le vérifier. Vous serez prévenu si une alerte est lancée.',
        );
      }
      case '3': {
        if (!a) return con('Tapez le nom du pesticide inscrit sur le bidon :');
        const r = await this.content.checkInput(a);
        return end(
          r.alternative ? `${r.message} ${r.alternative}.` : r.message,
        );
      }
      case '4': {
        const crop = pick(CROPS, a);
        if (!a) return con(`Quel produit ?\n${menu(CROPS)}`);
        if (!crop) return con(`Choix invalide.\n${menu(CROPS)}`);
        const prices = await this.prisma.referencePrice.findMany({
          where: { cropId: crop[0] },
          include: { commune: true },
          orderBy: { observedAt: 'desc' },
          take: 3,
        });
        if (!prices.length)
          return end(`Pas de prix de référence pour ${crop[1]}.`);
        return end(
          `${crop[1]} : ${prices.map((p) => `${p.commune.name} ${p.pricePerKg} F/kg`).join(', ')}.${prices[0].illustrative ? ' (démo)' : ''}`,
        );
      }
      case '5': {
        const last = await this.prisma.notification.findFirst({
          where: { userId: user.id },
          include: { alert: true },
          orderBy: { createdAt: 'desc' },
        });
        if (!last) return end('Aucune alerte pour vous. Bonne saison !');
        if (a === '1') {
          await this.alerts.acknowledge(last.id, user.id, 'confirmé par USSD');
          return end('Merci, lecture confirmée.');
        }
        return con(
          `${last.alert?.message ?? last.body.replace(/^AlerteAgri[^:]*: /, '')}\n1. J’ai lu`,
        );
      }
      default:
        return con(`Choix invalide.\n${HOME}`);
    }
  }
}
