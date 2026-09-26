# Pourquoi ces choix : le dossier de preuves

Chaque grande décision du cahier des charges repose sur une donnée ou une étude. Ce document les relie, et dit aussi ce que chaque preuve ne démontre pas.

Niveau de preuve :
- **A** : étude publiée et relue par des pairs, ou méta-analyse ;
- **B** : rapport institutionnel (FAO, GSMA, ministère, régulateur) ;
- **C** : presse ou source secondaire, à recouper.

---

## 1. Conseiller par téléphone, plutôt que créer une application de plus

| | |
|---|---|
| **Décision** | Le cœur du produit est l'information agricole envoyée au bon moment (alerte, conseil de semis, conseil post-récolte), et non une application riche. |
| **Preuve** | Méta-analyse publiée dans *Science* (Fabregas, Kremer et Schilbach, 2019), sur l'Afrique subsaharienne et l'Inde : l'information agricole transmise par téléphone augmente les rendements de 4 % et la probabilité d'adopter les intrants recommandés de 22 %. Le bénéfice dépasse d'un ordre de grandeur le coût de transmission. **Niveau A.** |
| **Ce qu'on en tire** | Un SMS au bon moment rapporte plus qu'un écran de plus. D'où les alertes (MON), le conseil de semis (MON-03) et le conseil post-récolte (DIF-01). |
| **Limite** | La méta-analyse repose sur sept études ; l'effet sur le rendement est modeste mais très rentable. On ne promet pas de miracle, on promet un coût marginal quasi nul. |

## 2. La voix et le conseiller avant l'écrit

| | |
|---|---|
| **Décision** | Aucun parcours producteur ne dépend de la lecture. Chaque fiche a un audio en langue locale, enregistré par un conseiller, et un conseiller peut agir au nom du producteur. |
| **Preuves** | Alphabétisation au Bénin : 38,4 % en 2015, 27,3 % chez les femmes (**C**, IndexMundi, à recouper avec l'INStaD). Le fon est parlé par 36 % de la population, le yoruba par 15 %, le bariba par environ 9 % (**A/B**, ODSEF, Université Laval). Avaaj Otalo, forum vocal pour petits producteurs en Inde : la voix est le canal naturel de producteurs qui s'informent déjà oralement (radio, échanges) (**A**, ACM CHI 2010). Digital Green, avec un facilitateur local : adoption des pratiques multipliée par 7 et 10 fois plus efficace par dollar qu'une vulgarisation classique ; production +22 % et revenus +16 % en moyenne chez les adoptants (**A/B**, évaluation J-PAL et revue de preuves). |
| **Ce qu'on en tire** | Le numérique amplifie le conseiller, il ne le remplace pas. D'où le rôle « conseiller » (actions en son nom, tracées) et l'audio enregistré dans le CMS plutôt qu'une synthèse vocale approximative. |
| **Limite** | Digital Green utilise la vidéo, pas l'audio ; on transpose le principe de médiation humaine, pas le format. Aucune donnée récente et fiable sur l'alphabétisation rurale au Bénin n'a été trouvée. |

## 3. USSD et SMS en plus de l'application

| | |
|---|---|
| **Décision** | Trois canaux pour un même service : application web hors ligne, USSD, SMS ou voix. |
| **Preuves** | Bénin, fin 2025 : 78,1 % d'abonnés mobiles uniques, mais seulement 64,9 % d'abonnés internet mobile (**B**, ARCEP / La Nation). Afrique subsaharienne : smartphones à 54 % des connexions en 2024 ; 53 % d'écart d'usage (couverts par le haut débit mobile mais ne l'utilisant pas) ; un smartphone d'entrée de gamme coûte 26 % du PIB mensuel par habitant (**B**, GSMA). |
| **Ce qu'on en tire** | Environ un abonné béninois sur six a un téléphone mais pas internet mobile, et c'est d'abord le producteur rural. Une application seule exclut ceux qu'on veut atteindre. |
| **Limite** | Pas de chiffre spécifiquement rural et agricole pour le Bénin ; l'écart est national. |

## 4. Le démarrage des pluies calculé, pas supposé

| | |
|---|---|
| **Décision** | Le conseil « semez / attendez » applique un critère agronomique publié sur la pluie réelle de la commune. |
| **Preuves** | Critère de Sivakumar (1988), établi sur 58 stations des zones soudano-sahéliennes d'Afrique de l'Ouest : démarrage quand 20 mm tombent en 3 jours, sans poche sèche de 7 jours dans les 30 jours suivants. Cette condition vise précisément les « faux départs » qui font perdre les semis (**A**, *Agricultural and Forest Meteorology*). Au Bénin, les dates normales vont du 15 avril dans l'extrême sud au 9 mai dans l'extrême nord (**B**, PNUD / Météo-Bénin). |
| **Ce qu'on en tire** | Le conseil n'est pas une opinion de la plateforme, c'est une règle publiée, explicable au conseiller, sur la pluie mesurée de sa commune (Open-Meteo, testée sur Parakou). |
| **Limite** | Le critère regarde 30 jours après le démarrage, la prévision n'en couvre que 16 : la plateforme l'annonce. Il a été conçu pour le Sahel et le soudanien ; pour le sud du Bénin et ses deux saisons, il faut le calibrer avec Météo-Bénin (V2). |

## 5. Une alerte ravageur venue du terrain, validée par un agent

| | |
|---|---|
| **Décision** | Signalement par le producteur ou le conseiller, validation par un agent, alerte automatique aux communes voisines, et mesure du délai. |
| **Preuves** | Jassides 2022-2023 : 26 à 60 % de pertes sur le coton, 215 milliards FCFA pour les 8 pays du PR-PICA (**B**, OMC / FAO). En Afrique de l'Est, le dispositif communautaire de suivi de la chenille légionnaire s'appuie sur plus de 650 relais villageois formés qui saisissent dans FAMEWS (**A**, *PLOS One*). Le Bénin a déjà une plateforme géoréférencée reliée à FAMEWS pour ses brigades (**B**, FAO Bénin). Une campagne de vulgarisation par TIC a amélioré les connaissances et la gestion de la chenille légionnaire en Ouganda (**A**, PMC). |
| **Ce qu'on en tire** | La surveillance par relais villageois existe et fonctionne ; ce qui manque, c'est le retour de l'alerte vers le producteur voisin. La plateforme ferme cette boucle et exporte au format FAMEWS (V2) au lieu de le concurrencer. |
| **Limite** | Aucune évaluation publiée du dispositif béninois n'a été trouvée. |

## 6. Le post-récolte : les aflatoxines

| | |
|---|---|
| **Décision** | Conseil de séchage et de stockage déclenché par la date de récolte et la prévision d'humidité (DIF-01). |
| **Preuves** | Étude de l'IITA sur 300 greniers dans quatre zones agroécologiques du Bénin (Hell et al., 2003) : pratiques qui réduisent les aflatoxines, dont le séchage des épis et le tri des mauvais épis ; *Aspergillus flavus* passe de 10-20 % des grains infectés à l'entrée en stock à 54-79 % six mois plus tard (**A**, *Journal of Phytopathology*). Contamination fréquente et parfois élevée du maïs, de l'arachide et du riz au Bénin (**C**, SciDev). Plus de 450 millions de dollars de commerce perdus par an en Afrique subsaharienne ; plus de 2 000 t de maïs rejetées par le PAM (**B**, ReliefWeb). |
| **Ce qu'on en tire** | Le risque se joue dans les semaines qui suivent la récolte, et il dépend de l'humidité : c'est exactement la donnée météo qu'on a déjà. |
| **Limite** | Les données de l'IITA datent de 1993-1995 ; les pratiques ont pu évoluer. Le conseil est préventif et ne mesure pas l'aflatoxine. |

## 7. Vérifier un pesticide avant de l'acheter

| | |
|---|---|
| **Décision** | Vérification de l'homologation d'un intrant par USSD ou SMS, avec l'alternative homologuée (DIF-02). |
| **Preuves** | Basse vallée de l'Ouémé : plus de 8 pesticides sur 10 utilisés viennent de circuits informels, en grande partie du Nigeria, et ne sont pas homologués ; 92 % des 809 producteurs enquêtés associent leur usage à des problèmes de santé (**A/B**, étude relayée par Inter-réseaux). Le Conseil des ministres du 1er juillet 2026 a rappelé l'interdiction de vente des produits non homologués, dont le SNIPER (**C**, Banouto). |
| **Ce qu'on en tire** | Une alerte ravageur qui pousse vers un produit interdit aggrave le problème. La vérification ferme la boucle alerte, traitement sûr. |
| **Limite** | La liste officielle complète d'homologation doit être obtenue de l'autorité compétente ; la démo en utilise un extrait sourcé. |

## 8. Compléter la GDIZ plutôt que la concurrencer

| | |
|---|---|
| **Décision** | Pour le soja, le cajou et le coton : lot traçable de la parcelle au centre de collecte, et indicateur de production attendue face aux capacités industrielles (DIF-03, DIF-04). Pas de marché concurrent. |
| **Preuves** | Cahier des charges de la GDIZ, article 6 : marché terminal relié en étoile à des centres de collecte ; les usines font obligatoirement transiter leur demande par ce marché « afin de permettre un contrôle de la traçabilité » (**B**, document officiel SIPI-Bénin). Capacités installées : 120 000 t de cajou, 260 000 t de soja, 40 000 t de coton (**C**, presse 2026). Le décret d'avril 2024 subordonne l'export de soja et de cajou à la « satisfaction effective des besoins des transformateurs locaux » (**B**, Douanes). L'EUDR s'applique le 30 décembre 2026 au soja et à l'huile de palme et exige la géolocalisation des parcelles (**B**, Conseil de l'UE). |
| **Ce qu'on en tire** | L'État a construit l'aval (usines, marché terminal) ; il manque le premier kilomètre et la donnée de production par parcelle. C'est là que la plateforme apporte ce qui n'existe pas. |
| **Limite** | L'état réel du marché terminal et des centres de collecte n'est pas documenté publiquement. |

## 9. La TDL payée en mobile money

| | |
|---|---|
| **Décision** | Calcul et paiement de la taxe de développement local au moment de la vente, reçu QR vérifiable, piste d'audit. |
| **Preuves** | La TDL frappe les producteurs et les acheteurs en gros de produits agricoles ; le taux est fixé par le conseil communal (**B**, Code général des impôts). 11,65 millions de comptes mobile money actifs, interopérables entre réseaux depuis janvier 2025 (**B**, ARCEP). Études transnationales : l'inclusion financière par mobile money est associée à des recettes fiscales plus élevées et facilite le paiement (**A**, *SAGE Open* 2025 ; *International Tax and Public Finance* 2026). |
| **Ce qu'on en tire** | Payer au moment de la transaction, sans déplacement, avec un reçu qui protège le producteur d'une double perception. |
| **Limite** | Les études mesurent une association au niveau des pays, pas l'effet d'un dispositif communal précis. Le barème de la démo est fictif. Taxer une transaction peut aussi la pousser vers l'informel (cas de la taxe mobile money en Ouganda) : la TDL doit rester la taxe existante, pas une nouvelle. |

## 10. Interopérer avec l'existant de l'État

| | |
|---|---|
| **Décision** | Connexion par NPI, registre e-Agri, météo, prix et FAMEWS consommés par X-Road ; aucun registre concurrent. |
| **Preuves** | NPI unique (ANIP), déjà utilisé pour se connecter aux services publics (**B**). Bus X-Road de l'État, où l'ATDA et l'ANIP sont référencées (**B**, CatIS). e-Agri et PITN2R : suivi des exploitations dans 2 128 villages (**B**, gouv.bj). Stratégie nationale d'agriculture numérique 2022-2025 (**B**). Environ 2 000 agents recrutés pour le conseil public ; en pratique, un conseiller suit environ 240 producteurs dans un programme évalué (**B**, CIRAD / SNCA). |
| **Ce qu'on en tire** | La valeur est dans la couche qui relie ce que l'État a déjà construit. Avec un conseiller pour environ 240 producteurs, l'outil doit démultiplier chaque conseiller, pas lui ajouter du travail de saisie. |
| **Limite** | Le ratio de 240 vient d'un programme, pas d'une statistique nationale. |

---

## Ce qui n'est pas prouvé et que nous ne prétendons pas

- Que la plateforme augmentera les rendements d'un chiffre donné au Bénin : seul le pilote le mesurera (indicateurs, section 12 du cahier des charges).
- Que les producteurs accuseront réception des alertes : c'est précisément pourquoi la boucle est mesurée.

---

## Sources

- [Fabregas, Kremer, Schilbach (2019), *Science*](https://www.science.org/doi/10.1126/science.aay3038) ; [méta-analyse 2025, ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2211912425000410)
- [Patel et al. (2010), Avaaj Otalo, ACM CHI](https://dl.acm.org/doi/10.1145/1753326.1753434)
- [J-PAL, évaluation de Digital Green](https://www.povertyactionlab.org/evaluation/evaluation-digital-greens-agricultural-extension-program-india) ; [Digital Green, revue de preuves](https://digitalgreen.org/wp-content/uploads/2023/12/DG-Evidence-Review_Final-Report.pdf) ; [expérience en Éthiopie, *World Development*](https://www.sciencedirect.com/science/article/pii/S0305750X22002790)
- [GSMA, état de la connectivité mobile en Afrique subsaharienne](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/blog/the-state-of-mobile-internet-connectivity-in-sub-saharan-africa/) ; [GSMA Intelligence, Mobile Economy Africa 2025](https://www.gsmaintelligence.com/research/the-mobile-economy-africa-2025)
- [Sivakumar (1988), *Agricultural and Forest Meteorology*](https://iri.columbia.edu/~ousmane/print/Onset/Sivakumar1988_AgForesMet.pdf) ; [Frontiers in Climate (2026), sensibilité des définitions du démarrage](https://www.frontiersin.org/journals/climate/articles/10.3389/fclim.2026.1793665/full) ; [PNUD Bénin, dates des saisons](https://www.undp.org/fr/benin/connaissance-des-dates-predeterminees-des-saisons-pluvieuses-au-benin)
- [Suivi communautaire de la chenille légionnaire, *PLOS One*](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0249042) ; [campagne TIC en Ouganda, PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6703685/) ; [FAO, FAMEWS](https://sti-portal.fao.org/innovations/fall-armyworm-monitoring-and-early-warning-system-famews) ; [FAO Bénin](http://www.fao.org/benin/actualites/detail-events/fr/c/1234214/) ; [OMC, jassides](https://www.wto.org/english/tratop_e/agric_e/dg_cons_170523_ben_e.pdf)
- [Hell et al. (2003), *Journal of Phytopathology*](https://onlinelibrary.wiley.com/doi/abs/10.1046/j.1439-0434.2003.00792.x) ; [pratiques de stockage dans quatre zones du Bénin](https://www.researchgate.net/publication/222829562_The_influence_of_storage_practices_on_aflatoxin_contamination_in_maize_in_four_agroecological_zones_of_Benin_West_Africa) ; [SciDev](https://www.scidev.net/afrique-sub-saharienne/news/le-benin-face-aux-mefaits-dune-forte-contamination-aux-mycotoxines/) ; [ReliefWeb](https://reliefweb.int/report/world/les-aflatoxines-minent-la-sant-et-le-commerce-dans-la-partie-subsaharienne)
- [Inter-réseaux, pesticides non homologués dans l'Ouémé](https://www.inter-reseaux.org/ressource/pesticides-chimiques-de-synthese-non-homologues-en-agriculture-dans-la-basse-vallee-de-loueme-au-benin-constats-et-regards-croises-des-acteurs/) ; [Banouto, SNIPER](https://www.banouto.bj/bien-etre/article/20260702-benin-sniper-et-dautres-pesticides-non-homologues-interdits-de-vente)
- [Cahier des charges de la GDIZ](https://gdiz-benin.com/wp-content/uploads/2024/08/Cahier-de-Charges_GDIZ-Framework-FR.pdf) ; [Douanes, export de soja et de cajou](https://douanes.gouv.bj/interdiction-formelle-de-lexportation-par-voie-terrestre-des-noix-de-cajou-du-soja-et-des-intrants-agricoles-lessentiel-dans-ce-communique-du-directeur-general-des-douanes/) ; [Conseil de l'UE, EUDR](https://www.consilium.europa.eu/en/press/press-releases/2025/12/18/deforestation-council-signs-off-targeted-revision-to-simplify-and-postpone-the-regulation/)
- [Ren et al. (2025), mobile money et recettes fiscales, *SAGE Open*](https://journals.sagepub.com/doi/full/10.1177/21582440251315222) ; [*International Tax and Public Finance* (2026)](https://link.springer.com/article/10.1007/s10797-026-09952-w) ; [IGC, taxe mobile money en Ouganda](https://www.theigc.org/sites/default/files/2025-05/Spadavecchia-et-al-Final-Report-May-2025.pdf) ; [TDL](https://benin.fm/formalite/taxe-de-developpement-local/)
- [ARCEP / La Nation](https://lanation.bj/numerique/telecommunications-au-benin-legere-baisse-des-sim-mais-forte-progression-des-usages) ; [ODSEF, langues au Bénin](https://www.odsef.fss.ulaval.ca/sites/odsef.fss.ulaval.ca/files/odsef_assani_web.pdf) ; [CIRAD, relancer le conseil agricole](https://agritrop.cirad.fr/593485/1/55-notes-techniques(1).pdf) ; [SNCA 2018-2025](https://apidpp.agriculture.gouv.bj/public/storage/uploads/an4Xii8TeoXr8fLxidNeMHOOkXPGXCpj3xIfbHl4.pdf)
