# Problèmes connus

Ce qui est simulé, limité ou à durcir avant une mise en production réelle. Une ligne corrigée reste, avec sa date.

| Id | Type | Resume | Ou | Repro | Gravite | Statut | Trouve |
|---|---|---|---|---|---|---|---|
| KI-001 | limitation | Les SMS ne partent pas vraiment : ils vont dans une boîte d'envoi interne, visible dans le tableau de bord | backend/src/alerts/sms.provider.ts | déclencher une alerte : les messages ont le statut SENT dans l'outbox | high | open : brancher un fournisseur derrière SmsProvider | 2026-09-26 F-04 |
| KI-002 | limitation | L'USSD n'a pas de code court opérateur : la passerelle est prête mais testée avec le téléphone simulé | backend/src/ussd/ussd.module.ts | POST /ussd avec le secret de passerelle | high | open : code court ARCEP via agrégateur ou MADAPI | 2026-09-26 F-10 |
| KI-003 | limitation | Le paiement mobile money est simulé : le reçu est réel et signé, pas le débit | backend/src/tax/tax.module.ts payOrder | payer une commande : simulated=true | high | open | 2026-09-26 F-12 |
| KI-004 | limitation | Barèmes TDL, prix de référence et intrants (sauf SNIPER) sont des données de démonstration | backend/prisma/seed.ts | marqués « démo » dans l'interface | medium | open : charger barèmes communaux, bulletins SIM et liste officielle d'homologation | 2026-09-26 seed |
| KI-005 | limitation | Le critère de Sivakumar vient du Sahel et du soudanien et regarde 30 jours ; la prévision n'en couvre que 16 et le calendrier cultural est indicatif | backend/src/domain/sowing.ts | conseil de semis au Sud (deux saisons) | medium | open : calibrer avec Météo-Bénin et l'INRAB | 2026-09-26 F-05 |
| KI-006 | limitation | Le voisinage d'alerte est géographique (5 communes les plus proches à moins de 80 km), pas l'adjacence administrative | backend/src/domain/geo.ts | GET /communes/parakou/neighbors | low | open | 2026-09-26 Q-01 |
| KI-007 | limitation | 5 communes ont des coordonnées saisies à la main (Ifangni, Za-Kpota, Comè, Adjohoun, Djakotomey) | backend/prisma/data/communes.json | geoSource « approximatif » | low | open | 2026-09-26 F-01 |
| KI-008 | security | PIN de 4 chiffres devinable par essais successifs | backend/src/auth/auth.controller.ts | 14 connexions en une minute | high | fixed 2026-09-26 : 5 essais par minute (test e2e « PIN brute force ») ; reste à ajouter un code SMS à usage unique | 2026-09-26 revue |
| KI-009 | limitation | Hébergement gratuit : l'API Render se met en veille (30 à 60 s au premier appel) | render.yaml | premier appel après inactivité | medium | open : réveiller avant la démo ou offre payante | 2026-09-26 déploiement |
| KI-010 | debt | Les audios sont stockés dans PostgreSQL : correct pour quelques fiches, pas pour des milliers | backend/prisma/schema.prisma ContentAudio | n/a | low | open : stockage objet | 2026-09-26 F-08 |
| KI-011 | debt | TypeScript du backend sans mode strict (hérité du squelette) | backend/tsconfig.json | npx tsc --strict signale des erreurs | medium | open | 2026-09-26 revue |
| KI-012 | limitation | Hors ligne : les lectures sont en cache et signalements, accusés et encaissements sont mis en file ; la création d'offre ne l'est pas | frontend/src/api.js | publier une offre en mode avion | low | open | 2026-09-26 F-15 |
| KI-013 | limitation | La valeur protégée utilise des rendements de référence indicatifs | backend/prisma/seed.ts CROPS | tableau de bord | low | open : rendements par pôle | 2026-09-26 F-14 |
| KI-014 | limitation | Le jeton de session est dans le stockage du navigateur ; atténué par la CSP du frontend | frontend/src/api.js | n/a | medium | open : cookie httpOnly si même domaine | 2026-09-26 revue |
| KI-015 | limitation | Aucune évaluation terrain : l'effet réel sur les rendements n'est pas mesuré | n/a | n/a | medium | open : pilote dans un pôle | 2026-09-26 |
