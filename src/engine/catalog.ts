/** Accès au catalogue (données déclaratives générées par scripts/build-catalog.mjs). */
import cardsRaw from '../data/cards.json'
import universesRaw from '../data/universes.json'
import artManifestRaw from '../data/art-manifest.json'
import type { CardDef, Category, Rarity, Universe } from './types'

export const CARDS = cardsRaw as unknown as CardDef[]
export const UNIVERSES = universesRaw as unknown as Universe[]

/** Illustrations réelles trouvées dans public/assets/cards (généré par `npm run art`). */
const ART_MANIFEST = artManifestRaw as unknown as Record<string, string>

export const CARD_INDEX = new Map<string, CardDef>(CARDS.map((c) => [c.id, c]))

export function getCard(id: string): CardDef {
  const card = CARD_INDEX.get(id)
  if (!card) throw new Error(`Carte inconnue: ${id}`)
  return card
}

export const CATEGORY_LABEL: Record<Category, string> = {
  character: 'Personnage',
  technique: 'Technique',
  equipment: 'Équipement',
  support: 'Soutien',
  magic: 'Magie',
  trap: 'Piège',
  terrain: 'Terrain',
  special: 'Invocation spéciale',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  ultra: 'Ultra Legendary',
}

export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  ultra: 4,
}

export const SPECIAL_LABEL: Record<string, string> = {
  crossover: 'Crossover',
  awakening: 'Éveil',
  sacrifice: 'Sacrifice',
  dimensional: 'Dimensionnelle',
  resonance: 'Résonance',
}

export function universeOf(id: string): Universe {
  return UNIVERSES.find((u) => u.id === id) ?? { id, name: id, hue: 220, glyph: '✧' }
}

const FOLDER: Record<Category, string> = {
  character: 'characters',
  terrain: 'terrains',
  technique: 'techniques',
  equipment: 'equipments',
  support: 'supports',
  magic: 'magics',
  trap: 'traps',
  special: 'specials',
}

/**
 * Noms de fichiers stables : remplacer le placeholder par l'asset final suffit.
 * `scripts/art-manifest.mjs` indexe les fichiers présents et les formats raster
 * priment sur le SVG placeholder.
 */
export function artUrl(card: CardDef): string {
  return ART_MANIFEST[card.id] ?? `/assets/cards/${FOLDER[card.category]}/${card.id}.svg`
}
