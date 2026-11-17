# ARCHITECTURE

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│  Interface Vue 3 (src/)                                      │
│    vues ── stores Pinia ── composants                         │
│                  │                                           │
│                  ▼                                           │
│  Moteur de duel pur (src/engine/) — aucune dépendance Vue    │
│    duel.ts · ai.ts · deck.ts · catalog.ts · rng.ts · types.ts│
└──────────────────┬───────────────────────────────────────────┘
                   │ fetch /api
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  API locale Node (server/index.ts)                           │
│    node:http · node:sqlite · data/multiverse.db              │
└──────────────────────────────────────────────────────────────┘
```

Le moteur est **l'autorité** : il valide tours, phases, zones, LP, pioches,
actions légales, invocations, attaques, effets, chaînes et victoire.
Le client ne calcule jamais seul le résultat d'un duel.

## Dossiers

```
src/
  engine/        moteur pur, testable, sans Vue ni DOM
    types.ts     types du domaine (Action, DuelState, CardDef…)
    duel.ts      règles : phases, combat, effets, chaînes, invocations
    ai.ts        IA à information partielle (débutant / normal)
    deck.ts      construction et validation de deck
    catalog.ts   accès au catalogue + URL d'illustration
    rng.ts       générateur déterministe (même graine ⇒ même duel)
    progress.ts  niveaux de compte et XP
  stores/        état d'interface (Pinia)
    profile.ts   profil, collection, decks, matches, persistance
    duel.ts      déroulement d'un duel, IA, chronomètres, inactivité
  views/         écrans (accueil, collection, deck builder, duel, profil)
  components/    CardFace, CardDetail, ZoneSlot, LoadingScreen
  styles/        main.css (design system), screens.css (écrans), home.css
  data/          cards.json, universes.json, decks.ts, seed.ts, art-manifest.json
server/index.ts  API REST locale + SQLite
scripts/         catalogue, assets, manifeste d'illustrations, dev, backup
tests/           tests moteur (Vitest)
public/assets/   illustrations de cartes et éléments d'interface
```

## Flux d'un duel

1. `DuelView` → `duelStore.start(firstSide, difficulty)`.
2. `createDuel()` construit l'état initial (mains, decks, LP).
3. L'interface appelle `legalActions(state, 'player')` : le moteur renvoie
   **uniquement les coups légaux**, avec un libellé prêt à afficher.
4. `duelStore.act(action)` → `applyAction(state, action, side)` qui **clone** l'état,
   valide, applique, journalise puis renvoie le nouvel état.
5. L'IA tourne avec `aiChooseAction(state, difficulty)` sur le même moteur.
6. Fin : `finish()` enregistre le match via l'API (ou `localStorage` hors ligne).

Déterminisme : `applyAction` est pure ; une même graine et les mêmes actions
produisent le même duel.

## Données de cartes

`src/data/cards.json` est déclaratif. Aucune carte ne peut exécuter de code :
les effets sont des opérations typées (`damage`, `heal`, `draw`, `buff`, `destroy`,
`discard`, `banishTop`, `grantKeyword`, `gyToHand`, `negate`).

## Illustrations

`scripts/art-manifest.mjs` indexe `public/assets/cards/**` et écrit
`src/data/art-manifest.json`. `artUrl(card)` lit ce manifeste ; à défaut il retombe
sur le placeholder SVG du même nom. Déposer une image et lancer `npm run art`
suffit, aucun code à modifier.

## API locale

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | état du serveur |
| GET | `/api/bootstrap` | profil + collection + decks + matches |
| PUT | `/api/profile` | nom du profil |
| POST | `/api/decks` | créer / mettre à jour un deck |
| DELETE | `/api/decks/:id` | supprimer un deck |
| POST | `/api/matches` | enregistrer un duel terminé |
| GET | `/api/backup` | export JSON |

Base : SQLite via `node:sqlite`, fichier `data/multiverse.db`.
Si l'API est indisponible, l'interface bascule en `localStorage` (`offline`).

## Choix structurants

- **Pas de dépendance serveur externe** : `node:http` + `node:sqlite`.
- **Moteur séparé de l'interface** : il pourrait tourner côté serveur sans changement.
- **Actions typées** : aucune chaîne de commande, aucune évaluation dynamique.
- **Déterminisme** : RNG à graine, tests reproductibles.
