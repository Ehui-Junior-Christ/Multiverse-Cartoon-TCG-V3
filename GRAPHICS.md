# GUIDE GRAPHIQUE — rendre le jeu beau

Ce document liste, par ordre d'impact, ce qui améliore réellement le rendu,
et ce qui est déjà en place dans le prototype.

---

## 1. Le levier n°1 : les illustrations des cartes

Le cadre, les animations et la typographie sont déjà soignés. Ce qui sépare
le prototype d'un jeu « premium », ce sont **les illustrations**. Aujourd'hui
ce sont des placeholders SVG (dégradé + initiales).

### Comment les brancher

1. Nommez le fichier avec l'**identifiant de la carte** :
   `chr-bob.webp`, `ter-nuit.webp`, `mag-gel.webp`.
2. Déposez-le dans le dossier de sa catégorie :

   ```
   public/assets/cards/characters/   → personnages
   public/assets/cards/techniques/   → techniques
   public/assets/cards/equipments/   → équipements
   public/assets/cards/supports/     → soutiens
   public/assets/cards/magics/       → magies
   public/assets/cards/traps/        → pièges
   public/assets/cards/terrains/     → terrains
   public/assets/cards/specials/     → invocations spéciales
   ```

3. Lancez `npm run art` (déjà appelé avant `dev` et `build`).

Le manifeste `src/data/art-manifest.json` est régénéré et la carte affiche
l'image. Aucun code à modifier.

### Spécifications techniques

| Point | Recommandation |
|---|---|
| Format | **WebP** qualité 85 (fallback `.jpg` accepté) |
| Dimensions | 1024 × 1280 px minimum (ratio ~4:5) |
| Poids | < 250 Ko par image |
| Cadrage | sujet centré, tête dans le tiers haut, pas de texte dans l'image |
| Fond | illustré et plein (pas de transparence) : l'art remplit le cadre |

Une image de carte **complète** (avec cadre et texte imprimés) doit être
recadrée sur la zone d'illustration avant dépôt — sinon le cadre est dessiné
deux fois.

### Cohérence de style

- Même direction artistique sur tout le catalogue : trait cartoon épais,
  couleurs saturées, lumière chaude, ombres colorées.
- Une palette par univers (elle est déjà définie dans `universes.json` via `hue`) :
  gardez le même éclairage dominé par cette teinte.
- Évitez les fonds blancs ou gris : ils cassent l'ambiance sombre de l'interface.
- Si vous générez les images (IA ou illustrateur), imposez : « cel-shaded cartoon,
  thick outlines, dramatic rim light, vibrant colors, centered character,
  no text, no logos ».

### Ce qui a déjà été fait comme exemple

`chr-bob.jpg` et `chr-patrick.jpg` : illustrations recadrées depuis vos images
de référence. Elles montrent le rendu attendu (plein cadre, sujet lisible).

---

## 2. Le système de rareté (déjà en place, à exploiter)

Chaque rareté a un traitement visuel distinct qui doit rester **lisible** :

| Rareté | Traitement | Fichier |
|---|---|---|
| Common | cadre gris-bleu, aucun effet | `main.css` `.rarity-common` |
| Rare | cadre cyan, halo léger | `.rarity-rare` |
| Epic | cadre violet, halo marqué | `.rarity-epic` |
| Legendary | cadre or + **balayage holographique** | `.rarity-legendary` |
| Ultra | cadre or clair + **prisme animé** | `.rarity-ultra` |

Règle : plus la rareté monte, plus l'effet est **périphérique** (bord, halo,
reflet). Le centre de la carte reste toujours net et contrasté.

---

## 3. Typographie

- **Titres / noms de cartes** : `Bricolage Grotesque` (800).
- **Interface** : `Chakra Petch` (400/600/700).
- Tailles : nom de carte ≈ 7 % de la largeur de carte ; texte d'effet ≈ 5 % ;
  libellés d'interface 11–13 px.
- Deux poids maximum par écran. Éviter l'italique hors phrases signature.
- Contraste minimal 4,5:1 : sur une illustration chargée, garder le voile sombre
  (`background: rgba(4,6,16,.62)`) derrière le texte d'effet.

---

## 4. Couleur, lumière et hiérarchie

- Une seule couleur d'action par écran : l'or (`--gold`) pour « jouer / acheter »,
  le cyan (`--cyan`) pour la sélection, le violet pour l'adversaire.
- Budget de lueur : **2 éléments lumineux maximum** visibles simultanément.
- Les panneaux restent sombres et peu contrastés entre eux ; ce sont les cartes
  et les boutons qui portent le contraste.

---

## 5. Composition « jeu » plutôt que « site »

Déjà appliqué :

- HUD fixe (profil, XP, ressources, onglets) au lieu d'une barre de navigation.
- Accueil en **plateau** avec losanges de coin, menu latéral, logo et gros JOUER.
- Plateau de duel avec damier subtil et halo par camp.
- Aucun pied de page textuel.

À éviter : blocs blancs, larges marges d'article, listes de fonctionnalités,
boutons plats sans relief.

---

## 6. Animation

- Interface : 120–220 ms, `ease-out`.
- Révélations (boosters, cartes) : 280–450 ms.
- Boucles décoratives : **2 maximum** à l'écran (respiration des cartes,
  balayage holographique).
- Toujours respecter `prefers-reduced-motion` (déjà géré) et le bouton ⏸ du HUD.
- Les animations ne décident jamais de la logique : le moteur calcule, l'UI anime.

---

## 7. Performance (pour rester fluide)

- Convertir les SVG lourds en WebP.
- `loading="lazy"` sur les illustrations (déjà en place).
- Limiter `backdrop-filter` aux barres fixes.
- Éviter les ombres très larges sur des listes longues : préférer un halo court.

---

## 8. Ordre de travail conseillé

1. Illustrations des **personnages et terrains** (les plus visibles).
2. Illustrations des **invocations spéciales** (écran de duel, Extra Deck).
3. Passe de contraste sur les textes d'effet.
4. Captures d'écran de démonstration (`Voir l'apercu.bat` puis Win+Maj+S).
5. Sons ponctuels supplémentaires si besoin.

---

## 9. Ce qui a été ajouté récemment

- Balayage holographique sur les cartes **Legendary**.
- Reflet animé sur les boutons dorés au survol.
- Respiration douce des cartes mises en avant (accueil, boutique, Extra Deck).
- Damier et halo de camp sur le plateau de duel.
- Transition d'écran à l'arrivée sur chaque vue.
- Toutes ces animations sont coupées si `prefers-reduced-motion` est actif.
