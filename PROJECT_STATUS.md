# PROJECT STATUS

Mis à jour après l'ajout des Terrrains, de l'inactivité, du replay, du tutoriel
et des documents du brief §15.

## Phases du brief

| Phase | État | Notes |
|---|---|---|
| 0 — Audit et plan | ✅ | `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `DECISIONS.md` |
| 1 — Fondations | ✅ | Vite + Vue 3 + TS, API locale, SQLite, catalogue JSON |
| 2 — Design system et écrans | ✅ | HUD de jeu, accueil, collection, détail, deck builder, terrain de duel |
| 3 — Moteur 1v1 | ✅ | Phases, zones, LP, pioche, invocations, positions, combat, victoire |
| 4 — Effets et invocations | ✅ | Effets structurés, chaînes, vitesses, annulation, 5 invocations spéciales |
| 5 — Contenu de démo | ✅ | 360 cartes (164/41/25/25/34/23/14/34) |
| 6 — IA et parcours complet | ✅ | IA débutante, normale, avancée, experte, tutoriel, duel complet, historique, persistance |
| 7 — Polish et démo | 🟡 | Animations, sons (Web Audio), états vide/erreur/chargement, réduction d'animations ; captures impossibles ici |
| 8 — Extensions | 🟡 | Économie, ELO/saisons et campagne livrés ; réseau/2v2/tournois volontairement non commencés |

## Fonctionnalités livrées

### Jeu
- **360 cartes** réparties par catégorie, raretés Common → Ultra Legendary,
  dont 240 ajoutées au fil des extensions (nouvelles capacités, modificateurs
  multiplicatifs, ciblage).
- **Ciblage des effets** : `targeted` / `untargeted` / `global` ; « Ciblage
  impossible » ne protège que des effets ciblés.
- Collection filtrable (recherche, univers, catégorie, rareté, tri, possédées).
- Deck Builder : 44–64 cartes, 3 exemplaires max, Extra Deck ≤ 20, validation stricte.
- Duel 1v1 : 10 000 LP, 6 phases, 5+5 zones et 1 zone Terrain par joueur.
- Combat ATK/ATK, ATK/DEF, attaque directe, piercing, double attaque.
- Effets, chaînes, vitesses, annulation, plafond de 100 maillons (suspension + diagnostic).
- Les 5 invocations spéciales, chacune testée (positif / négatif).
- IA à information partielle, **quatre difficultés** (débutante, normale, avancée, experte).
- **Terrain** : un Terrain actif par camp, remplacement → Cimetière, effet continu,
  ordre de priorité du Terrain le plus récent, refus de pose face cachée.
- **Modificateurs de statistiques** : additifs, fixes (`setStats`) et multiplicatifs
  (`multiplyStats`), plancher à 0 (brief §6).
- **Limites d'effet** : une fois par tour **et une fois par duel** (brief §7).
- **Défaite par inactivité** : 120 s sans action pendant son tour.
- **Règle du premier tour** : le premier joueur n'attaque pas au tour 1.
- Chronomètre de tour de 3 min 30.
- **Replay** du journal d'événements (lecture, pause, pas à pas, retour au début),
  y compris pour les duels archivés depuis le profil.
- **Tutoriel court** (5 étapes) au premier duel.
- **Économie** : Jetons Multivers gagnés en duel, quatre boosters (classique,
  thématique, premium, événementiel), tirage 10 cartes avec garantie sur la 10e,
  **pity** aux paliers 6 / 20 / 50, révélation carte par carte, achat à l'unité ou
  **×10**, persistance collection + pity.
- **Missions** : 3 quotidiennes + 2 hebdomadaires, progression persistée, récompenses JM.
- **Duel classé / amical** : l'ELO ne bouge qu'en classé.
- **Conservation des replays** : purge automatique au-delà de 90 jours (client + API).
- **Scénario reproductible** : même graine + mêmes actions ⇒ même duel (testé).
- **Combat détaillé** : sous-étapes Battle Start / Battle Step / Damage Step /
  Battle End journalisées ; cible ayant quitté le terrain ⇒ aucun dégât.
- **Capacités de combat** : transperce, attaque double, immunités, **contre-attaque**,
  **réflexion**, **absorption**.
- **ELO 1v1 local et saisons** : K 40/24/16, saison de 8 semaines, reset doux,
  affichage dans le profil.
- **Campagne** : 3 chapitres, decks thématiques, difficulté croissante, récompense
  en JM, progression locale.
- **Audio** : effets sonores générés par Web Audio (aucun fichier), désactivables.

### Technique
- Moteur pur, déterministe, sans dépendance Vue/DOM.
- Actions typées, aucune exécution de code dans les données.
- Persistance SQLite + repli `localStorage` hors ligne.
- Export de sauvegarde JSON, `npm run backup`.
- Manifeste d'illustrations : déposer une image suffit (`npm run art`).
- Réduction des animations (bouton + `prefers-reduced-motion`).

## Vérifications disponibles

| Commande | Portée |
|---|---|
| `npm run typecheck` | TypeScript + templates Vue |
| `npm test` | Moteur : catalogue, decks, combat, chaînes, invocations, terrains, IA |

Note : dans l'environnement de l'agent, Vitest/Vite ne peuvent pas démarrer
(création de processus bloquée). Les vérifications moteur ont donc été exécutées
via une compilation `tsc` + scripts Node : **8/8 contrôles** et **15/15 duels IA**
terminés, 0 action illégale, 0 attaque au tour 1, activations de Terrain observées.

## Limites connues

1. **Vitest non exécuté ici** : les tests existent mais n'ont pas pu être lancés dans
   l'environnement de l'agent (création de processus bloquée). À exécuter sur la
   machine du propriétaire.
2. **Captures d'écran** : impossibles à produire ici — le navigateur headless ne peut
   pas démarrer (pipes/Mojo bloqués par le sandbox). À produire avec `Voir l'apercu.bat`.
3. **Duel en réseau, 2v2, spectateur, tournois** : non implémentés et **non simulés**
   dans l'interface (brief §14 phase 8).
4. **Effets ciblés vs non ciblés vs globaux** (§7) : le champ `targeting` est
   exploité pour la destruction ; les autres opérations restent non ciblées par défaut.
5. **Serveur Java/PostgreSQL** du brief §13 : remplacés par Node/SQLite (voir DECISIONS.md D1).

## Prochaines tâches recommandées

1. Lancer `npm test` et `npm run build` sur la machine du propriétaire.
2. Ajouter les vraies illustrations (déposer les fichiers + `npm run art`).
3. Produire les captures d'écran avec `Voir l'apercu.bat`.
4. Exploiter `targeting` dans la résolution des effets.
5. Envisager 2v2 / réseau uniquement après validation du 1v1.
