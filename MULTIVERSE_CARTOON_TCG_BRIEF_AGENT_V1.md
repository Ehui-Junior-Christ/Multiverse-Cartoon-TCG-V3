# MULTIVERSE CARTOON TCG — DOSSIER DE TRANSMISSION À L’AGENT

**Version 1.0 — Document de référence unique pour le prototype local**

**Règle de lecture :** ce dossier rassemble les consignes, règles, priorités, décisions techniques et critères d’acceptation. Il remplace les annexes séparées pour le travail de réalisation. Les règles déjà validées priment sur les propositions techniques. Les paramètres économiques sont des valeurs initiales à tester.

## 0. MISSION DE L’AGENT — À LIRE EN PREMIER

Tu es l’agent principal chargé de concevoir, structurer, développer et livrer un prototype jouable de MULTIVERSE CARTOON TCG. Tu dois agir comme une petite équipe expérimentée réunissant game designer, développeur frontend, développeur backend, architecte logiciel, intégrateur UI/UX et testeur QA.

Ta mission n’est pas de produire uniquement une maquette, un cahier des charges supplémentaire ou des écrans statiques. Tu dois construire progressivement un vrai jeu jouable, avec des règles appliquées par un moteur de duel, des cartes chargées depuis des données, une interface interactive, des animations et des tests.

Travaille de manière autonome. Ne demande pas au propriétaire de confirmer chaque détail technique. Lorsqu’un détail secondaire manque, choisis une solution simple, cohérente, documentée et réversible. Pose une question uniquement si une décision stratégique majeure bloque réellement le projet.

Avant toute modification, inspecte le dépôt et l’environnement existants. Préserve le code déjà fonctionnel. Ne supprime, ne réécris et ne remplace jamais un projet existant sans l’avoir compris et sans expliquer précisément le risque. Si aucun dépôt n’existe, initialise une structure propre.

À chaque étape : implémente réellement, lance les tests, corrige les erreurs, mets à jour la documentation et indique les fichiers créés/modifiés, les commandes exécutées, les résultats et les prochaines tâches. N’affirme jamais qu’une fonctionnalité est terminée si elle n’a pas été exécutée et vérifiée.

## 1. IDENTITÉ ET OBJECTIF DU PROJET

Nom : MULTIVERSE CARTOON TCG. Genre : jeu de cartes à collectionner stratégique (TCG), au tour par tour, inspiré des univers de dessins animés et cartoons. Le jeu rassemble des personnages, créatures, techniques, équipements, pouvoirs, pièges, terrains et invocations issus de plusieurs univers.

Exemples d’univers envisagés : Ben 10, Adventure Time, Les Super Nanas, Teen Titans, Bob l’éponge, Tom et Jerry et d’autres univers cartoon. Le catalogue doit être extensible et ne doit pas être codé en dur dans les composants d’interface.

Objectif immédiat : prototype personnel, local et privé, destiné aux essais entre amis et à la préparation de démonstrations auprès de structures susceptibles d’accompagner le projet. Ne pas déployer publiquement, ne pas configurer une infrastructure de production publique et ne pas intégrer de paiement réel dans cette première livraison. Préparer une architecture propre qui pourra évoluer ultérieurement.

Le résultat attendu doit donner l’impression d’un jeu cohérent et premium : interface soignée, cartes lisibles, animations fluides, règles fiables, terrain de duel clair, collection et construction de decks utilisables, puis duel complet contre une IA simple. Le multijoueur réseau, les comptes externes et les services publics viennent après la stabilité du cœur du jeu.

IMPORTANT : la direction générale des franchises et des personnages est fournie par le propriétaire du projet. Ne bloque pas le développement du prototype en relançant sans cesse ce sujet. Prévois un système d’assets remplaçables et une gestion centralisée des images, logos et sources. Ne prétends pas qu’une licence ou une autorisation a été vérifiée par l’agent.

## 2. RÈGLES NON NÉGOCIABLES

AUCUN SYSTÈME D’ÉNERGIE. Aucun mana, stamina, jauge d’énergie, ressource de paiement d’invocation ou équivalent sous un autre nom. Les cartes sont jouées selon leurs conditions propres, leurs effets, les matériaux, les sacrifices, les cartes présentes sur le terrain et les phases.

Le mot « niveau » ne doit jamais désigner la puissance ou la progression d’un personnage. Pour les personnages, utiliser « POPULARITÉ », sur une échelle de 1 à 12. La popularité représente la reconnaissance et l’importance culturelle du personnage, pas sa force au combat. Exemple de formulation : « Popularité 10 ». La popularité peut intervenir dans les conditions d’une carte ou d’une invocation si son texte le prévoit.

Ne jamais confondre : Popularité (personnage), ATK (attaque), DEF (défense), rareté (valeur de collection) et niveau du compte joueur (progression du compte, 1 à 100). Une carte personnage peut avoir Popularité, ATK et DEF comme champs distincts.

La rareté ne détermine pas automatiquement la puissance compétitive. Les animations ne décident jamais de la logique : le moteur calcule d’abord, l’interface anime ensuite le résultat. Les données des cartes ne doivent jamais exécuter du code arbitraire.

## 3. CATÉGORIES DE CARTES ET DONNÉES

Huit catégories : Personnage ; Attaque / Technique ; Équipement ; Soutien ; Magie ; Piège ; Terrain ; Invocation spéciale.

Champs communs recommandés : id stable, nom, univers, catégorie, sous-catégorie éventuelle, rareté, illustration, texte de règles, tags, statut de publication, version, restrictions de format. Champs conditionnels : Popularité (personnage), ATK/DEF (personnage et cartes concernées), conditions d’activation, coût au sens de sacrifice/défausse/perte de LP uniquement, cibles, durée, zone de provenance, effets structurés.

Raretés : Common, Rare, Epic, Legendary, Ultra Legendary. Les doublons sont conservés. Aucun crafting, aucune fusion de doublons, aucun échange entre joueurs ni marché entre joueurs dans la conception initiale.

Deck principal : 44 à 64 cartes ; maximum 3 exemplaires d’une même carte sauf restriction ; main initiale de 6 ; aucun mulligan ; aucune limite maximale de main. Extra Deck : maximum 20 cartes, distinct du deck principal, réservé aux cartes explicitement désignées. Une carte invoquée reste sur le terrain jusqu’à destruction ou déplacement par effet. Aucun retour automatique à l’Extra Deck.

## 4. ZONES ET PLACEMENT DES CARTES

Chaque joueur dispose de 5 zones Personnage, 5 zones Magie/Piège, 1 zone Terrain, 1 Deck principal, 1 Cimetière, 1 zone bannie et 1 Extra Deck.

Placement : Personnage → zone Personnage. Technique temporaire → activation depuis la main puis Cimetière par défaut. Technique persistante → zone Magie/Piège. Équipement → zone Magie/Piège. Soutien → zone selon sous-type (zone Personnage pour soutien de type personnage, zone Magie/Piège pour soutien persistant non-personnage, Cimetière pour soutien temporaire). Magie/Piège → zone Magie/Piège. Terrain → zone Terrain. Invocation spéciale depuis l’Extra Deck → zone Personnage.

Distinguer strictement destruction, envoi au Cimetière, bannissement, retour en main, retour au deck et changement de contrôleur. La propriété d’une carte ne change pas lorsqu’un effet change son contrôleur. Un équipement rejoint normalement le Cimetière si son personnage équipé quitte le terrain, sauf texte contraire.

Chaque joueur possède son propre Terrain actif. Les deux Terrains peuvent coexister. En cas de conflit direct entre deux effets incompatibles, le Terrain activé le plus récemment a priorité uniquement sur le point conflictuel ; les autres effets continuent. Un Terrain ne détruit pas automatiquement celui de l’adversaire.

## 5. LES CINQ INVOCATIONS SPÉCIALES

1) CROSSOVER : associe au moins deux personnages compatibles provenant d’univers différents. La carte d’invocation définit les personnages requis, les conditions et la destination des matériaux.

2) ÉVEIL / AWAKENING : transforme un personnage déjà présent sur le terrain en une nouvelle forme depuis l’Extra Deck. Par défaut, l’équipement attaché à l’ancienne forme va au Cimetière, sauf indication contraire. Si l’éveil est temporaire, la carte doit définir précisément ce qui arrive à son expiration.

3) SACRIFICE : invoque une carte en utilisant un ou plusieurs personnages comme matériaux. La carte indique le nombre, les types éventuels, les conditions de popularité et la destination des matériaux.

4) DIMENSIONNELLE : invoque selon des conditions liées aux cartes bannies, au Cimetière, au terrain, aux univers, aux LP ou aux Terrains. La condition peut être consommée ou non selon le texte de la carte.

5) RÉSONANCE : associe des personnages compatibles ou complémentaires, d’un même univers ou d’univers différents. Compatibilité définie par attributs, rôles, familles, tags ou règles explicites.

Ces mécaniques sont indépendantes. Une carte peut autoriser plusieurs méthodes si elle le précise. Toute invocation nécessite que ses conditions soient vérifiées et qu’une zone Personnage soit libre. Implémenter chaque méthode comme un module de règles testable, pas comme une animation isolée.

## 6. STRUCTURE D’UN DUEL 1 CONTRE 1

LP de départ : 10 000 par joueur. Détermination du premier joueur : pierre-feuille-ciseaux ; en cas d’égalité, recommencer ; le gagnant choisit qui commence. Le premier joueur ne pioche pas au début de son premier tour ; le deuxième pioche normalement.

Phases : Draw Phase ; Standby / Preparation Phase ; Main Phase 1 ; Battle Phase ; Main Phase 2 ; End Phase. Plusieurs invocations sont possibles dans un même tour si les conditions sont respectées : aucune limite universelle d’une invocation normale par tour.

Un personnage en position d’attaque peut attaquer. En défense, il utilise sa DEF et ne peut normalement pas attaquer. Changement de position au maximum une fois par tour du contrôleur, pendant une Main Phase, uniquement si le personnage n’a pas attaqué ce tour, sauf effet contraire. Chaque personnage attaque normalement une fois par tour, sauf effet contraire.

Combat ATK contre ATK : le personnage ayant la plus faible ATK est détruit et son contrôleur perd des LP égaux à la différence ; égalité : les deux sont détruits sans perte de LP. ATK contre DEF : si ATK > DEF, le défenseur est détruit sans perte de LP ; si ATK < DEF, aucun personnage n’est détruit et aucun LP n’est perdu ; égalité : aucun n’est détruit. Attaque directe possible si l’adversaire ne contrôle aucun personnage ; dégâts égaux à l’ATK, sauf effet contraire.

Phases de combat détaillées à gérer dans le moteur : Battle Start, Battle Step, Damage Step, Battle End. Modifications ATK/DEF : fixes, additives ou multiplicatives ; appliquer protections et plafonds ; statistiques jamais négatives. Si une cible quitte le terrain avant le calcul, pas de combat contre cette cible. Prévoir piercing, double attaque, protection, contre-attaque, réflexion, absorption, destruction ciblée et immunité comme capacités réutilisables.

## 7. EFFETS ET CHAÎNES

Types d’effets : activé, continu, déclenché, rapide, obligatoire, facultatif, remplacement, protection. Chaque effet doit être structuré : identifiant, type, déclencheur, conditions, coûts, cibles, instructions, durée, limites d’utilisation et règles de réponse.

Les coûts possibles sont des actions de jeu (défausser, sacrifier, perdre des LP, bannir, déplacer une carte), jamais une énergie ou mana. Un coût payé n’est pas remboursé par défaut si l’activation ou l’effet est annulé.

Différencier effet ciblé, non ciblé et global. Limites configurables : une fois par tour, par duel, par exemplaire ou par nom de carte. Différencier annulation d’activation et annulation d’effet.

Vitesses de chaîne : Speed 1 ne répond pas à une activation déjà engagée ; Speed 2 peut répondre aux vitesses 1 et 2 ; Speed 3 peut répondre aux vitesses 1, 2 et 3 ; une vitesse inférieure ne répond jamais à une vitesse supérieure. Résolution en ordre inverse d’activation. Plafond de sécurité de 100 maillons ; en cas d’atteinte, suspendre le duel et enregistrer une erreur de diagnostic plutôt que choisir arbitrairement un vainqueur.

Lorsque plusieurs effets sont simultanés, appliquer les règles d’ordre entre obligatoires et facultatifs et de priorité. Si une instruction devient impossible mais que les autres restent valides, résoudre les instructions encore possibles ; si une condition essentielle disparaît, l’effet peut ne rien faire.

## 8. FIN DE DUEL, TEMPS ET DÉCONNEXION

Défaite si LP à zéro, pioche obligatoire impossible car deck vide, abandon volontaire, inactivité continue de 2 minutes, ou absence après le délai de reconnexion. Une main vide ne provoque pas une défaite. En cas de défaite simultanée causée par un effet, le joueur ayant déclenché cet effet gagne.

Durée maximale d’un tour : 3 min 30. À expiration : aucune nouvelle action volontaire ; les chaînes et effets obligatoires en cours terminent leur résolution ; les choix facultatifs non sélectionnés sont considérés comme refusés ; le tour passe ensuite. Les animations et traitements techniques ne doivent pas pénaliser artificiellement le joueur.

Délai de reconnexion : 180 secondes. En cas de déconnexion, suspendre et restaurer exactement le même état. Si le joueur ne revient pas dans le délai, il perd.

## 9. MODE 2 CONTRE 2 — À DÉVELOPPER APRÈS LE 1V1

LP partagés : 20 000 par équipe. Ordre : A1 → B1 → A2 → B2. Chaque équipe partage 5 zones Personnage, 5 zones Magie/Piège, 1 zone Terrain, Cimetière et zone bannie. Seul le joueur actif modifie le Terrain de son équipe.

Les cartes présentes dans les zones partagées sont sous contrôle de l’équipe ; les deux coéquipiers peuvent utiliser ces cartes et effets selon les règles. Utiliser une carte du coéquipier comme matériau nécessite sa permission. Les coéquipiers peuvent communiquer mais ne voient pas les mains ni cartes face cachée de l’autre.

Le joueur actif choisit l’adversaire ciblé. « Votre adversaire » signifie l’un des deux adversaires, choisi par le joueur actif, sauf précision. Les effets visant l’équipe entière ou plusieurs joueurs doivent le dire explicitement. Si un joueur abandonne, est inactif ou ne revient pas dans les 180 secondes, toute l’équipe perd. Pas de classement ELO 2v2.

## 10. COLLECTION, PROGRESSION ET ÉCONOMIE — APRÈS LE CŒUR JOUABLE

Collection personnelle sans limite, doublons conservés, pas de transfert, échange ou marché. Les cartes bannies restent dans la collection. Toutes les cartes doivent être obtenables en jouant ; certaines peuvent être temporairement exclusives à des événements/périodes. Les achats réels sont hors périmètre du prototype initial.

Monnaie conceptuelle : JM = Jetons Multivers. Elle ne sert jamais pendant un duel. Usages prévus : boosters, cartes individuelles, cosmétiques, accessoires de profil et personnalisation du terrain. Aucun transfert de JM entre joueurs.

Six voies d’obtention : boosters, récompenses de duel, missions quotidiennes/hebdomadaires, campagne, événements, boutique. Crafting non retenu. Boosters de 10 cartes, doublons possibles, aucune protection contre doublons, animation skippable, ouverture 1 ou 10 boosters, révélation carte par carte ou groupée. Types : Multivers classique, thématique, spécial raretés, événementiel.

Raretés : Common, Rare, Epic, Legendary, Ultra Legendary. Probabilités de départ proposées pour les 9 premières cartes : 70 %, 22 %, 6 %, 1,7 %, 0,3 %. Dixième carte garantie Rare ou mieux : Rare 70 %, Epic 24 %, Legendary 5,5 %, Ultra Legendary 0,5 %. Pity proposé : après 5 boosters sans Epic+, le 6e garantit Epic+ ; après 19 sans Legendary+, le 20e garantit Legendary+ ; après 49 sans Ultra Legendary, le 50e garantit Ultra Legendary. Même probabilités JM/argent réel. Ce sont des paramètres initiaux à tester, pas des vérités d’équilibrage.

Progression du compte : niveaux 1 à 100, XP et cosmétiques/monnaie, aucun avantage de combat. Valeurs initiales proposées : duel classé terminé 100 XP ; amical 50 ; victoire IA 30 ; missions quotidiennes 50–150 ; hebdomadaires 250–600. XP niveau n : 100 + 10 × (n−1). ELO 1v1 initial 1000 ; K=40 pour 20 premiers matchs, 24 ensuite, 16 joueurs très expérimentés ; saisons 8 semaines ; reset doux 1000 + 0,75 × (ancien ELO − 1000). Ces systèmes sont à implémenter après le duel de base.

## 11. MODES, IA, CAMPAGNE, TOURNOIS ET REPLAYS

Modes visés : duel amical, duel classé, duel IA, défis, 2v2, spectateur, campagne/histoire. Pour la première démonstration, prioriser : tutoriel court, duel local contre IA, collection, deck builder et un écran de profil simple. Les autres modes peuvent être présents dans la roadmap mais ne doivent pas être simulés par de faux boutons.

IA : difficultés débutant, normale, avancée, experte. Elle utilise le même moteur et les mêmes règles, sans accès aux informations cachées de l’adversaire. Architecture : génération d’actions légales, évaluation, recherche limitée de scénarios et probabilités basées uniquement sur les informations accessibles.

Campagne : histoire originale de perturbation du multivers, chapitres, missions, boss, dialogues, cinématiques légères et récompenses. Pas nécessaire à la première démo.

Tournois futurs : publics, privés, officiels et communautaires ; formats élimination directe, double élimination, toutes rondes et classement par points. Résultats validés par le serveur/organisateur autorisé ; procédure de contestation et journalisation.

Replays : journal d’événements permettant de reconstruire phases, tours, invocations, attaques, effets, destructions et LP. Contrôles pause, retour, reprise, navigation. Aucun commentaire sur les replays. Conservation configurable (valeur initiale proposée : 90 jours), durée de conservation indépendante de la durée de validité des liens.

## 12. DIRECTION ARTISTIQUE ET UX

Style : illustrations 2D cartoon premium, personnages expressifs, univers visuellement distincts mais unifiés par une interface commune, effets spectaculaires maîtrisés, typographie lisible et hiérarchie visuelle forte. Le rendu doit être celui d’un jeu abouti, pas d’un tableau d’administration.

Structure d’une carte Personnage : cadre et rareté ; nom ; univers ; Popularité (pas niveau) ; illustration centrale ; catégorie/type/attribut ; texte d’effet lisible ; ATK rouge et DEF bleue. Les éléments de règles restent des éléments d’interface et ne sont pas peints dans l’illustration. Phrase signature facultative.

Carte Terrain : grande illustration panoramique, nom, univers, catégorie Terrain, description/effet, durée ou condition de remplacement si applicable. Carte Technique/Magie/Piège : illustration, catégorie claire, vitesse/condition si applicable, texte d’effet et rareté.

Terrain de duel : composition symétrique, lisible sur ordinateur et adaptable mobile ; 5 zones Personnage et 5 zones Magie/Piège par joueur ; zone Terrain de chaque joueur ; Deck, Extra Deck, Cimetière, zone bannie ; avatars, LP, tour, phase, timer, main du joueur et actions disponibles. La disposition graphique exacte doit être dessinée et testée ; ne pas copier aveuglément la disposition approximative du visuel de référence.

Animations prévues : pioche, pose, déplacement, attaque, dégâts, destruction, activation magie/piège, Crossover, Éveil, Résonance, victoire/défaite. Prévoir réduction/désactivation des animations et respecter les appareils modestes. Les animations ne bloquent pas les règles ni la synchronisation du moteur.

Les boutons doivent être fonctionnels. Les cartes doivent pouvoir être inspectées en grand format. Les effets disponibles doivent être présentés clairement au joueur ; les actions illégales doivent être désactivées ou expliquées. Prévoir états chargement, vide, erreur, confirmation et retour.

## 13. ARCHITECTURE TECHNIQUE RECOMMANDÉE

Frontend : Vue 3 + TypeScript + Vite. Composition API, composants réutilisables, Pinia pour l’état UI non autoritaire, Vue Router, CSS structuré ou Tailwind si cela simplifie réellement le projet. Animations CSS/SVG/Lottie ou moteur léger ; ne pas introduire Unreal Engine.

Backend local : Java 21 + Spring Boot 3.x. API REST pour catalogue, collection, decks, profils locaux et commandes de duel. WebSocket seulement lorsque le multijoueur réseau sera réellement commencé. Moteur de duel Java indépendant de Spring et de l’interface, déterministe et testable.

Base de données : PostgreSQL pour cartes, profils, decks, collections et historiques. Pour un prototype de démonstration simple, une base locale peut être lancée avec Docker Compose ou installée localement. Redis est optionnel et doit être différé tant qu’un besoin réel n’existe pas.

Architecture modulaire suggérée : catalog, collection, deck, duel-engine, match, progression, economy, replay, admin. Ne pas transformer prématurément le projet en microservices. Un monolithe modulaire est préférable pour la première version.

Le moteur est l’autorité : il valide tours, phases, zones, LP, pioches, actions légales, invocations, attaques, effets, chaînes et victoire. Le client ne calcule jamais seul le résultat d’un duel. Les actions sont typées, validées et journalisées. Les données des cartes sont déclaratives et ne peuvent pas exécuter de code arbitraire.

Tests : unitaires pour règles et effets ; tests d’intégration API/base ; tests frontend des parcours critiques ; scénarios de duel reproductibles. Prévoir seed de données de démonstration et commandes simples de démarrage.

## 14. PLAN DE RÉALISATION — ORDRE OBLIGATOIRE

PHASE 0 — AUDIT ET PLAN : inspecter le dépôt, les versions, les scripts, les dépendances et l’environnement. Produire PROJECT_STATUS.md, ARCHITECTURE.md et un backlog priorisé. Lancer le projet existant avant de le modifier.

PHASE 1 — FONDATIONS : créer le squelette frontend/backend, configuration locale, base de données, gestion des assets, catalogue JSON/DB, conventions, logs et tests. Résultat : application locale qui démarre proprement.

PHASE 2 — DESIGN SYSTEM ET ÉCRANS : menu principal, navigation, collection, détail carte, deck builder et terrain de duel. Construire d’abord des composants réutilisables et responsives. Ne pas mettre de faux boutons.

PHASE 3 — MOTEUR 1v1 : état de duel, zones, LP, phases, pioche, invocations normales, positions, attaques, calcul des dégâts, destruction, victoire/défaite. Écrire les tests avant d’ajouter des effets complexes.

PHASE 4 — EFFETS ET INVOCATIONS : moteur d’effets structurés, chaînes, vitesses, annulations, protections, puis Crossover, Éveil, Sacrifice, Dimensionnelle et Résonance. Chaque mécanique doit avoir des tests positifs, négatifs et limites.

PHASE 5 — CONTENU DE DÉMO : créer un premier lot cohérent de cartes de test (cible de catalogue initiale : 120 cartes, dont 48 personnages, 16 techniques, 10 équipements, 10 soutiens, 12 magies, 8 pièges, 6 terrains et 10 invocations spéciales). Le catalogue initial peut être livré progressivement ; priorité à un deck jouable et équilibré.

PHASE 6 — IA ET PARCOURS COMPLET : IA débutante fonctionnelle, tutoriel, duel complet, retour menu, historique local, collection et sauvegarde persistante. Une partie doit pouvoir être jouée du début à la fin sans intervention développeur.

PHASE 7 — POLISH ET DÉMO : animations, sons facultatifs, transitions, effets visuels, responsive, performance, réduction d’animations, tests de régression et scénario de démonstration guidé.

PHASE 8 — EXTENSIONS APRÈS VALIDATION : 2v2, multijoueur réseau, spectateur, replays avancés, ELO, saisons, tournois, boutique, monétisation et campagne. Ne pas prétendre que ces fonctions existent tant qu’elles ne sont pas réellement développées.

## 15. LIVRABLES ET CRITÈRES D’ACCEPTATION

Livrables obligatoires : code source exécutable ; README avec prérequis et commandes ; GAME_RULES.md ; ARCHITECTURE.md ; PROJECT_STATUS.md ; catalogue de cartes de démonstration ; données seed ; tests automatisés ; procédure de sauvegarde/restauration locale ; captures d’écran de la démo ; journal des choix techniques.

Critères de validation minimum : l’application démarre sur une machine locale avec des commandes documentées ; menu et navigation fonctionnent ; collection affiche et filtre les cartes ; détail carte montre Popularité et non « niveau » pour les personnages ; deck builder bloque les decks invalides ; le duel applique 10 000 LP, phases, pioche, zones et règles de combat ; un joueur peut terminer un duel contre l’IA ; les effets et invocations implémentés sont testés ; les données persistent après redémarrage ; aucun bouton essentiel n’est fictif.

Avant de déclarer une phase terminée, fournir : liste des fonctionnalités, fichiers touchés, commandes réellement exécutées, résultat des tests, limites connues et preuve visuelle ou démonstration. Une capture d’écran ne remplace pas un test fonctionnel.

## 16. CE QUE LE PROPRIÉTAIRE DOIT FOURNIR

Indispensable pour terminer proprement : 1) un ordinateur de développement capable de faire tourner IDE, navigateur, Java et Node ; 2) accès au dossier/repository du projet ; 3) un agent de code connecté à ce dossier avec permission de lire/écrire/exécuter les commandes ; 4) validation des installations nécessaires (Git, Node LTS, Java 21, Maven ou Gradle, PostgreSQL ou Docker) ; 5) les images des personnages, fonds, logos et éléments visuels que le propriétaire souhaite intégrer, rangés dans des dossiers clairs ; 6) quelques exemples de cartes/personnages prioritaires si des cartes précises doivent apparaître dans la première démo ; 7) disponibilité pour tester le jeu et donner un retour sur les choix réellement stratégiques.

Très utile mais non bloquant au début : logo final ; palette et typographies préférées ; musiques et sons ; liste des univers/personnages prioritaires ; images haute résolution et versions détourées ; ordinateur/téléphone cible de démonstration ; nom des personnes qui testeront ; scénario de présentation aux structures.

L’agent doit utiliser des placeholders propres lorsque les assets ne sont pas encore fournis, et ne jamais bloquer le moteur de jeu en attendant les images. Prévoir des noms de fichiers stables, par exemple assets/cards/characters/{card-id}.webp, assets/cards/terrains/{card-id}.webp, assets/boards/{board-id}.webp, assets/ui/.

Configuration conseillée pour travailler confortablement : ordinateur avec 16 Go RAM recommandés, espace disque libre suffisant, connexion Internet pour installer les dépendances seulement. Le jeu de démonstration doit ensuite fonctionner localement sans dépendre d’un déploiement public. Le smartphone seul n’est pas un environnement confortable pour construire et tester tout le projet.

## 17. INSTRUCTIONS DE DÉMARRAGE À L’AGENT

Commence par auditer le projet et l’environnement. Ne commence pas par générer des centaines de fichiers. Présente un diagnostic bref, puis un plan de livraison par phases avec les risques et les dépendances. Ensuite, démarre la Phase 0 et la Phase 1.

Ne redemande pas au propriétaire les décisions déjà écrites dans ce document. Si une règle est ambiguë, identifie l’ambiguïté, choisis une interprétation provisoire la moins risquée, consigne-la dans DECISIONS.md et continue, sauf si cela change profondément l’identité du jeu.

Ne construis pas tout le jeu dans un seul prompt ou un seul commit. Avance par incréments verticaux testables. Garde un état du projet à jour. Ne remplace pas les tests par des déclarations. Ne cache pas les erreurs de compilation. Ne laisse pas de boutons décoratifs sur les parcours annoncés comme terminés.

Priorité absolue : un prototype local, beau, stable et jouable en duel 1v1 contre IA. La qualité du moteur et la lisibilité des règles passent avant l’accumulation de modes secondaires. Une démonstration courte et entièrement fonctionnelle vaut mieux qu’une liste de fonctionnalités fictives.

## 18. RÉFÉRENCE VISUELLE — COMMENT L’UTILISER

L’image jointe à ce dossier est une planche d’intention graphique : elle montre une carte Personnage, une carte Terrain, une carte Technique et une vue conceptuelle du terrain de duel. Elle sert à communiquer le niveau de finition, la hiérarchie visuelle, les cadres, les illustrations et l’ambiance.

ATTENTION : cette image n’est PAS un document de règles et ne doit pas être recopiée littéralement. Elle contient des chiffres et libellés de démonstration qui ne sont pas tous conformes aux règles officielles du projet (par exemple les LP affichés ne sont pas la règle : le duel 1v1 commence à 10 000 LP ; tout libellé évoquant une « énergie » est interdit). Le terrain doit respecter exactement les 5 zones Personnage, 5 zones Magie/Piège et 1 zone Terrain par joueur.

Pour les personnages, la carte doit afficher « Popularité » et non « Niveau ». Les couleurs rouge ATK et bleu DEF sont des repères visuels recommandés. Les textes présents dans une image générée peuvent être approximatifs : l’agent doit refaire les vrais textes en HTML/CSS dans l’interface, jamais les considérer comme des données fiables.

Créer des composants de carte distincts par catégorie tout en conservant un langage visuel commun. Prévoir les variantes Common, Rare, Epic, Legendary et Ultra Legendary par cadre, finitions, reflets et particules, sans rendre le texte moins lisible.
