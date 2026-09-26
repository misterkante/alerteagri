# Cahier des charges : plateforme nationale de soutien à la production agricole

Nom : **AlerteAgri**.
Contexte : challenge « Agriculture intelligente », ministère de la Transformation Digitale et de l'Innovation, Bénin. L'alignement avec le programme 2026-2033 est dans `CONTEXTE_POLITIQUE.md`.
Version 1.0, 2026-09-25. Livraison du MVP : 2026-09-26 avant 12 h.

---

## 1. Pourquoi cette plateforme

### 1.1 Le poids du secteur (sources en section 13)

| Indicateur | Valeur | Source |
|---|---|---|
| Part de l'agriculture dans le PIB (2025) | 25,4 % | La Nouvelle Tribune, sept. 2026 |
| Part dans les recettes d'exportation (2025) | 59,1 % | idem |
| Population active employée | près de 70 % | idem |
| Coton graine 2024-2025 | environ 637 000 t, 1er producteur d'Afrique de l'Ouest | Trésor, nov. 2025 |
| Soja 2024-2025 | environ 652 000 t attendues | idem |
| Anacarde 2024 | 212 000 à 225 000 t | idem |
| Céréales 2024-2025 | 2,91 Mt (+6,1 %) | DSA / MAEP |

### 1.2 Ce qui fait perdre de la valeur aujourd'hui

1. **Ravageurs détectés trop tard.** En 2022-2023, les jassides (*Amrasca biguttula*) ont causé 26 à 60 % de pertes sur le coton dans la région, soit 215 milliards FCFA pour les huit pays du PR-PICA. La chenille légionnaire d'automne menace le maïs chaque saison. Le Bénin dispose d'une plateforme géoréférencée de suivi et d'un lien vers FAMEWS (FAO), mais l'alerte reste un outil de brigade : elle ne revient pas jusqu'au producteur voisin.
2. **Semis mal calés sur les pluies.** Le démarrage des pluies va du 15 avril (extrême sud) au 9 mai (extrême nord). Le Nord n'a qu'une saison des pluies, le Sud en a deux. Un semis trop précoce suivi d'une poche sèche fait perdre la levée.
3. **Prix opaques et débouchés incertains.** Le producteur vend souvent sans connaître le prix de référence du marché, alors que le SIM agricole du MAEP publie des relevés réguliers. L'information existe, elle ne lui parvient pas.
4. **Une réglementation qui change et que le producteur n'apprend pas à temps.** Depuis le 1er avril 2024, l'exportation de soja grain et de noix brute de cajou est interdite, sauf agrément et autorisation du ministère du Commerce. L'exportation terrestre de ces produits et des intrants est interdite.
5. **Des recettes locales mal collectées.** La taxe de développement local (TDL) frappe les producteurs et les acheteurs en gros de produits agricoles. Son taux est fixé par chaque conseil communal. Elle est aujourd'hui collectée en espèces, sans traçabilité.

### 1.3 Ce qui rend la plateforme possible maintenant

| Levier | Donnée | Source |
|---|---|---|
| Téléphone | 10,33 millions d'abonnés uniques, pénétration de 78,1 % (fin 2025) | ARCEP / La Nation |
| Internet mobile | 8,59 millions d'abonnés uniques (64,9 %), 4G à 58 % | idem |
| Mobile money | 11,65 millions de comptes actifs, interopérabilité entre réseaux imposée par l'ARCEP depuis janvier 2025 | ARCEP |
| Identité | NPI unique (ANIP), déjà utilisé pour la connexion aux services publics | ANIP |
| Interopérabilité | bus X-Road de l'État (catalogue CatIS), où l'ATDA et l'ANIP sont déjà référencées | catis.xroad.bj |
| Existant agricole | e-Agri Bénin (PITN2R : registre et suivi des exploitations, 2 128 villages, 5 départements du Nord), acteur-agricole.bj, SIM agricole du MAEP | numerique.gouv.bj, gouv.bj |
| Climat | Météo-Bénin publie des prévisions saisonnières ; l'API Open-Meteo renvoie pluie, température, humidité et ET0 pour toute commune (testée sur Parakou le 2026-09-25) | meteobenin.bj, open-meteo.com |

### 1.4 La GDIZ change le problème de la vente

La zone industrielle de Glo-Djigbé (GDIZ), gérée par SIPI-Bénin, a une capacité installée de 120 000 t de cajou, 260 000 t de soja et 40 000 t de coton par an. Elle compte 20 unités opérationnelles et plus de 25 000 emplois en 2026.

Son cahier des charges officiel (article 6, « Marchés de terminaux ») prévoit :

- un marché terminal dans la zone, relié en étoile à des **centres de collecte à l'intérieur du pays** ;
- une plateforme commune et des enchères entre producteurs et industries ;
- l'obligation pour les usines de faire **transiter leurs demandes de matière première par ce marché**, « afin de permettre un contrôle de la traçabilité des produits ».

Le décret d'avril 2024 conditionne toute autorisation d'exporter soja et cajou à la « satisfaction effective des besoins des transformateurs locaux ».

Conséquence pour la plateforme : pour le soja, le cajou et le coton, **ne pas créer un marché concurrent**. Il faut équiper le premier kilomètre, du producteur au centre de collecte : volumes prévus, lots traçés depuis la parcelle, qualité. Les données alimentent le marché terminal. Le marché direct entre producteurs et acheteurs reste pertinent pour les cultures vivrières (maïs, manioc, tomate...).

### 1.5 La contrainte qui décide de tout

Le taux d'alphabétisation était de 38,4 % en 2015 (27,3 % chez les femmes). Le fon est parlé par 36 % de la population, le yoruba par 15 % et le bariba par environ 9 %. Une plateforme qui exige de lire le français exclut la majorité des exploitants. **L'inclusion n'est donc pas une option d'interface, c'est l'architecture** : chaque parcours du producteur doit fonctionner sans lire, sans smartphone et sans internet.

---

## 2. Vision

> Le producteur n'a pas à aller vers le numérique : le numérique vient à lui, sur le téléphone qu'il a déjà, dans sa langue, par la voix de son conseiller.

La plateforme n'est pas une application de plus. C'est **la couche de service qui relie ce que l'État possède déjà** aux 70 % d'actifs du secteur :

- l'identité (NPI) ;
- le registre (e-Agri) ;
- la météo (Météo-Bénin) ;
- les prix (SIM) ;
- la surveillance phytosanitaire (FAMEWS) ;
- le conseil agricole (ATDA) ;
- les paiements (mobile money interopérable).

Trois principes :

1. **Interopérer, ne pas dupliquer.** Chaque donnée a un propriétaire public ; la plateforme la consomme via X-Road et ne recrée pas de registre concurrent.
2. **Le conseiller agricole est le premier utilisateur.** Les agents de l'ATDA sont le canal humain qui porte la plateforme jusqu'au producteur non alphabétisé : ils enregistrent, signalent, et parlent sa langue.
3. **Chaque alerte doit fermer une boucle.** Un signalement devient une alerte, puis un conseil, puis une action, puis un résultat mesuré. Sinon ce n'est pas du monitoring.

---

## 3. Acteurs et canaux

| Acteur | Besoin principal | Canal |
|---|---|---|
| Producteur non alphabétisé, téléphone simple | recevoir les alertes, savoir quand semer, vendre au bon prix | USSD, SMS, message vocal ; via le conseiller |
| Producteur alphabétisé, smartphone | idem, plus le suivi de ses parcelles et de ses ventes | application web progressive (PWA), hors ligne |
| Conseiller agricole (ATDA) | enregistrer et accompagner les producteurs, signaler, diffuser | PWA hors ligne, tablette ou smartphone |
| Coopérative / union | vendre groupé, suivre les membres | PWA |
| Acheteur (local, transformateur, exportateur) | trouver l'offre, acheter, être conforme | PWA, web |
| Commune (receveur) | collecter la TDL, suivre les recettes | web, collecte sur mobile |
| ATDA / MAEP / DPV (protection des végétaux) | carte des alertes, pilotage, publication de contenus | tableau de bord web, CMS |
| Administrateur plateforme | comptes, rôles, paramètres, audit | back-office |

---

## 4. Périmètre fonctionnel

Priorité : **M** = MVP livré le 2026-09-26 ; **V2** = feuille de route.
Chaque exigence porte un identifiant repris dans `docs/SPEC.md` (pipeline Forge).

### 4.1 Décider : monitoring et alerte précoce (cœur du MVP)

| Id | Exigence | Prio |
|---|---|---|
| MON-01 | Relevé météo quotidien réel pour chacune des 77 communes (pluie, T max, humidité, ET0) via Open-Meteo, historisé | M |
| MON-02 | Règles d'alerte climat paramétrables par l'ATDA : forte pluie, poche sèche pendant la fenêtre de semis, chaleur, humidité favorable aux maladies | M |
| MON-03 | Conseil de semis par commune et par culture : détection du démarrage effectif des pluies selon le critère agronomique de Sivakumar (1988) : au moins 20 mm en 3 jours consécutifs, puis aucune poche sèche de 7 jours dans les 30 jours suivants. Comme les 30 jours ne sont pas encore observés au moment de semer, la plateforme vérifie la prévision disponible (16 jours) et l'annonce explicitement. Affichage : « semez » ou « attendez », avec la raison | M |
| MON-04 | Signalement phytosanitaire en 30 secondes : culture, symptôme choisi sur pictogrammes (feuilles trouées, chenilles, jaunissement...), photo facultative, position ou commune ; possible par USSD et par un conseiller pour le compte d'un producteur | M |
| MON-05 | Agrégation des signalements par commune et fenêtre de 7 jours ; au-delà du seuil fixé par l'ATDA, alerte automatique aux producteurs de la commune et des communes voisines | M |
| MON-06 | Validation par un agent : un signalement non validé est affiché « à confirmer », jamais comme une alerte officielle | M |
| MON-07 | Chaque alerte ferme la boucle : message envoyé, conseil lié (fiche de lutte), accusé de lecture, action déclarée, statut clos | M |
| MON-08 | Tableau de bord national et par pôle (PDA 1 à 7) : carte des signalements et alertes, courbes météo, délai entre signalement et alerte | M |
| MON-09 | Export compatible FAMEWS des signalements de chenille légionnaire | V2 |
| MON-10 | Prévisions saisonnières Météo-Bénin intégrées au conseil de semis | V2 |
| MON-11 | Identification assistée par photo (modèle de vision) | V2 |

### 4.2 Planifier semis et récolte

| Id | Exigence | Prio |
|---|---|---|
| PLN-01 | Calendrier cultural par culture et par zone (Nord : une saison ; Sud : deux saisons), éditable dans le CMS | M |
| PLN-02 | Pour une parcelle déclarée (culture, date de semis), prochaines étapes et date de récolte estimée | M |
| PLN-03 | Rappels par SMS ou voix aux étapes clés | V2 |
| PLN-04 | Estimation de rendement à partir du cumul pluie/ET0 | V2 |

### 4.3 Vendre

| Id | Exigence | Prio |
|---|---|---|
| VEN-01 | Publier une offre (produit, quantité, prix, commune) depuis la PWA ou l'USSD | M |
| VEN-02 | Prix de référence par produit et par marché, source affichée (SIM agricole ou relevé plateforme) | M |
| VEN-03 | Commande, puis paiement mobile money (MTN, Moov, Celtiis) via un agrégateur agréé (FedaPay ou KkiaPay) ; en mode démo, un fournisseur simulé clairement signalé | M |
| VEN-04 | **Conformité intégrée** : une offre à l'export de soja grain ou de noix brute de cajou est bloquée sans numéro d'agrément, avec l'explication de la règle | M |
| VEN-05 | Vente groupée coopérative (lot agrégé de plusieurs membres) | V2 |
| VEN-06 | Vitrine export CEDEAO/ZLECAf : fiches produits, normes, documents requis | V2 |

### 4.4 bis Différenciateurs : trois problèmes que la fiche ne cite pas

| Id | Exigence | Prio |
|---|---|---|
| DIF-01 | **Aflatoxines post-récolte** : à partir de la date de récolte déclarée et de la prévision d'humidité et de pluie, conseil « séchez maintenant / couvrez / ne stockez pas encore » pour le maïs et l'arachide ; alerte envoyée comme une alerte climat | M |
| DIF-02 | **Vérification des intrants** : le nom d'un pesticide (tapé, ou dicté au conseiller) donne « homologué » ou « non homologué », avec l'alternative homologuée de la fiche de lutte ; disponible par USSD et SMS. Liste gérée dans le CMS, extrait de démo sourcé (dont SNIPER, retiré du marché en juillet 2026) | M |
| DIF-03 | **Lot traçable de la parcelle au centre de collecte** : parcelle géolocalisée (point GPS, contour en V2) par le conseiller ; chaque livraison crée un lot avec un QR code (producteur, commune, parcelle, date de récolte, humidité déclarée, conformité export), sous un format prêt pour le règlement européen anti-déforestation (EUDR, soja et huile de palme, applicable le 30 décembre 2026) | M |
| DIF-04 | **Offre face aux besoins industriels** : production attendue par filière et par commune (parcelles déclarées x rendement de référence), comparée aux capacités de transformation de la GDIZ ; c'est l'indicateur qui éclaire les autorisations d'export prévues par le décret de 2024 | M |
| DIF-05 | **Valeur protégée** : pour chaque alerte active, surfaces exposées et valeur estimée en FCFA (marquée « estimation ») | M |
| DIF-06 | Connecteur vers la plateforme du marché terminal SIPI-Bénin (lots, volumes, qualité) ; adaptateur simulé dans le MVP | V2 |

### 4.4 Recettes de l'État

| Id | Exigence | Prio |
|---|---|---|
| REC-01 | Barème TDL par commune et par produit, saisi par la commune (le taux est fixé par le conseil communal ; données de démo marquées « fictives ») | M |
| REC-02 | Sur une vente conclue via la plateforme, TDL calculée, affichée et payable en mobile money ; reçu numérique avec QR code vérifiable | M |
| REC-03 | Collecte terrain : un collecteur communal enregistre un paiement sur un marché, même hors ligne, avec synchronisation ensuite | M |
| REC-04 | Tableau de bord des recettes par commune, produit et période ; piste d'audit non modifiable | M |
| REC-05 | Reversement automatique et rapprochement avec le Trésor | V2 |

### 4.5 S'informer sur la réglementation

| Id | Exigence | Prio |
|---|---|---|
| REG-01 | Bibliothèque de fiches courtes : exportation soja et cajou, TDL, pesticides homologués, normes de qualité ; chaque fiche a un texte simple, des pictogrammes, **un audio par langue** et la référence officielle | M |
| REG-02 | Fiches envoyées par SMS ou lues au téléphone depuis l'USSD | M |
| REG-03 | Alerte réglementaire : une nouvelle règle publiée notifie les acteurs de la filière concernée | V2 |

### 4.6 Gestion de contenu (CMS)

| Id | Exigence | Prio |
|---|---|---|
| CMS-01 | Rôles éditeur (ATDA, DPV, commune) et validateur ; brouillon, puis publication, avec historique | M |
| CMS-02 | Contenus : fiches de lutte, fiches réglementaires, calendriers culturaux, barèmes TDL, seuils d'alerte | M |
| CMS-03 | **Audio par langue** : un conseiller enregistre la fiche en fon, yoruba, bariba ou dendi depuis son téléphone et l'attache au contenu | M |
| CMS-05 | Voix de secours quand aucun enregistrement n'existe : branchement du modèle vocal fon de l'ASIN et de l'IIDIA dès qu'il est exposé (bien public numérique de l'État) ; en attendant, Meta MMS-TTS (fon, yoruba, bariba, dendi) en essai, sous réserve de sa licence non commerciale (CC-BY-NC). Toujours marqué « voix synthétique » et relu par un locuteur avant diffusion | V2 |
| CMS-04 | Médias compressés à l'envoi (images au format WebP, audio en Opus basse qualité) pour la faible connectivité | M |

---

## 5. Inclusion et faible connectivité (exigences non négociables)

1. **Aucun parcours producteur ne dépend de la lecture.** Chaque action a un pictogramme, une couleur et un audio. Les chiffres sont affichés en grand, les unités parlées.
2. **Trois canaux pour un même service** :
   - PWA hors ligne ;
   - USSD (menu de 5 entrées maximum, 3 niveaux maximum) ;
   - SMS ou voix sortants.
   La logique métier est unique ; seul l'affichage change.
3. **Le conseiller comme interface humaine** : toute action du producteur peut être faite par un conseiller en son nom, tracée comme telle.
4. **Hors ligne d'abord** : la PWA fonctionne sans réseau (données en cache, file d'envoi synchronisée au retour du réseau, conflits résolus côté serveur).
5. **Budget de poids** : première page sous 200 Ko transférés ; pages suivantes sous 50 Ko ; testée en 3G lente simulée.
6. **Langues** : interface en français, audio en fon, yoruba, bariba et dendi, enregistré par des locuteurs via le CMS. Aucune traduction automatique non relue n'est publiée.
7. **Accessibilité** : contrastes WCAG AA, zones tactiles de 48 px minimum, utilisable à une main sur un écran de 360 px.

---

## 6. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Identité | Connexion par numéro de téléphone et code à usage unique pour le MVP ; connexion par NPI (ANIP via X-Road) en V2 |
| Données personnelles | Conformité au Code du numérique (loi 2017-20, livre 5) : minimisation, finalités déclarées, consentement, droit d'accès ; déclaration à l'APDP avant la mise en production |
| Hébergement | Démo sur un cloud ; production selon la politique nationale de classification des données en cours d'élaboration, avec hébergement national pour les données sensibles |
| Sécurité | Rôles et contrôle d'accès côté serveur sur chaque ressource, limitation de débit, journal d'audit des actions sensibles (alertes officielles, barèmes, encaissements) ; pentest de chaque grosse fonctionnalité (Forge `pentest-gate`) |
| Interopérabilité | API REST documentée (OpenAPI), adaptateurs par source externe derrière une interface ; chaque adaptateur a un mode simulé explicite |
| Disponibilité | L'alerte doit partir même si un fournisseur SMS tombe : bascule sur un second fournisseur, file de réessai |
| Traçabilité | Chaque chiffre affiché indique sa source et sa date |
| Qualité | Pipeline Forge : tests écrits avant le code, mutation, tamper check, UML à jour, KNOWN_ISSUES, rapport de livraison |

---

## 7. Architecture

```
            USSD / SMS / voix           PWA hors ligne            Tableau de bord + CMS
         (agrégateur opérateurs)   (producteur, conseiller)     (ATDA, MAEP, communes)
                    \                       |                          /
                     +----------- API NestJS (OpenAPI) ---------------+
                     |  auth | parcelles | monitoring | alertes | marché
                     |  paiements | recettes | réglementation | cms | audit
                     +-------------------------------------------------+
                          |                 |                  |
                     PostgreSQL        tâches planifiées    adaptateurs externes
                     (Prisma)          (relevé météo,       Open-Meteo, Météo-Bénin,
                                        règles d'alerte,    SIM agricole, FAMEWS,
                                        envois)             FedaPay/KkiaPay, SMS,
                                                            X-Road : NPI, e-Agri
```

- **Stack** : NestJS 11, Prisma, PostgreSQL, React (Vite) en PWA, Tailwind ; frontend sur Vercel, API et base sur Render.
- **Monolithe modulaire** : un module par domaine, avec des frontières documentées dans `docs/architecture/` (diagrammes de classes et de séquence tenus à jour par Forge).
- **Règles d'alerte en données, pas en code** : seuils et fenêtres éditables par l'ATDA dans le CMS.

---

## 8. Données

| Donnée | Source MVP | Statut dans la démo |
|---|---|---|
| 77 communes, départements, pôles PDA, coordonnées | référentiel administratif | réel |
| Météo quotidienne | API Open-Meteo | réel |
| Calendriers culturaux | Météo-Bénin et PNUD (dates de démarrage des pluies), publications INRAB | réel, simplifié |
| Fiches réglementaires export | décret et communiqués des Douanes (avril 2024) | réel |
| Barèmes TDL | fixés par commune | **fictif**, marqué comme tel |
| Prix de référence | bulletins du SIM agricole (MAEP) | réel si repris d'un bulletin publié, sinon fictif marqué |
| Producteurs, parcelles, signalements, ventes | jeu de démonstration | **fictif**, marqué comme tel |

Règle : aucune donnée fictive n'est présentée comme réelle. Un badge « démo » l'indique dans l'interface.

---

## 9. Critères d'acceptation du MVP (démo du 2026-09-26)

Chacun est vérifié par un test automatisé ou une étape de démo rejouable :

1. **Climat, de bout en bout** : le relevé réel d'une commune dépasse un seuil. L'alerte est générée, envoyée (SMS simulé visible dans une boîte d'envoi de démo) et affichée dans la PWA avec l'audio. Le producteur accuse réception, et le tableau de bord montre la boucle fermée et son délai.
2. **Ravageur, de bout en bout** : trois signalements de chenille légionnaire dans une commune en 7 jours, dont un fait par USSD. Un agent valide, l'alerte part aux communes voisines, et la carte se met à jour.
3. **Semis** : pour une commune du Nord et une du Sud, la plateforme dit « semez » ou « attendez » selon la pluie réelle des 20 derniers jours, avec son explication.
4. **Vente et recette** : une offre de maïs est publiée, commandée et payée (fournisseur simulé). La TDL est calculée, le reçu QR est vérifiable, et la recette apparaît au tableau de bord de la commune.
5. **Conformité** : une offre d'export de soja grain sans agrément est bloquée, avec l'explication.
6. **Réglementation** : une fiche est publiée dans le CMS avec un audio enregistré, et consultée depuis la PWA hors ligne.
7. **Différenciateurs** :
   - une récolte de maïs déclarée sous une prévision humide déclenche le conseil anti-aflatoxines ;
   - « SNIPER » tapé dans l'USSD répond « non homologué » avec l'alternative ;
   - une livraison de soja crée un lot QR dont la page publique affiche la parcelle géolocalisée ;
   - le tableau « offre face aux besoins GDIZ » affiche l'écart par filière.
8. **Faible connectivité** : parcours producteur en 3G lente simulée et en mode avion (signalement mis en file, puis envoyé au retour du réseau).
9. **Qualité** : suite de tests verte au code de sortie, rapport Forge `docs/REPORT.md`, `docs_check` et `tamper_check` propres, KNOWN_ISSUES publié.

---

## 10. Livrables

| Livrable | Contenu |
|---|---|
| Dépôt GitHub | code complet, README produit (FR), README techniques, `docs/` Forge (SPEC, architecture UML, KNOWN_ISSUES, REPORT, sécurité) |
| Plateforme déployée | URL publique ; comptes de démo par rôle ; numéro USSD simulé par une page web |
| Démo | script de 7 minutes rejouable (section 9), jeu de données réinitialisable |
| Présentation | vision pour le pays, problème chiffré, démonstration, architecture et interopérabilité, feuille de route, indicateurs d'impact |

---

## 11. Plan de réalisation (livraison le 2026-09-26 à 12 h)

| Créneau | Travail |
|---|---|
| J0 soir | Cadrage, SPEC Forge validé ; nouveau dépôt initialisé ; schéma de données ; référentiel des 77 communes |
| J0 nuit | MON-01 à MON-07 (relevé, règles, signalement, agrégation, alerte, boucle) ; USSD de signalement |
| J1 matin | CMS avec audio, fiches réglementaires, TDL avec reçu QR, blocage export ; tableau de bord et carte |
| J1 9 h à 11 h | Déploiement, données de démo, test en 3G lente, pentest léger, rapport Forge |
| J1 11 h à 12 h | Répétition de la démo, finalisation de la présentation |

Arbitrage si le temps manque, dans cet ordre : V2 d'abord, puis la carte (remplacée par un tableau), puis le paiement réel (simulé). Jamais la boucle d'alerte, jamais l'inclusion.

---

## 12. Feuille de route et indicateurs d'impact

| Horizon | Étape |
|---|---|
| 0 à 3 mois | Pilote dans un pôle (PDA 2 ou 4, zone PITN2R déjà couverte) avec les conseillers ATDA ; branchement réel SMS/USSD et paiement ; déclaration APDP |
| 3 à 12 mois | Connexion NPI et e-Agri via X-Road ; export FAMEWS ; prévisions saisonnières Météo-Bénin ; TDL numérique dans les premières communes volontaires |
| 12 à 24 mois | Couverture des 7 pôles ; vitrine export CEDEAO ; ouverture aux pays voisins (réseau régional des SIM, commerce avec le Nigeria, premier client agricole régional) |

Indicateurs suivis dès le pilote :

- délai entre le premier signalement et l'alerte ;
- part des alertes dont la boucle est fermée ;
- producteurs actifs par canal, dont la part de non-smartphones ;
- écart du prix obtenu par rapport au prix de référence ;
- TDL collectée numériquement par rapport à l'année précédente ;
- surfaces semées dans la fenêtre recommandée.

---

## 13. Sources consultées (2026-09-25)

- Poids du secteur : [La Nouvelle Tribune, agriculture 25,4 % du PIB](https://lanouvelletribune.info/2026/09/benin-lagriculture-pese-254-du-pib-et-591-des-recettes-dexportation-en-2025/) ; [DG Trésor, agriculture et politique agricole](https://www.tresor.economie.gouv.fr/Articles/2025/11/03/benin-agriculture-et-politique-agricole) ; [DSA / MAEP](https://apidsa.agriculture.gouv.bj/public/storage/uploads/Ss53O88VFEgc4eIg17noMwacH274KQcylgOZlSZJ.pdf)
- Télécoms et mobile money : [La Nation, télécommunications](https://lanation.bj/numerique/telecommunications-au-benin-legere-baisse-des-sim-mais-forte-progression-des-usages) ; [ARCEP, interconnexion mobile money](https://arcep.bj/interconnexion-des-plateformes-mobile-money-aux-reseaux-des-operateurs-mobiles/) ; [ARCEP, observatoire internet T3 2025](https://arcep.bj/wp-content/uploads/2025/12/Observatoire_Internet_T3_2025_TaB.pdf)
- Ravageurs : [FAO Bénin, FAMEWS](http://www.fao.org/benin/actualites/detail-events/fr/c/1234214/) ; [OMC, infestations de jassides](https://www.wto.org/english/tratop_e/agric_e/dg_cons_170523_ben_e.pdf) ; [La Nation, jassides](https://lanation.bj/international/lutte-contre-les-ravages-du-jasside-en-afrique-lomc-et-la-fao-au-chevet-du-coton-africain)
- Climat : [PNUD, dates des saisons pluvieuses](https://www.undp.org/fr/benin/connaissance-des-dates-predeterminees-des-saisons-pluvieuses-au-benin) ; [Météo-Bénin, prévisions saisonnières](https://www.meteobenin.bj/produits/previsions-saisonieres/previsions-saisonnieres-de-la-grande-saison-des-pluies-au-sud-du-pays/) ; [Open-Meteo](https://open-meteo.com/)
- Réglementation : [Douanes, interdiction de l'exportation terrestre](https://douanes.gouv.bj/interdiction-formelle-de-lexportation-par-voie-terrestre-des-noix-de-cajou-du-soja-et-des-intrants-agricoles-lessentiel-dans-ce-communique-du-directeur-general-des-douanes/) ; [Agence Ecofin, soja](https://www.agenceecofin.com/oleagineux/1310-101984-benin-l-exportation-de-soja-grain-sera-interdite-a-partir-du-1er-avril-2024) ; [TDL](https://benin.fm/formalite/taxe-de-developpement-local/) ; [Code général des impôts 2024](https://api.impots.bj/media/65d5ae32a155a_B%C3%A9nin-Code%20G%C3%A9n%C3%A9ral%20des%20Imp%C3%B4ts%202024.pdf)
- Existant numérique de l'État : [numerique.gouv.bj, e-agriculture](https://numerique.gouv.bj/publications/actualites/e-agriculture-au-benin-deux-plateformes-numeriques-mises-a-la-disposition-des-acteurs-du-systeme-agricole) ; [gouv.bj, lancement du PITN2R](https://www.gouv.bj/actualite/1081/promotion-usages-numeriques-dans-regions-rurales-pitn2r-officiellement-lance/) ; [e-Agri Bénin](https://play.google.com/store/apps/details?id=bj.gouv.eagri&hl=fr) ; [CatIS X-Road, ATDA](https://catis.xroad.bj/institutions/IN00171) ; [ANIP](https://anip.bj/)
- Territoire : [7 pôles de développement agricole](https://agri-impact.bj/2023/03/09/modernisation-du-secteur-agricole-au-benin-7-poles-institues-pour-booster-le-rendement-des-producteurs/)
- Prix : [SIM agricole, état des lieux](https://maepwebdocu.gouv.bj/pdf/archives/proacpa/Rapport%20final_Etat%20des%20lieux%20des%20SIM%20existant%20au%20niveau%20local%20et%20r%C3%A9gional.pdf) ; [La Nouvelle Tribune, prix d'août 2026](https://lanouvelletribune.info/2026/09/benin-mais-riz-et-tomate-moins-chers-sur-les-marches-en-aout-2026/)
- Langues et alphabétisation : [ODSEF, langues au Bénin](https://www.odsef.fss.ulaval.ca/sites/odsef.fss.ulaval.ca/files/odsef_assani_web.pdf) ; [IndexMundi](https://www.indexmundi.com/fr/benin/taux_d_alphabetisation.html)
- Données personnelles : [Code du numérique, loi 2017-20](https://www.afapdp.org/wp-content/uploads/2018/06/Benin-Loi-2017-20-Portant-code-du-numerique-en-Republique-du-Benin.pdf) ; [CIO Mag, souveraineté et cloud](https://cio-mag.com/souverainete-et-cloud-le-benin-face-aux-enjeux-de-lhebergement-des-donnees/)
- Paiements : [KkiaPay, paiement USSD](https://kkiapay.me/paiement-ussd-encaisser-client/) ; [agrégateurs en Afrique de l'Ouest](https://www.pirabellabs.com/blog/paiement-en-ligne-mobile-money-afrique-ouest-2026)
- Sous-région : [Agence Ecofin, échanges agricoles Bénin-Nigeria](https://www.agenceecofin.com/actualites/2606-129566-benin-nigeria-3-choses-a-savoir-sur-la-dynamique-des-echanges-agricoles) ; [CEDEAO, Sèmè-Kraké](https://www.ecowas.int/la-cedeao-renforce-les-operations-au-poste-frontiere-conjoint-de-seme-krake-entre-le-nigeria-et-le-benin/?lang=fr)

- GDIZ : [Cahier des charges de la ZES de Glo-Djigbé, article 6 « Marchés de terminaux »](https://gdiz-benin.com/wp-content/uploads/2024/08/Cahier-de-Charges_GDIZ-Framework-FR.pdf) ; [La Nouvelle Tribune, 40 investisseurs et 20 unités en 2026](https://lanouvelletribune.info/2026/09/benin-40-investisseurs-et-20-unites-operationnelles-a-la-gdiz-en-2026/) ; [Nasuba, capacités et emplois](https://www.nasuba.info/economie/gdiz-plus-de-25-000-emplois-crees-et-20-unites-industrielles-desormais-operationnelles/) ; [Banouto, capacité soja](https://www.banouto.bj/economie/article/20231201-soja-du-benin-la-gdiz-bientot-capable-de-transformer-600-000-tonnes)
- Intrants : [Inter-réseaux, pesticides non homologués dans la basse vallée de l'Ouémé](https://www.inter-reseaux.org/ressource/pesticides-chimiques-de-synthese-non-homologues-en-agriculture-dans-la-basse-vallee-de-loueme-au-benin-constats-et-regards-croises-des-acteurs/) ; [Banouto, SNIPER interdit (juillet 2026)](https://www.banouto.bj/bien-etre/article/20260702-benin-sniper-et-dautres-pesticides-non-homologues-interdits-de-vente)
- Aflatoxines : [SciDev, mycotoxines au Bénin](https://www.scidev.net/afrique-sub-saharienne/news/le-benin-face-aux-mefaits-dune-forte-contamination-aux-mycotoxines/) ; [ReliefWeb, aflatoxines et commerce](https://reliefweb.int/report/world/les-aflatoxines-minent-la-sant-et-le-commerce-dans-la-partie-subsaharienne)
- EUDR : [Conseil de l'UE, révision et report (décembre 2025)](https://www.consilium.europa.eu/en/press/press-releases/2025/12/18/deforestation-council-signs-off-targeted-revision-to-simplify-and-postpone-the-regulation/)

Points non vérifiés, à ne pas affirmer en présentation sans source :

- le contenu exact de l'application e-Agri (la page du store n'a pas pu être lue) ;
- les taux de TDL réellement appliqués par commune ;
- le taux d'alphabétisation après 2015 ;
- le fonctionnement réel du marché terminal SIPI-Bénin : les centres de collecte actifs, et si les enchères sont en ligne ou physiques. Le cahier des charges décrit le dispositif, pas son état d'avancement, et l'entretien du DG de SIPI-Bénin (Agence Ecofin) n'a pas pu être lu ;
- le taux d'application de l'EUDR aux produits transformés du soja béninois (tourteau, huile) selon les destinations réelles.
