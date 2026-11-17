# MULTIVERSE CARTOON TCG — Prototype local

Prototype **local et privé** de jeu de cartes à collectionner 1v1 contre une IA.
Aucune donnée n'est envoyée sur Internet ; tout tourne sur la machine.

## Démarrage rapide

Prérequis : Node.js 20+ (testé sur Node 24). Java/PostgreSQL **ne sont pas** nécessaires.

```bash
npm install      # une seule fois
npm run dev      # API (8787) + interface (5173)
```

Puis ouvrir <http://127.0.0.1:5173>.

Sur Windows, le plus simple reste de **double-cliquer sur `Lancer le jeu.bat`**.
`Voir l'apercu.bat` ouvre une maquette statique (`preview.html`) sans rien installer.

### Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | API locale + Vite |
| `npm run dev:api` | API seule (port 8787) |
| `npm run dev:web` | Interface seule (port 5173) |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript (`vue-tsc`) |
| `npm test` | Tests moteur (Vitest) |
| `npm run art` | Régénère l'index des illustrations |
| `npm run assets` | Régénère les illustrations placeholder |
| `npm run backup` | Sauvegarde de la base SQLite |

## Illustrations des cartes

Déposez une image nommée `<id-de-carte>` avec l'extension `.png`, `.jpg`, `.jpeg`
ou `.webp` dans le bon dossier de `public/assets/cards/` :

```
public/assets/cards/characters/chr-bob.jpg
public/assets/cards/terrains/ter-cite.webp
public/assets/cards/magics/mag-gel.png
```

Puis `npm run art` (déjà lancé automatiquement avant `dev` et `build`).
Le fichier `src/data/art-manifest.json` est régénéré et la carte affiche
l'image ; à défaut, le placeholder SVG reste utilisé.

Formats acceptés : une illustration seule de préférence (ratio ~5:6).
Une carte complète envoyée par le propriétaire doit être recadrée sur la zone
d'illustration avant d'être déposée.

## Fonctionnalités

- 360 cartes jouables : 164 personnages, 41 techniques, 25 équipements,
  25 soutiens, 34 magies, 23 pièges, 14 terrains, 34 invocations spéciales.
- Collection filtrable, détail de carte, Deck Builder à validation stricte.
- Duel 1v1 : 10 000 LP, 6 phases, 5 zones Personnage, 5 zones Magie/Piège,
  1 zone Terrain, Extra Deck.
- Effets structurés, chaînes et vitesses (1/2/3), annulation, plafond de 100 maillons.
- Les 5 invocations spéciales : Crossover, Éveil, Sacrifice, Dimensionnelle, Résonance.
- Modificateurs ATK/DEF additifs, fixes et multiplicatifs ; limites une fois par tour
  ou une fois par duel.
- Combat en sous-étapes (Battle Start → Damage Step → Battle End), transperce,
  attaque double, immunités, contre-attaque, réflexion, absorption.
- IA à information partielle, quatre difficultés (débutante → experte).
- Défaite : LP à 0, deck vide, abandon, inactivité de 2 minutes.
- Chronomètre de tour de 3 min 30.
- Boutique : Jetons Multivers, quatre boosters (classique, thématique, premium,
  événementiel), tirage 10 cartes, pity 6/20/50, révélation carte par carte,
  achat à l'unité ou ×10.
- Missions quotidiennes et hebdomadaires avec récompenses en JM.
- Duel **classé** (ELO) ou **amical** (sans ELO).
- Campagne : 3 chapitres à difficulté croissante, récompenses en JM.
- ELO 1v1 local, saisons de 8 semaines, reset doux.
- Effets sonores optionnels (Web Audio, aucun fichier audio).
- Sauvegarde SQLite locale, historique des duels (conservation 90 jours), export JSON.
- Replay du journal d'événements (duel en cours et duels archivés).
- Tutoriel court au premier duel.
- Réduction/désactivation des animations.

## Ce qui n'est pas implémenté

Conformément au brief (§14, phase 8), ces éléments restent **hors de l'interface**
tant qu'ils ne sont pas réellement développés :

2v2, multijoueur réseau, spectateur, tournois, ELO et saisons, boutique,
boosters, campagne, création de cartes, échange entre joueurs, audio.

Aucun bouton fictif n'est affiché pour ces fonctions.

## Problèmes courants

### `EADDRINUSE` sur 8787 ou Vite qui démarre sur 5174
Une ancienne instance du prototype tourne encore. Deux solutions :

```bash
node scripts/free-ports.mjs --kill   # arrête les anciennes instances node
npm run dev
```

ou double-cliquez sur **`Arreter le jeu.bat`** puis sur **`Lancer le jeu.bat`**.

Le lanceur appelle déjà `free-ports` avant de démarrer : il ne tue que les
processus **node** qui occupent 8787 ou 5173, jamais un autre programme.

### Le navigateur affiche une page blanche
Ouvrez l'URL exacte affichée par Vite (`Interface : http://localhost:XXXX`).
Vite écoute sur `localhost` (IPv6) : `127.0.0.1` peut ne pas répondre.

## Sauvegarde et restauration

Les données vivent dans `data/multiverse.db` (SQLite). Si l'API est injoignable,
l'interface bascule en mode navigateur (`localStorage`) et l'indique dans le HUD.

- Export : Profil → « Exporter la sauvegarde » (JSON).
- Restauration : arrêter l'application, remplacer `data/multiverse.db` par une copie,
  ou utiliser `npm run backup`.

## Documentation

- [GAME_RULES.md](GAME_RULES.md) — règles appliquées par le moteur.
- [ARCHITECTURE.md](ARCHITECTURE.md) — organisation du code.
- [GRAPHICS.md](GRAPHICS.md) — comment améliorer le rendu visuel.
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — état d'avancement et limites.
- [DECISIONS.md](DECISIONS.md) — choix techniques et interprétations.
