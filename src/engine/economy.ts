/**
 * Économie locale : boosters, raretés, pity (brief §10).
 * Module pur et testable : aucun accès réseau, aucun accès DOM.
 * Les taux sont des valeurs initiales à tester, pas des vérités d'équilibrage.
 */
import { CARDS } from './catalog'
import { nextRandom } from './rng'
import type { CardDef, Rarity } from './types'

export interface PityState {
  /** Boosters ouverts depuis le dernier Epic ou mieux. */
  epic: number
  /** Boosters ouverts depuis le dernier Legendary ou mieux. */
  legendary: number
  /** Boosters ouverts depuis le dernier Ultra Legendary. */
  ultra: number
}

export const EMPTY_PITY: PityState = { epic: 0, legendary: 0, ultra: 0 }

/** Pity : 6e booster sans Epic+, 20e sans Legendary+, 50e sans Ultra. */
export const PITY_THRESHOLDS = { epic: 5, legendary: 19, ultra: 49 } as const

/** Probabilités des 9 premières cartes (brief §10). */
export const BASE_RATES: Record<Rarity, number> = {
  common: 0.7,
  rare: 0.22,
  epic: 0.06,
  legendary: 0.017,
  ultra: 0.003,
}

/** Probabilités de la 10e carte, garantie Rare ou mieux. */
export const GUARANTEED_RATES: Record<Rarity, number> = {
  common: 0,
  rare: 0.7,
  epic: 0.24,
  legendary: 0.055,
  ultra: 0.005,
}

export const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  ultra: 4,
}

export type PackKind = 'classic' | 'thematic' | 'premium' | 'event'

export interface PackDef {
  id: PackKind
  name: string
  cost: number
  size: number
  description: string
  /** Plancher garanti pour la dernière carte. */
  lastFloor: 'rare' | 'epic' | 'legendary'
}

export const PACKS: PackDef[] = [
  {
    id: 'classic',
    name: 'Booster Multivers',
    cost: 100,
    size: 10,
    description: '10 cartes, tous univers. 10e carte garantie Rare ou mieux.',
    lastFloor: 'rare',
  },
  {
    id: 'thematic',
    name: 'Booster Thématique',
    cost: 120,
    size: 10,
    description: '10 cartes d’un seul univers. 10e carte garantie Rare ou mieux.',
    lastFloor: 'rare',
  },
  {
    id: 'premium',
    name: 'Booster Premium',
    cost: 240,
    size: 10,
    description: '10 cartes, 10e carte garantie Epic ou mieux.',
    lastFloor: 'epic',
  },
  {
    id: 'event',
    name: 'Booster Événementiel',
    cost: 320,
    size: 10,
    description: 'Série limitée : 10 cartes, 10e carte garantie Legendary ou mieux.',
    lastFloor: 'legendary',
  },
]

export function packById(id: string): PackDef | undefined {
  return PACKS.find((pack) => pack.id === id)
}

/** Tirage pondéré : renvoie une rareté selon la table donnée. */
function rollRarity(rates: Record<Rarity, number>, rng: { rngState: number }): Rarity {
  const roll = nextRandom(rng)
  let acc = 0
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'ultra']
  for (const rarity of order) {
    acc += rates[rarity]
    if (roll < acc) return rarity
  }
  return order[order.length - 1]
}

function poolFor(rarity: Rarity, universe?: string): CardDef[] {
  const pool = CARDS.filter((card) => card.rarity === rarity && (!universe || card.universe === universe))
  return pool.length ? pool : CARDS.filter((card) => card.rarity === rarity)
}

function pickCard(rarity: Rarity, rng: { rngState: number }, universe?: string): CardDef {
  const pool = poolFor(rarity, universe)
  return pool[Math.min(pool.length - 1, Math.floor(nextRandom(rng) * pool.length))]
}

export interface BoosterOptions {
  kind: PackKind
  /** Univers imposé pour un booster thématique. */
  universe?: string
  /** Graine du tirage. */
  seed: number
}

export interface BoosterResult {
  pack: PackDef
  cards: CardDef[]
  pity: PityState
  bestRarity: Rarity
  /** Pity appliquée à ce tirage (transparence pour l'interface). */
  pityTriggered: 'ultra' | 'legendary' | 'epic' | null
}

/**
 * Ouvre un booster. Déterministe : même graine + même pity ⇒ même résultat.
 * La pity est appliquée à la dernière carte pour garantir le palier annoncé.
 */
export function openBoosterWithPity(
  options: BoosterOptions,
  pity: PityState,
): BoosterResult {
  const pack = packById(options.kind) ?? PACKS[0]
  const rng = { rngState: (options.seed >>> 0) || 0x9e3779b9 }

  const triggeredUltra = pity.ultra >= PITY_THRESHOLDS.ultra
  const triggeredLegendary = !triggeredUltra && pity.legendary >= PITY_THRESHOLDS.legendary
  const triggeredEpic = !triggeredUltra && !triggeredLegendary && pity.epic >= PITY_THRESHOLDS.epic
  const pityTriggered = triggeredUltra ? 'ultra' : triggeredLegendary ? 'legendary' : triggeredEpic ? 'epic' : null

  const floor: Rarity = triggeredUltra
    ? 'ultra'
    : triggeredLegendary
      ? 'legendary'
      : triggeredEpic
        ? 'epic'
        : pack.lastFloor

  const cards: CardDef[] = []
  for (let slot = 0; slot < pack.size; slot++) {
    const isLast = slot === pack.size - 1
    let rarity = rollRarity(isLast ? GUARANTEED_RATES : BASE_RATES, rng)
    if (isLast && RARITY_RANK[rarity] < RARITY_RANK[floor]) rarity = floor
    cards.push(pickCard(rarity, rng, options.universe))
  }

  const bestRarity = cards.reduce<Rarity>(
    (best, card) => (RARITY_RANK[card.rarity] > RARITY_RANK[best] ? card.rarity : best),
    'common',
  )

  const nextPity: PityState = {
    epic: RARITY_RANK[bestRarity] >= 2 ? 0 : pity.epic + 1,
    legendary: RARITY_RANK[bestRarity] >= 3 ? 0 : pity.legendary + 1,
    ultra: RARITY_RANK[bestRarity] >= 4 ? 0 : pity.ultra + 1,
  }

  return { pack, cards, pity: nextPity, bestRarity, pityTriggered }
}

/** Récompenses de duel en Jetons Multivers (brief §10 : récompenses de duel). */
export const JM_REWARDS = {
  win: 60,
  loss: 20,
  draw: 30,
} as const
