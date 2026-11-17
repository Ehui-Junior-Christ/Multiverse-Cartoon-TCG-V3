# DÉCISIONS TECHNIQUES ET INTERPRÉTATIONS

Journal des choix pris sans validation explicite du propriétaire, conformément
au brief §17 (« choisir l'interprétation la moins risquée et la consigner »).

## Architecture

### D1 — Backend Node + SQLite au lieu de Java 21 + Spring Boot
Le brief recommande Java/Spring/PostgreSQL (§13) mais autorise les choix
techniques « sauf incompatibilité avec le dépôt existant ». Le prototype devait
tourner sur une seule machine, sans Java ni Docker. `node:http` + `node:sqlite`
supprime tout déploiement. Le moteur reste isolé, donc un portage serveur est
possible sans réécrire les règles.

### D2 — Moteur en TypeScript partagé client/serveur
Le moteur pur (`src/engine/`) est importé par l'interface **et** par l'API.
Une seule vérité de règles. Déterminisme garanti par un RNG à graine.

### D3 — Pas de Lottie ni de bibliothèque d'animation
Animations CSS/SVG uniquement (flash de carte, halos, barres). Respecte les
appareils modestes et la réduction d'animations.

## Règles

### D4 — Deux Terrain, pas de destruction mutuelle
Chaque joueur a son Terrain ; les deux coexistent (brief §4). Activer un Terrain
au-dessus d'un autre remplace **le sien** et envoie l'ancien au Cimetière.
Aucun Terrain ne détruit celui de l'adversaire.

### D5 — Priorité du Terrain le plus récent
`terrainOrder` est un compteur global incrémenté à chaque activation. Il n'a
d'effet que si deux effets continus deviennent incompatibles. Avec les cartes
actuelles (bonus additifs sur son propre camp) aucun conflit ne peut survenir :
la priorité est donc **enregistrée et exposée**, mais sans effet visible.

### D6 — Le premier joueur n'attaque pas au tour 1
Interprétation de la demande du propriétaire. Le tour 1 appartient toujours à
`firstSide` ; seul ce joueur est bloqué, et seulement pendant le tour 1.
Implémenté par `isOpeningTurnFor()` dans le moteur et `legalActions()`, donc
l'IA est soumise à la même règle.

### D7 — Inactivité mesurée sur le tour du joueur
120 s sans action **pendant son propre tour** ⇒ défaite. Hors tour du joueur ou
pendant le tour de l'IA, le compteur est remis à zéro : on ne peut pas perdre
pendant que l'adversaire réfléchit.

### D8 — Coût d'un effet payé avant la résolution
Le coût (LP, sacrifice, défausse) est prélevé à l'activation, avant la chaîne.
Une annulation ultérieure ne rembourse pas (brief §7).

### D9 — Suspension plutôt que vainqueur arbitraire
À 100 maillons, le duel est marqué `suspended` avec un `diagnostic`.
Aucun vainqueur n'est désigné automatiquement.

## Données et assets

### D10 — Illustrations indexées par manifeste
Le brief impose des noms de fichiers stables. Un manifeste généré
(`src/data/art-manifest.json`) évite de coder en dur les extensions et permet de
déposer `.png`, `.jpg`, `.jpeg`, `.webp` ou `.svg` sans toucher au code.
Priorité : raster > SVG placeholder.

### D11 — Cartes envoyées entières par le propriétaire
Quand une image fournie est une carte complète (cadre + texte), elle est
**recadrée** sur la zone d'illustration avant d'être déposée, pour ne pas
dupliquer le cadre dessiné par l'interface (brief §12 : les éléments de règles
restent des éléments d'interface).

### D12 — Aucune illustration sous licence téléchargée
L'agent n'intègre que les images fournies par le propriétaire. Aucune
vérification de licence n'est prétendue.

## Interface

### D13 — Coquille de jeu plutôt que site web
Le brief (§12) demande « un jeu abouti, pas un tableau d'administration ».
D'où un HUD fixe (profil, XP, ressources, onglets) à la place d'une barre de
navigation, et la suppression du pied de page textuel.

### D14 — Pile Extra mise en avant
Quand une invocation spéciale est disponible (à vous, en Main Phase, conditions
remplies), la pile Extra brille et un panneau liste les cartes invocables avec un
bouton par carte.

## Économie

### D15 — Économie locale, calculée par le module partagé
Les boosters sont tirés par `src/engine/economy.ts`, importé par le client **et**
par l'API. Le serveur recalcule le tirage à partir de la graine et de son propre
état de pity : le client ne peut pas choisir ses cartes. Le coût est débité et la
collection créditée dans la même transaction SQLite.

### D16 — Pity appliquée à la dernière carte
Quand un palier est atteint (6e sans Epic+, 20e sans Legendary+, 50e sans Ultra),
la **10e carte** est promue au minimum garanti. Cela rend le résultat lisible et
vérifiable sans changer les taux des neuf premières cartes.

### D17 — Pas de lot de 10 boosters
Le brief prévoit « ouverture 1 ou 10 boosters ». Seule l'ouverture unitaire est
livrée : le lot de 10 n'apporte pas de valeur de démonstration et multiplie les
cas d'erreur (coût, pity par booster). À ajouter si le propriétaire le souhaite.

### D18 — JM gagnés en duel
Le brief cite « récompenses de duel » parmi les voies d'obtention. Valeurs
initiales : +60 JM par victoire, +20 JM par défaite, +30 XP / +10 XP.
Aucun achat réel, aucun transfert entre joueurs.

## Moteur

### D19 — Modificateurs de statistiques
`statsFor` applique dans l'ordre : valeur imprimée → `setStats` (fixe) →
additifs (`buff`, tour, équipement) → `multiplyStats` → plancher à 0.
Les cartes actuelles n'utilisent que les additifs ; les deux autres opérations
sont prêtes et testées pour les futurs contenus.

### D20 — Limites d'effet
`oncePerTurn` et `oncePerDuel` partagent la même liste `usedEffects` avec des clés
différentes (`<id>@<tour>` et `<id>@duel`). Un effet marqué `oncePerDuel` n'est
jamais réutilisé, même après changement de tour.

### D21 — IA avancée et experte
- Avancée : score heuristique + détection de coup létal.
- Experte : sur les 8 meilleurs coups, simulation d'un demi-coup (meilleure
  réponse adverse parmi 12) puis choix de l'évaluation la plus défavorable.
Les deux n'utilisent que des informations publiques.

### D22 — Combat en quatre sous-étapes journalisées
Battle Start → Battle Step → Damage Step → Battle End, sans état intermédiaire
persistant : la résolution reste atomique pour ne pas bloquer l'UI, mais chaque
étape produit un événement lisible dans le journal et le replay.

### D23 — Sémantique des capacités de combat
Le brief liste contre-attaque, réflexion et absorption sans définir leur
résolution. Interprétation retenue, documentée dans `GAME_RULES.md` :
- `counterAttack` : après le Damage Step, si la cible est toujours sur le terrain,
  elle détruit l'attaquant.
- `reflect` : les dégâts de combat destinés au camp de la cible sont infligés au
  contrôleur de l'attaquant.
- `absorb` : les dégâts de combat destinés au camp de la cible deviennent 0.
Les capacités sont lues **avant** la destruction du personnage.

### D24 — ELO 1v1 local
Calculé côté client après chaque duel et persisté dans `profile.elo`. K = 40 sur
les 20 premiers duels, 24 ensuite, 16 au niveau 50+. La saison dure 8 semaines
et applique `1000 + 0,75 × (ELO − 1000)`. Aucun classement en ligne.

### D25 — Campagne locale à 3 chapitres
Trois missions avec decks thématiques fixes, difficulté croissante et récompense
en JM. La progression est stockée dans `localStorage` ; le duel est un duel
classique, donc enregistré dans l'historique.

### D26 — Audio généré, aucun fichier
Les effets sonores sont synthétisés par Web Audio (oscillateurs courts). Cela
évite d'embarquer des assets audio sous licence et respecte l'option « sons
facultatifs » du brief. Désactivables depuis le HUD.

### D27 — Extension du catalogue à 160 cartes
Le brief fixe une cible initiale de 120 ; le propriétaire a demandé davantage de
cartes. Ajout de 40 cartes (16 personnages, 5 techniques, 3 équipements,
3 soutiens, 4 magies, 3 pièges, 2 terrains, 4 invocations spéciales) réparties
dans les 8 univers existants. Les compteurs attendus par le validateur et les
tests ont été mis à jour en conséquence.

### D28 — Ciblage appliqué à la destruction
`targeting` est propagé de la définition d'effet jusqu'au contexte d'exécution.
`targetImmune` ne protège que si l'effet est `targeted` (valeur par défaut).
`destroyImmune` continue de s'appliquer quel que soit le ciblage.
`tec-masse` est passé en `untargeted` pour illustrer la distinction.

### D29 — Catalogue généré par gabarits
Pour atteindre 360 cartes sans écrire 360 blocs à la main, les 200 dernières
cartes sont générées par rôles (bruiser / guardian / trickster / support) et par
gabarits d'effets, avec des identifiants stables (`chr-x001`, `tec-x001`…).
Les valeurs restent déclaratives, validées par le script, et peuvent être
remplacées carte par carte sans changer le moteur.

### D30 — Correctif `grantKeyword` sur `equipped`
`runOps` traitait la cible `equipped` comme `self`, ce qui rendait inopérants
les équipements accordant un mot-clé. La cible est désormais résolue correctement
(porteur de l'équipement).

### D31 — Missions quotidiennes et hebdomadaires
Trois quotidiennes et deux hebdomadaires, définies dans `src/engine/missions.ts`.
La période est calculée en UTC (jour `AAAA-MM-JJ`, semaine ISO `AAAA-Sxx`) et la
progression est stockée en `localStorage`. Réclamer une mission crédite les JM une
seule fois ; le compteur est plafonné au but.

### D32 — Duel classé vs amical
Le mode est choisi à l'écran de préparation. Seul le classé met à jour l'ELO :
`recordMatch` reçoit `{ ranked }` et conditionne le calcul. Les deux modes
alimentent l'historique, les missions et les JM.

### D33 — Conservation des replays : 90 jours
Valeur initiale du brief. Le client filtre à l'affichage et l'API supprime les
lignes trop anciennes à chaque lecture de l'historique.

### D34 — Booster événementiel
Quatrième type de booster (§10 « événementiel »), 320 JM, 10e carte garantie
Legendary ou mieux. Le champ `lastFloor` remplace l'ancien `premiumGuarantee` et
couvre les quatre types.

## Hors périmètre assumé

2v2, réseau, spectateur, tournois, ELO, boutique, boosters, campagne, audio.
Le brief (§14 phase 8) les place après validation, et interdit les boutons
fictifs : ils ne sont donc pas affichés.
