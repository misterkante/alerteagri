# AlerteAgri

**Voir venir, agir à temps.** Une plateforme de soutien à la production agricole au Bénin, utilisable par un producteur qui ne sait pas lire, qui n'a pas de smartphone ou qui n'a pas de réseau.

**En ligne** : application https://alerteagri.vercel.app · API et documentation https://alerteagri.onrender.com/docs

## Le problème

- L'agriculture fait 25,4 % du PIB et 59,1 % des recettes d'exportation du Bénin (2025), et emploie près de 70 % des actifs.
- Les ravageurs sont vus trop tard : en 2022-2023, les jassides ont fait perdre 26 à 60 % du coton dans la région.
- Le semis est mal calé sur les pluies, et un faux départ fait perdre la levée.
- Maïs et arachide mal séchés développent des aflatoxines.
- Plus de 8 pesticides sur 10 utilisés dans la basse vallée de l'Ouémé ne sont pas homologués.
- Le taux d'alphabétisation était de 38,4 % en 2015.

Sources et niveaux de preuve : [`docs/JUSTIFICATION_RECHERCHE.md`](docs/JUSTIFICATION_RECHERCHE.md).

## Ce que fait AlerteAgri

| Pour | Service | Canal |
|---|---|---|
| Producteur | Alerte météo (forte pluie, poche sèche, chaleur, humidité) calculée chaque jour sur les prévisions réelles de sa commune | SMS, application, USSD |
| Producteur | « Semer maintenant ? » selon le critère agronomique de Sivakumar (1988) appliqué à la pluie réellement tombée | application, USSD |
| Producteur | Signaler un ravageur en deux gestes (culture, symptôme en pictogramme), même sans réseau | application, USSD |
| Producteur | Conseil anti-aflatoxines après la récolte (sécher, couvrir, attendre) | application, SMS |
| Producteur | « Ce pesticide est-il homologué ? » | application, USSD |
| Producteur | Fiches pratiques et réglementaires lues à voix haute : en français par le téléphone, en fon et yoruba par une voix de synthèse signalée (229langues), et dans toute langue enregistrée par un conseiller (fon, yoruba, bariba, dendi) | application |
| Producteur, acheteur | Offres, prix de référence avec leur source, blocage des exports interdits (soja, cajou bruts) | application, API ouverte |
| Conseiller ATDA | Inscrit et accompagne ses producteurs, agit en leur nom (tracé), enregistre l'audio des fiches depuis son téléphone | application |
| Agent ATDA | Valide les signalements, voit la carte des 77 communes, la boucle de chaque alerte (envoyés, lus, actions, délais), la valeur protégée et l'offre déclarée face aux capacités de la GDIZ | tableau de bord |
| Commune | Barème et encaissement de la taxe de développement local, reçu QR vérifiable par tous, recettes | application |
| Acheteur, exportateur | Lot traçable de la parcelle au centre de collecte, avec un QR code (prêt pour le règlement européen anti-déforestation) | page publique |
| Producteur, conseiller | Suivi de parcelle : étapes de culture datées, rappels par SMS, stress hydrique (pluie moins évapotranspiration depuis le semis) | application, SMS |
| Producteur | Photo jointe au signalement, réduite sur le téléphone avant l'envoi | application |
| Producteur | Nouvelle règle publiée : SMS aux producteurs des cultures concernées, une seule fois | SMS |
| Coopérative, conseiller | Vente groupée : une offre, chaque part au nom de son producteur | application |
| Agent ATDA | Règles d'alerte et calendriers de semis modifiables, export FAMEWS pour la FAO, envoi des lots au marché terminal SIPI (adaptateur simulé), indice de sécheresse pour une assurance indicielle (simulation) | tableau de bord |
| Commune | Rapprochement des recettes : chaque reçu revérifié par sa signature, export CSV pour le receveur | application |

Le monitoring fonctionne de bout en bout : relevé météo réel (Open-Meteo, 77 communes, 30 jours passés et 16 jours de prévision), règles paramétrables, alerte, SMS, accusé de lecture, action déclarée, clôture et délais mesurés.

## Tester

| Rôle | Téléphone | PIN |
|---|---|---|
| Producteur (Parakou) | +22997000001 | 1234 |
| Producteur (Bohicon) | +22997000004 | 1234 |
| Acheteur | +22996000001 | 1234 |
| Agent ATDA, commune de Parakou, conseiller, administrateur | +22990000002, +22990000003, +22990000004, +22990000001 | communiqué au jury |

Parcours de démonstration : [`docs/DEMO.md`](docs/DEMO.md).

Ce qui est simulé est marqué « démo » dans l'interface : l'envoi réel des SMS, le code USSD opérateur, le paiement mobile money, les barèmes de TDL, les prix de référence et la liste d'intrants (hors SNIPER, réellement retiré du marché en juillet 2026). Aucune donnée fictive n'est présentée comme réelle.

## Documentation

| Document | Contenu |
|---|---|
| [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md) | vision, acteurs, exigences, architecture, feuille de route |
| [`docs/SPEC.md`](docs/SPEC.md) | 24 features et leurs critères d'acceptation |
| [`docs/JUSTIFICATION_RECHERCHE.md`](docs/JUSTIFICATION_RECHERCHE.md) | la recherche derrière chaque décision |
| [`docs/CONTEXTE_POLITIQUE.md`](docs/CONTEXTE_POLITIQUE.md) | alignement avec le programme 2026-2033 |
| [`docs/architecture/`](docs/architecture/) | packages, diagrammes de classes et de séquence |
| [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) | limites et problèmes connus |
| [`docs/REPORT.md`](docs/REPORT.md) | rapport de livraison : ce qui est vérifié, et comment |

## Démarrer en local

Prérequis : Node 20, Docker.

```bash
npm ci                                 # à la racine : hooks git et tests navigateur
docker run -d --name alerteagri-db -e POSTGRES_USER=alerteagri -e POSTGRES_PASSWORD=alerteagri \
  -e POSTGRES_DB=alerteagri -p 5437:5432 postgres:16-alpine

cd backend
cp .env.example .env                  # puis renseigner les secrets
npm ci
npx prisma migrate deploy
SEED_STAFF_PIN=0000 npm run seed
DEMO_MODE=true RECEIPT_SECRET=un-secret-de-16-caracteres npm run start:dev   # http://localhost:3000/docs

cd ../frontend
npm ci
npm run dev                            # http://localhost:5173
```

## Qualité

Rien n'entre dans le dépôt sans passer trois barrières, et chacune refait le travail de la précédente.

| Barrière | Ce qui est vérifié |
|---|---|
| `pre-commit` (Husky, lint-staged) | fichiers indexés formatés par Prettier, ESLint sans aucun avertissement, aucun secret (fichier `.env`, clé privée, URL de base avec mot de passe, jeton) |
| `commit-msg` (commitlint) | Conventional Commits en anglais, en minuscules ; toute mention d'un assistant comme co-auteur est refusée |
| `pre-push` | lint des deux applications, TypeScript strict (API et tests navigateur), tests métier, format du frontend, build de production |
| CI GitHub Actions (`.github/workflows/ci.yml`) | tout ce qui précède, plus : migrations appliquées sur une base vide et comparées au schéma, tests de bout en bout de l'API sur PostgreSQL, parcours et accessibilité dans Chromium avec rapport Playwright en artefact |

Règles de lint notables : TypeScript `strict`, promesses non attendues interdites, `any` interdit, égalité stricte ; côté interface, `jsx-a11y` en mode strict et les règles des hooks React.

```bash
npm run lint                           # les deux applications, 0 avertissement
npm run typecheck                      # API et tests navigateur
npm test                               # règles métier
npm run test:e2e:api                   # API complète sur la vraie base
npm run test:e2e:web                   # parcours et accessibilité (Playwright + axe)
```

Les tests navigateur démarrent eux-mêmes l'API et le build de production de l'interface. Ils passent l'audit axe WCAG 2.1 A et AA sur 18 écrans et 5 rôles, à 360 px et sur ordinateur, en thème clair et sombre, et échouent sur toute erreur de script ou toute réponse 5xx de l'API. Les parcours couvrent la connexion, le conseil de semis, le contrôle de pesticide, le signalement jusqu'à sa validation par l'agent, la file hors ligne, le téléphone USSD, la vérification publique d'un reçu et d'un lot, et la navigation au clavier des onglets et des choix. Sur une machine sans navigateur Playwright : `PW_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e:web`.

Déploiement : l'API et sa base sur Render (`render.yaml`), l'interface sur Vercel (`frontend/vercel.json`, variable `VITE_API_URL`).

## Stack

NestJS 11, Prisma, PostgreSQL (Supabase), React 18, Vite, Tailwind, PWA (Workbox), thème clair et sombre. Interface alignée sur la charte graphique du gouvernement béninois (Montserrat, vert du drapeau, filet tricolore), nombres et heures à la béninoise. Sécurité : helmet, CORS restreint, limitation de débit, validation stricte des entrées, rôles vérifiés côté serveur, journal d'audit, reçus signés par HMAC, fichiers audio validés par leur contenu.
