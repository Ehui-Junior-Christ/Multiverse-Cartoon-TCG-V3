/** Règles de construction de deck — partagées par le Deck Builder et le moteur. */
import { CARD_INDEX, getCard } from './catalog'
import type { CardDef } from './types'

export const DECK_MIN = 44
export const DECK_MAX = 64
export const MAX_COPIES = 3
export const EXTRA_MAX = 20
export const START_LP = 10_000
export const STARTING_HAND = 6
export const TURN_SECONDS = 210

export interface Deck {
  id: string
  name: string
  main: string[]
  extra: string[]
  updatedAt?: string
}

export interface DeckValidation {
  valid: boolean
  errors: string[]
  mainCount: number
  extraCount: number
  uniqueMain: number
  characterCount: number
}

export function validateDeck(main: string[], extra: string[]): DeckValidation {
  const errors: string[] = []
  const mainCount = main.length
  const extraCount = extra.length

  if (mainCount < DECK_MIN) errors.push(`Le deck principal doit contenir au moins ${DECK_MIN} cartes (actuellement ${mainCount}).`)
  if (mainCount > DECK_MAX) errors.push(`Le deck principal ne peut pas dépasser ${DECK_MAX} cartes (actuellement ${mainCount}).`)
  if (extraCount > EXTRA_MAX) errors.push(`L'Extra Deck ne peut pas dépasser ${EXTRA_MAX} cartes (actuellement ${extraCount}).`)

  const mainCounts = new Map<string, number>()
  for (const id of main) {
    const card = CARD_INDEX.get(id)
    if (!card) {
      errors.push(`Carte inconnue dans le deck: ${id}`)
      continue
    }
    if (card.category === 'special') {
      errors.push(`« ${card.name} » est une Invocation spéciale : elle appartient à l'Extra Deck.`)
      continue
    }
    mainCounts.set(id, (mainCounts.get(id) ?? 0) + 1)
  }
  for (const [id, count] of mainCounts) {
    if (count > MAX_COPIES) errors.push(`${getCard(id).name} : ${count} exemplaires (maximum ${MAX_COPIES}).`)
  }

  const extraCounts = new Map<string, number>()
  for (const id of extra) {
    const card = CARD_INDEX.get(id)
    if (!card) {
      errors.push(`Carte inconnue dans l'Extra Deck: ${id}`)
      continue
    }
    if (card.category !== 'special') {
      errors.push(`« ${card.name} » n'est pas une Invocation spéciale : direction le deck principal.`)
      continue
    }
    extraCounts.set(id, (extraCounts.get(id) ?? 0) + 1)
  }
  for (const [id, count] of extraCounts) {
    if (count > MAX_COPIES) errors.push(`${getCard(id).name} (Extra Deck) : ${count} exemplaires (maximum ${MAX_COPIES}).`)
  }

  const characterCount = main.filter((id) => CARD_INDEX.get(id)?.category === 'character').length
  if (characterCount === 0) errors.push('Le deck doit contenir au moins un personnage.')

  return {
    valid: errors.length === 0,
    errors,
    mainCount,
    extraCount,
    uniqueMain: mainCounts.size,
    characterCount,
  }
}

export function deckSummary(main: string[], extra: string[]) {
  const cards = main.map((id) => CARD_INDEX.get(id)).filter((c): c is CardDef => Boolean(c))
  const byCategory = new Map<string, number>()
  for (const c of cards) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1)
  return { byCategory, extraCount: extra.length }
}
