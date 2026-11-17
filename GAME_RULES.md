# RÈGLES IMPLÉMENTÉES — MULTIVERSE CARTOON TCG

Ce document décrit les règles **réellement appliquées par le moteur**
(`src/engine/duel.ts`). Il ne décrit pas les extensions futures.

## 1. Mise en place

- 10 000 LP par joueur.
- Main initiale de 6 cartes, **sans mulligan**.
- Détermination du premier joueur par pierre-feuille-ciseaux ; en cas d'égalité,
  on recommence. Le gagnant choisit qui commence.
- Le premier joueur **ne pioche pas** à son premier tour.
- Aucune limite maximale de main. Une main vide ne provoque pas la défaite.

## 2. Phases d'un tour

`Draw` → `Standby` → `Main 1` → `Battle` → `Main 2` → `End`

Plusieurs invocations sont possibles dans un même tour si les conditions sont
respectées : aucune limite universelle d'une invocation normale par tour.

## 3. Zones

Chaque joueur dispose de :

- 5 zones Personnage ;
- 5 zones Magie/Piège ;
- 1 zone Terrain ;
- 1 Deck principal, 1 Extra Deck, 1 Cimetière, 1 zone bannie.

Placement :

| Catégorie | Destination |
|---|---|
| Personnage | zone Personnage |
| Technique temporaire | activation depuis la main puis Cimetière |
| Technique persistante / Équipement | zone Magie/Piège |
| Soutien | selon sous-type |
| Magie / Piège | zone Magie/Piège |
| Terrain | zone Terrain |
| Invocation spéciale | zone Personnage |

Une carte invoquée reste sur le terrain jusqu'à destruction ou déplacement par
effet. Aucun retour automatique à l'Extra Deck.

## 4. Terrain

- Chaque joueur possède **son propre** Terrain actif ; les deux coexistent.
- Un Terrain s'**active** depuis la main, en Main Phase uniquement. Il ne se pose
  pas face cachée.
- Activer un Terrain alors qu'un autre est actif **remplace** l'ancien, qui part au
  Cimetière.
- Le Terrain fournit un effet **continu** à vos personnages tant qu'il est actif.
- Ordre de priorité : le Terrain **activé le plus récemment** a la priorité sur un
  point de conflit éventuel (`terrainOrder`). Un Terrain ne détruit jamais celui de
  l'adversaire.

## 5. Invocation normale

- Un personnage peut être invoqué en position d'attaque ou de défense.
- Les personnages puissants exigent des **sacrifices** : le nombre est indiqué sur la
  carte (`tributes`). Les sacrifices partent au Cimetière.
- Poser une carte face cachée la place en position de défense.
- Aucun système d'énergie, de mana ou de ressource de paiement.

## 6. Combat

- Seul un personnage en **position d'attaque**, face visible, peut attaquer.
- Chaque personnage attaque une fois par tour (`doubleAttack` : deux fois).
- Changement de position : une fois par tour du contrôleur, en Main Phase,
  uniquement si le personnage n'a pas attaqué ce tour.

Résolution :

| Situation | Résultat |
|---|---|
| ATK attaquant > ATK défenseur | défenseur détruit, différence en LP |
| ATK attaquant < ATK défenseur | attaquant détruit, différence en LP |
| ATK égales | les deux détruits, aucun LP perdu |
| ATK attaquant > DEF défenseur | défenseur détruit, aucun LP (sauf `piercing`) |
| ATK attaquant < DEF défenseur | aucun détruit, aucun LP |
| ATK = DEF | aucun détruit |
| Aucun personnage adverse | attaque directe, dégâts = ATK |

Les statistiques ne sont jamais négatives. Ordre de calcul : valeur imprimée →
statistiques fixées (`setStats`) → bonus additifs (buff, tour, équipement) →
multiplicateurs (`multiplyStats`) → plancher à 0.

### Sous-étapes du combat

Chaque attaque est résolue en quatre étapes journalisées (brief §6) :

1. **Battle Start** — déclaration, consommation de l'attaque du tour ;
2. **Battle Step** — révélation de la cible, vérification qu'elle est toujours sur le terrain ;
3. **Damage Step** — statistiques figées, calcul des dégâts et destructions ;
4. **Battle End** — clôture.

Si la cible quitte le terrain avant le Damage Step, aucun dégât n'est appliqué.

### Capacités de combat

| Capacité | Effet |
|---|---|
| `piercing` | Transperce : la différence ATK−DEF est infligée après destruction en défense |
| `doubleAttack` | Attaque deux fois par tour |
| `destroyImmune` | Ne peut pas être détruit par un effet |
| `targetImmune` | Ne peut pas être ciblé par les effets de destruction |
| `counterAttack` | Contre-attaque : détruit l'attaquant après le calcul |
| `reflect` | Réflexion : les dégâts de combat subis sont renvoyés à l'attaquant |
| `absorb` | Absorption : annule les dégâts de combat subis |

### Règle du premier tour

Le joueur qui ouvre le duel **ne peut pas attaquer lors du tour 1**.
Le second joueur peut attaquer dès son premier tour (tour 2).

## 7. Effets et chaînes

- Vitesses : Speed 1 ne répond pas à une activation engagée ; Speed 2 répond aux
  vitesses 1 et 2 ; Speed 3 répond à 1, 2 et 3. Une vitesse inférieure ne répond
  jamais à une vitesse supérieure.
- Résolution en ordre inverse d'activation.
- Plafond de sécurité : 100 maillons. À l'atteinte, le duel est **suspendu** et un
  diagnostic est enregistré — aucun vainqueur arbitraire.
- Coûts possibles : défausser, sacrifier, perdre des LP, bannir, déplacer une carte.
  Un coût payé n'est pas remboursé.
- Le duel distingue destruction, envoi au Cimetière, bannissement et retour en main.
- **Ciblage** : un effet peut être `targeted` (défaut), `untargeted` ou `global`.
  `Ciblage impossible` (`targetImmune`) protège **uniquement** des effets ciblés ;
  un effet non ciblé ou global l'ignore, mais reste bloqué par
  `Immunité à la destruction` (`destroyImmune`).

## 8. Les cinq invocations spéciales

1. **Crossover** — au moins deux personnages compatibles d'univers différents.
2. **Éveil** — transforme un personnage présent en nouvelle forme depuis l'Extra Deck.
3. **Sacrifice** — consomme un ou plusieurs personnages comme matériaux.
4. **Dimensionnelle** — conditions liées aux cartes bannies, au Cimetière, aux LP.
5. **Résonance** — personnages partageant un tag / une compatibilité.

Chaque invocation exige que ses conditions soient vérifiées et qu'une zone
Personnage soit libre. Chaque méthode est un module de règles testable
(`checkSpecial`, `performSpecialSummon`).

## 9. Fin de duel

Défaite si :

- LP à zéro ;
- pioche obligatoire impossible (deck vide) ;
- abandon volontaire ;
- **inactivité continue de 2 minutes** ;
- défaite simultanée causée par un effet : le contrôleur de l'effet l'emporte.

Le joueur qui ne peut plus piocher perd au moment du pioche.

## 10. Temps

- Durée maximale d'un tour : **3 min 30**. À expiration : le tour se termine et la
  main passe.
- Inactivité : **120 s** sans action pendant son propre tour → défaite.

## 11. Popularité, ATK, DEF et rareté

| Terme | Sens |
|---|---|
| Popularité (1–12) | reconnaissance culturelle du personnage, **pas** sa puissance |
| ATK | valeur d'attaque |
| DEF | valeur de défense |
| Rareté | valeur de collection (Common → Ultra Legendary) |
| Niveau du compte | progression du joueur (1–100), aucun avantage en duel |

Le mot « niveau » ne désigne jamais la puissance d'un personnage.

## 12. Progression et économie

- XP : +30 par victoire IA, +10 par défaite. Niveau du compte 1–100.
- **ELO 1v1 local** : départ 1000, K = 40 sur les 20 premiers duels, puis 24
  (16 au niveau 50+). Saison de 8 semaines, reset doux `1000 + 0,75 × (ELO − 1000)`.
- **Jetons Multivers (JM)** : +60 par victoire, +20 par défaite. Jamais utilisés
  pendant un duel.
- **Boosters** : 10 cartes, coût 100 (classique) / 120 (thématique) / 240 (premium) /
  320 (événementiel). 9 premières cartes aux taux 70/22/6/1,7/0,3 % ; 10e garantie
  Rare+ (Epic+ en premium, Legendary+ en événementiel).
  Pity : 6e booster sans Epic+, 20e sans Legendary+, 50e sans Ultra.
- **Missions** : 3 quotidiennes (2 duels, 1 victoire, 1 booster) et 2 hebdomadaires
  (8 duels, 3 invocations spéciales), récompensées en JM. Compteurs remis à zéro
  au changement de jour / de semaine ISO.
- **Duel classé / amical** : seul le classé modifie l'ELO ; les deux comptent pour
  l'historique et les missions.
- **Campagne** : 3 chapitres, decks thématiques, récompense en JM à la victoire
  (duels amicaux, sans ELO).
- **Replays** : journal conservé 90 jours, puis purgé automatiquement.
