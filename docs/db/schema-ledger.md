# Journal du schéma

Plus récent en haut. Phase : pré-production.

## 2026-09-26 V2 : parcelles suivies, rappels, ventes groupées, photos, notifications générales
Phase : pre-production
Changement :
- `Notification.alertId` devient facultatif ; ajout de `kind` (ALERT, RAPPEL, REGLEMENTATION) et `refId`, unique sur (kind, refId, userId)
- `PestReport` : `photo`, `photoMime`
- `Parcel` : `sownAt`
- `Content` : `targetCrops`
- nouvelles tables `StepReminder` (unique parcelle et étape), `ListingShare` (unique offre et producteur), `IntegrationLog`
Pourquoi : F-16 à F-24. Les rappels d'étapes et les alertes réglementaires ne naissent pas d'une règle climatique : une notification ne peut plus exiger une alerte. L'unicité (kind, refId, userId) garantit qu'un rappel ou une fiche n'est notifié qu'une fois à chaque producteur.
Migration : `backend/prisma/migrations/20260926120000_v2_parcels_reminders_shares` (additive, sans perte de données ; les anciennes notifications gardent `refId` vide, et PostgreSQL traite les valeurs vides comme distinctes)
Code mis à jour : alerts, reports, trace, content, market
Données : aucune donnée réelle

## 2026-09-26 Schéma initial
Phase : pre-production
Changement : 20 tables (référentiel, météo, règles et alertes, notifications, signalements, contenus et audios, intrants, récoltes, prix, offres, commandes, barèmes et paiements TDL, parcelles, lots, audit)
Migration : `backend/prisma/migrations/20260926051316_init`
Décision révisée le même jour : voisinage d'alerte (5 communes les plus proches à moins de 80 km au lieu de 40 km)
