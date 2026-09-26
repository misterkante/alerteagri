# Rapport de livraison

## Synthèse (2026-09-26)

**À lire en premier** : les SMS, le code USSD opérateur et le paiement mobile money sont simulés (KI-001 à KI-003). Tout le reste fonctionne sur des données réelles ou des données de démonstration marquées comme telles.

| | |
|---|---|
| Features | F-01 à F-15 livrées (F-15 partielle : la création d'offre n'est pas mise en file hors ligne, KI-012) |
| Tests | 50 tests des règles métier et 40 tests de bout en bout sur une vraie base PostgreSQL, tous verts |
| Mutation (règles métier) | 341 mutants tués sur 361 (94 %) |
| Failles réintroduites volontairement | 7 sur 7 détectées par les tests (escalade de rôle, action pour autrui hors commune, survente, USSD sans secret, fuite de position, reçu falsifié, force brute du PIN) |
| Documentation vérifiée contre le code | `docs_check` : 0 erreur (11 packages secondaires sans diagramme de classes) |
| Problèmes connus ouverts | 5 high, 5 medium, 4 low ; 1 corrigé (KI-008) |
| Pentest | revue de sécurité sur le code et tests de bout en bout ; pas de pentest actif sur l'instance déployée (non vérifié) |

## Critères d'acceptation

Statut : **verified** = prouvé par un test exécuté ; **partial** = une partie seulement ; **unverified** = non prouvé ici.

| Feature | Critères | Statut | Preuve |
|---|---|---|---|
| F-01 Référentiel et rôles | AC1 à AC4 | verified | e2e « F-01 » (7 tests) ; 77 communes chargées |
| F-02 Météo | AC1, AC2 | verified | e2e « F-02 » (panne, réponse incohérente) ; relevé réel exécuté le 2026-09-26 : 77 communes en 2,8 s |
| F-02 | AC3 source et date affichées | verified | écran semis et tableau de bord (capture à 360 px) |
| F-03 Règles climat | AC1 à AC4 | verified | tests métier « F-03 », e2e « heavy rain » (sans doublon à la ré-évaluation) ; une alerte réelle (humidité, Banté) créée sur les prévisions du jour |
| F-04 Diffusion et boucle | AC1 à AC3 | verified | e2e « F-03 / F-04 » (notification, accusé, action, clôture, délais) |
| F-04 | AC4 nouvel essai après échec d'envoi | partial | logique de nouvel essai présente ; le fournisseur interne ne tombe jamais en panne, donc le chemin d'échec n'est pas exercé en test |
| F-05 Semis | AC1 à AC4 | verified | 13 tests métier dont les bornes 20 mm, 6 et 7 jours, 1 mm, prévision absente, ordre des jours |
| F-06 Ravageurs | AC1 à AC5 | verified | e2e « F-06 » : 3 signalements validés alertent Parakou, Tchaourou et N'Dali ; même clientId stocké une fois ; position masquée aux producteurs |
| F-07 Post-récolte | AC1 à AC3 | verified | tests métier « F-07 » (bornes 5 mm et 85 %) |
| F-08 CMS | AC1, AC2, AC4 | verified | e2e « F-08 » : versions, publication, audio réel accepté, fichier déguisé refusé, langue inconnue refusée |
| F-08 | AC3 barèmes, seuils et calendriers dans le CMS | partial | barèmes via l'API des recettes ; seuils et calendriers modifiables en base, pas encore depuis l'écran CMS |
| F-09 Intrants | AC1 à AC3 | verified | tests métier et e2e (SNIPER, faute de frappe, nom ambigu, inconnu) |
| F-10 USSD | AC1 à AC4 | verified | e2e « F-10 » : secret exigé, menu de 182 caractères au plus, pesticide, signalement, choix invalide, numéro inconnu, téléphone de démo lié à son propre numéro |
| F-11 Marché | AC1, AC2 | verified | e2e : export de soja sans agrément refusé avec le décret ; 3 commandes simultanées sur 100 kg, une seule acceptée |
| F-11 | AC3 source du prix | verified | écran Marché |
| F-12 TDL | AC1 à AC4 | verified | e2e : 250 kg à 150 FCFA/100 kg = 375 FCFA ; paiement rejoué = même reçu ; reçu falsifié = `{ valid: false }` sans autre donnée ; encaissement rejoué stocké une fois |
| F-13 Lot | AC1 à AC3 | verified | e2e : page publique sans nom ni téléphone, coordonnées arrondies, poids négatif refusé |
| F-14 Tableau de bord | AC1 à AC6 | verified | e2e (périmètre commune, GDIZ) et capture à 360 px |
| F-15 PWA | AC1, AC3 | verified | build PWA ; 90 Ko compressés au premier chargement ; 10 écrans à 360 px sans débordement ni erreur console (Playwright) |
| F-15 | AC2 file hors ligne | partial | signalements, accusés et encaissements ; pas la création d'offre |

## Confiance

- **Preuve du rouge** : les 35 premiers tests métier ont échoué contre des fonctions vides (« not implemented ») avant l'implémentation. Un test passait déjà : son assertion `toThrow()` acceptait n'importe quelle erreur, elle a été resserrée. La limite de connexion et le voisinage des communes ont aussi été écrits test d'abord, puis vus rouges.
- **Tests écrits après le code** (les tests de bout en bout) : leur capacité à échouer a été prouvée en réintroduisant 7 failles. Deux tests passaient pour une mauvaise raison et ont été corrigés : le refus du rôle ADMIN (le champ était rejeté comme inconnu, pas comme interdit) et le reçu falsifié (la réponse invalide contenait encore le montant).
- **Scénarios de production couverts** : double soumission (PS-01), concurrence (PS-02), panne et réponse incohérente d'Open-Meteo (PS-03, PS-04), usurpation d'accès (PS-07), escalade de rôle (PS-09), fuseau UTC (PS-10), fichier déguisé (PS-15), montants entiers (PS-17), réponse rejouée (PS-19). Non couvert : le volume (PS-13) ; les relevés portent sur 77 communes et 46 jours, sans test de charge.
- **tamper_check** : 3 signalements, tous traités. Le test de santé supprimé a été réintégré, `role: any` a été typé, et le `eslint-disable` du seed est justifié (sortie console d'un script).
- **Défauts trouvés et corrigés pendant la livraison** :
  - l'inscription pouvait créer un administrateur ;
  - un rayon de voisinage de 40 km n'atteignait aucune commune au Nord ;
  - un PIN de 4 chiffres était devinable ;
  - un lecteur audio débordait à 360 px ;
  - le lot de démonstration dépendait des parcelles existantes ;
  - `docs_check` ignorait tout package nommé `reports` (bug corrigé dans l'outil Forge lui-même).

## Base de données

Schéma initial `20260926051316_init` (20 tables). Phase : pré-production. Une décision de modèle a été révisée pendant la livraison : le voisinage d'alerte (SPEC Q-01).

## Documentation

`docs/architecture/` : carte des 16 packages, diagrammes de classes (domain, alerts, reports, ussd, tax) et de séquence (boucle ravageur, USSD, reçu TDL), vérifiés par `docs_check`. `docs/KNOWN_ISSUES.md` : 15 entrées.

## Reste à faire

Brancher un fournisseur SMS, un code USSD et un paiement réels ; charger les barèmes communaux, les bulletins du SIM et la liste officielle d'homologation ; connexion par NPI et registre e-Agri via X-Road ; pilote dans un pôle pour mesurer l'effet réel.

## Ce qui n'est pas un problème

- Le score de mutation n'est pas de 100 % : sur les 20 mutants restants, la plupart sont équivalents (ils ne changent aucun résultat) ou ne touchent qu'un texte de message. Ils ont été lus un par un.
- Les « Fiche test » visibles sur la base locale viennent des tests de bout en bout ; la base de production n'est remplie que par le jeu de démonstration.
