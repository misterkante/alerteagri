# Démonstration (10 minutes)

Avant de commencer, 5 minutes avant la démo :

1. Ouvrez l'API une fois pour la réveiller (hébergement gratuit) : `<API>/health`.
2. Connectez-vous en agent (+22990000002) et cliquez sur **Relever la météo**, puis **Appliquer les règles**.
3. Ouvrez deux onglets : le producteur (+22997000001, PIN 1234) et l'agent.

## 1. Le producteur qui ne lit pas (1 min 30)

- Onglet producteur : l'accueil n'est fait que de pictogrammes.
- **Semer maintenant ?** Le résultat est lu à voix haute. Montrez Bohicon (Sud, petite saison) puis Parakou (Nord, hors saison) : le conseil dépend de la pluie **réellement tombée** et suit le critère agronomique de Sivakumar. Le graphique distingue la pluie mesurée et la pluie prévue.
- **Fiches et règles** : « Écouter en français », puis l'audio enregistré en fon.

## 2. Sans smartphone, sans internet (1 min)

- **Téléphone USSD** : Composer, puis `3`, puis `SNIPER` : « SNIPER n'est pas homologué ». C'est le vrai contrôleur USSD ; seul le code court opérateur est simulé.
- Passez le navigateur en mode avion, faites un signalement : il est mis en attente, puis part tout seul au retour du réseau.

## 3. La boucle d'alerte complète (2 min)

- Producteur : **Signaler un ravageur**, puis Maïs, puis Feuilles trouées. Faites-en 3 (ou utilisez ceux déjà présents).
- Agent : **Signalements à vérifier**, puis Valider les 3. Au troisième, l'alerte « chenille légionnaire » part vers Parakou et ses communes voisines (Tchaourou, N'Dali...).
- Montrez **SMS envoyés** et la carte : les points passent au rouge.
- Producteur : **Mes alertes**, puis « J'ai lu », puis « J'ai agi ».
- Agent : dans le tableau, la boucle montre envoyés, lus, actions et délais. Clôturez l'alerte.

## 4. L'État et la sous-région (1 min 30)

- **Valeur protégée** : l'estimation en FCFA de ce que l'alerte protège.
- **Offre face aux usines de la GDIZ** : la donnée qui éclaire les autorisations d'export prévues par le décret de 2024.
- Acheteur (+22996000001) : **Marché**, puis Réserver, puis Payer. La TDL est calculée et le reçu porte un QR. Scannez-le : « Reçu authentique ». Modifiez un caractère de l'adresse : « Reçu invalide ».
- Page publique du lot : `/lot/LOT-DEMO0001`. On y voit l'origine, la conformité export et la géolocalisation pour l'EUDR, mais jamais le nom du producteur.
- Producteur : essayez de publier du soja à l'export sans agrément. C'est refusé, avec le texte du décret.

## 5. Le suivi de campagne (2 min)

- Conseillère (+22990000004) : **Parcelles**. Nouvelle parcelle : producteur, culture, surface, date de semis et bouton « position » (le GPS du téléphone). Les étapes de culture sont calculées, et chaque étape due part par SMS une seule fois.
- Ouvrez **Suivi de culture** : le stress hydrique (pluie moins évapotranspiration depuis le semis, données réelles de la commune).
- **Enregistrer une livraison** : le lot reçoit un QR, et sa page publique est prête pour l'EUDR.
- **Vente groupée** : les quantités de trois producteurs forment une seule offre.
- Agent : onglet **Règles et calendriers**, pour changer un seuil sans développeur. Onglet **Sécheresse** : l'indice qui déclencherait une assurance indicielle (simulation). Onglet **Interopérabilité** : export FAMEWS pour la FAO et envoi des lots au marché terminal SIPI (adaptateur simulé).
- Agent : **Contenus**, puis publier une règle ciblée « soja » : les producteurs de soja reçoivent un SMS.
- Commune (+22990000003) : **Recettes**, puis **Rapprochement**. Chaque reçu est revérifié par sa signature, avec un export CSV pour le receveur.

## 5. Ce qui rend le code auditable (1 min)

- `docs/architecture/` : carte des packages et diagrammes de séquence.
- `docs/KNOWN_ISSUES.md` : ce qui est simulé, dit franchement.
- `docs/REPORT.md` et `docs/security/pentest-2026-09-26.md` : 115 tests, dont 53 sur la vraie base ; des failles réintroduites volontairement pour vérifier que les tests les détectent ; un pentest de l'API en ligne.
