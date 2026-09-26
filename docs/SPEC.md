# Spécification AlerteAgri

Source : `docs/CAHIER_DES_CHARGES.md` v1.0 (2026-09-25).
Dernière modification : 2026-09-26. Approuvé par le porteur le 2026-09-26 (périmètre, défauts Q-01 à Q-07).
Échéance : livraison déployée le 2026-09-26 avant 12 h.

## Features

Ordre de construction = ordre du tableau. En cas de manque de temps, on coupe par le bas, mais jamais F-01 à F-06.

| Id | Feature | Dépend de | Statut |
|---|---|---|---|
| F-01 | Référentiel (77 communes, pôles PDA, cultures) et rôles | | approved |
| F-02 | Relevé météo quotidien réel par commune | F-01 | approved |
| F-03 | Règles d'alerte climat, génération d'alertes | F-02 | approved |
| F-04 | Diffusion des alertes et boucle fermée | F-03 | approved |
| F-05 | Conseil de semis (critère de Sivakumar) | F-02 | approved |
| F-06 | Signalement ravageur, validation, alerte aux communes voisines | F-01, F-04 | approved |
| F-07 | Conseil post-récolte contre les aflatoxines | F-02, F-04 | approved |
| F-08 | CMS : fiches, audio, calendriers, seuils, barèmes | F-01 | approved |
| F-09 | Vérification d'un intrant (homologué ou non) | F-08 | approved |
| F-10 | Canal USSD simulé (signaler, conseil de semis, vérifier un intrant, prix) | F-05, F-06, F-09 | approved |
| F-11 | Connecteur marché : offres, prix de référence, blocage des exports interdits | F-01 | approved |
| F-12 | TDL : calcul, paiement simulé, reçu QR vérifiable | F-11 | approved |
| F-13 | Lot traçable avec QR, de la parcelle au centre de collecte | F-01 | approved |
| F-14 | Tableau de bord : carte, boucles, valeur protégée, offre face à la GDIZ, recettes | F-04, F-06, F-12, F-13 | approved |
| F-15 | PWA hors ligne et budget de poids | toutes | approved |

## Questions ouvertes

Chaque question a une réponse par défaut. Sans avis contraire, c'est elle qui s'applique.

| Id | Question | Défaut proposé |
|---|---|---|
| Q-01 | Communes « voisines » : l'adjacence administrative réelle n'est pas disponible en source ouverte fiable | communes dont le centre est à moins de 40 km |
| Q-02 | Connexion pour le MVP | téléphone + PIN ; code à usage unique par SMS en V2 |
| Q-03 | SMS, USSD et paiement réels | USSD par un téléphone simulé dans l'application, qui appelle le vrai contrôleur USSD (protocole standard session/texte, réponses CON/END, compatible agrégateur) ; SMS dans une boîte d'envoi interne ; paiement simulé ; tous marqués « démo ». Branchement réel (agrégateur local, MADAPI de MTN, code court ARCEP) en V2 |
| Q-04 | Barèmes TDL | fictifs, marqués « fictif » |
| Q-05 | Liste des intrants homologués | extrait de démo : SNIPER « non homologué » (source Banouto, juillet 2026), le reste marqué « exemple » |
| Q-06 | Audios en langues locales | 2 ou 3 fichiers de démo, enregistrés par vous ou un proche ; sinon, un emplacement « audio à enregistrer » clairement vide |
| Q-07 | Relevé météo | Open-Meteo toutes les 6 h pour les 77 communes, plus un bouton « relever maintenant » pour la démo |

## Détail des features

### F-01 Référentiel et rôles
Acteurs : tous.
Acceptance :
  AC1 les 77 communes sont chargées avec leur département, leur pôle PDA et des coordonnées (latitude, longitude) ; le seed est idempotent
  AC2 les rôles PRODUCER, BUYER, ADVISOR (conseiller), AGENT (ATDA/DPV), COMMUNE, ADMIN existent ; chaque route refuse un rôle non autorisé (403)
  AC3 un conseiller peut créer un producteur et agir en son nom ; chaque action porte `actingForId` et apparaît dans le journal d'audit
  AC4 (négatif) un producteur ne peut pas agir au nom d'un autre : 403
Scénarios : PS-07, PS-09
Données : User gagne ADVISOR, AGENT, COMMUNE, ADMIN ; nouvelles tables Commune, Crop, AuditLog ; User.commune devient une clé étrangère vers Commune
Statut : approved

### F-02 Relevé météo
Acceptance :
  AC1 un relevé récupère, pour chaque commune, la pluie, la température maximale, l'humidité et l'ET0 des jours passés et prévus, et les enregistre (une ligne par commune et par jour, sans doublon)
  AC2 si Open-Meteo échoue ou dépasse le délai, le relevé s'arrête proprement, journalise l'erreur et conserve les données précédentes ; l'interface affiche la date du dernier relevé réussi
  AC3 chaque valeur affichée montre sa source et sa date
Scénarios : PS-03, PS-04, PS-10
Données : WeatherDaily (communeId, date, rain, tmax, humidity, et0, isForecast, fetchedAt), unique sur (communeId, date)
Statut : approved

### F-03 Règles d'alerte climat
Acceptance :
  AC1 les règles (forte pluie, poche sèche en fenêtre de semis, chaleur, humidité favorable aux maladies) sont des données éditables par un AGENT, avec seuils et fenêtres
  AC2 l'évaluation des règles sur les relevés crée une alerte par commune, règle et période, sans doublon si elle est relancée
  AC3 une alerte climat est « officielle » par construction ; elle indique la règle, la valeur mesurée et le seuil
  AC4 (négatif) une règle aux seuils incohérents (min > max, fenêtre négative) est refusée (400)
Scénarios : PS-01 (réévaluation idempotente)
Données : AlertRule, Alert (type, communeId, ruleId, measured, threshold, status, createdAt)
Statut : approved

### F-04 Diffusion et boucle fermée
Acceptance :
  AC1 une alerte validée envoie un message à chaque producteur de la commune (et des communes voisines si la règle le demande), via la boîte d'envoi SMS interne (visible dans la démo, derrière une interface de fournisseur remplaçable) ; chaque message est une ligne avec son statut
  AC2 le producteur accuse réception (application, ou « 1 » par USSD) ; l'alerte garde les compteurs envoyés, lus et actions déclarées
  AC3 un agent clôt l'alerte ; la boucle affiche le délai premier signal, alerte, puis clôture
  AC4 si l'envoi échoue, il est retenté (3 fois, avec délai croissant) puis marqué en échec, sans bloquer les autres envois
Scénarios : PS-01, PS-04, PS-19
Données : Notification (alertId, userId, channel, status, sentAt, readAt, action)
Statut : approved

### F-05 Conseil de semis
Acceptance :
  AC1 pour une commune et une culture : « semez » seulement si le démarrage est détecté (au moins 20 mm en 3 jours consécutifs) et qu'aucune poche sèche de 7 jours n'apparaît dans la prévision disponible (16 jours) ; sinon « attendez »
  AC2 la réponse donne la raison en une phrase et précise que le critère complet regarde 30 jours, dont seuls 16 sont prévus
  AC3 hors de la fenêtre du calendrier cultural de la zone : « hors saison », avec la prochaine fenêtre
  AC4 cas limites testés : exactement 20 mm, poche sèche de 6 jours, de 7 jours, prévision absente
Scénarios : PS-10, PS-12
Statut : approved

### F-06 Signalement ravageur
Acceptance :
  AC1 un producteur ou un conseiller signale en choisissant la culture et un symptôme par pictogramme ; la photo est facultative ; le signalement est rattaché à une commune
  AC2 le signalement est « à confirmer » tant qu'un agent ne l'a pas validé ; jamais affiché comme officiel avant
  AC3 quand les signalements validés d'un même ravageur dans une commune atteignent le seuil de la règle en 7 jours, une alerte est créée pour la commune et ses voisines, puis diffusée (F-04)
  AC4 (négatif) signalement sans culture ou sans symptôme : 400 ; même signalement envoyé deux fois (même `clientId`) : enregistré une seule fois
  AC5 (négatif) un producteur ne voit pas les coordonnées exactes des signalements des autres
Scénarios : PS-01, PS-07, PS-11, PS-15 (photo)
Données : PestReport (reporterId, actingForId, communeId, cropId, symptom, photoUrl, lat, lng, status, clientId unique)
Statut : approved

### F-07 Conseil post-récolte (aflatoxines)
Acceptance :
  AC1 un producteur déclare une récolte de maïs ou d'arachide (date, commune) ; la plateforme évalue la pluie et l'humidité prévues sur les jours suivants
  AC2 conseil parmi « séchez maintenant », « couvrez et mettez à l'abri » et « séchage possible », avec la raison ; message envoyé via F-04 si l'humidité prévue dépasse le seuil
  AC3 (négatif) une date de récolte dans le futur lointain ou une culture non concernée : conseil non généré, message explicite
Statut : approved

### F-08 CMS
Acceptance :
  AC1 un AGENT crée une fiche (lutte, réglementation, calendrier) : titre, texte simple, pictogramme, référence officielle ; brouillon puis publication, avec historique des versions
  AC2 un audio par langue (fon, yoruba, bariba, dendi) s'attache à une fiche ; le fichier est validé par son contenu, limité en taille, puis compressé
  AC3 seuils d'alerte, calendriers culturaux, barèmes TDL et liste des intrants se gèrent dans le CMS ; toute modification est journalisée
  AC4 (négatif) un PRODUCER ou un BUYER ne peut rien publier : 403 ; un fichier déguisé (extension trompeuse) est refusé
Scénarios : PS-09, PS-15
Données : Content, ContentVersion, ContentAudio, Input (nom, statut d'homologation, source)
Statut : approved

### F-09 Vérification d'un intrant
Acceptance :
  AC1 un nom saisi (ou dicté au conseiller) retourne « homologué », « non homologué » ou « inconnu », avec la source et l'alternative recommandée par la fiche de lutte
  AC2 la recherche tolère la casse, les accents et une faute de frappe simple
  AC3 « inconnu » ne dit jamais « autorisé »
Statut : approved

### F-10 Canal USSD simulé
Acceptance :
  AC1 un contrôleur USSD reçoit le format Africa's Talking (POST x-www-form-urlencoded : sessionId, serviceCode, phoneNumber, text) et répond en texte « CON ... » ou « END ... » en moins de 10 secondes ; un téléphone simulé dans l'application appelle ce contrôleur (5 entrées maximum, 3 niveaux maximum)
  AC2 depuis l'USSD : signaler un ravageur, obtenir le conseil de semis, vérifier un intrant, consulter un prix, accuser réception d'une alerte
  AC3 une session expirée ou une entrée invalide renvoie au menu précédent avec un message court
  AC4 (négatif) une requête USSD qui ne vient pas de l'agrégateur (IP ou secret de rappel invalide) est refusée ; un numéro inconnu ne peut que s'inscrire via un conseiller
Statut : approved

### F-11 Connecteur marché et blocage des exports
Acceptance :
  AC1 un producteur ou un conseiller publie une offre de produit vivrier (produit, quantité, prix, commune) ; un acheteur la consulte et la réserve ; une API ouverte et documentée expose offres et prix de référence pour que des places de marché tierces puissent s'y brancher
  AC2 une offre marquée « export » de soja grain ou de noix brute de cajou est refusée sans numéro d'agrément, avec l'explication et la référence du décret
  AC3 le prix de référence affiche sa source et sa date
Scénarios : PS-01, PS-02, PS-07, PS-17
Statut : approved

### F-12 TDL
Acceptance :
  AC1 à la conclusion d'une vente, la TDL est calculée selon le barème de la commune et du produit (montants entiers en FCFA)
  AC2 paiement simulé ; un reçu avec code QR est généré ; la page publique de vérification affiche le montant, la commune et la date, sans donnée personnelle
  AC3 un collecteur COMMUNE enregistre un paiement de marché, même hors ligne, synchronisé ensuite sans doublon
  AC4 (négatif) un reçu falsifié (identifiant ou signature modifiés) est déclaré invalide
Scénarios : PS-01, PS-17, PS-19
Données : TaxRate, TaxPayment (receiptId, signature HMAC)
Statut : approved

### F-13 Lot traçable
Acceptance :
  AC1 un conseiller enregistre une parcelle avec un point GPS ; une livraison crée un lot (producteur, parcelle, culture, date de récolte, poids, humidité déclarée)
  AC2 le QR du lot ouvre une page publique : commune, culture, date, coordonnées de la parcelle arrondies, statut de conformité export ; ni nom ni téléphone du producteur
  AC3 (négatif) un lot sans parcelle ou avec un poids négatif est refusé
Scénarios : PS-07, PS-11
Données : Parcel, Lot
Statut : approved

### F-14 Tableau de bord
Acceptance :
  AC1 carte des communes colorée par niveau d'alerte, avec les signalements (à confirmer ou validés)
  AC2 pour chaque alerte : délai signal-alerte-clôture et taux de lecture
  AC3 valeur protégée par alerte (surface déclarée x rendement de référence x prix de référence), marquée « estimation »
  AC4 production attendue par filière face aux capacités de la GDIZ (120 000 t de cajou, 260 000 t de soja, 40 000 t de coton, source citée)
  AC5 recettes TDL par commune et par période
  AC6 filtre par pôle PDA ; accès réservé aux rôles AGENT, COMMUNE (sa commune seulement) et ADMIN
Scénarios : PS-07, PS-09, PS-13
Statut : approved

### F-15 PWA hors ligne
Acceptance :
  AC1 installable ; les parcours producteur s'affichent hors ligne à partir du cache
  AC2 un signalement ou un accusé de réception fait hors ligne est mis en file puis envoyé au retour du réseau, sans doublon (`clientId`)
  AC3 première page sous 200 Ko transférés, zones tactiles de 48 px, contrastes AA, aucun débordement horizontal à 360 px
Statut : approved
