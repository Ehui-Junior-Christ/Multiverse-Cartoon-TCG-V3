/** Données seed de la démo — partagées par l'API SQLite et le mode hors ligne. */
import { CARDS } from '../engine/catalog'
import type { Deck } from '../engine/deck'
import { PLAYER_DECK } from './decks'

/** Collection de démonstration : 3 exemplaires de chaque carte (aucune économie active). */
export const SEED_QUANTITY = 3

export interface SeedProfile {
  name: string
  xp: number
  jm: number
  wins: number
  losses: number
}

export function seedProfile(): SeedProfile {
  return { name: 'Duelliste', xp: 0, jm: 500, wins: 0, losses: 0 }
}

export function seedCollection(): Array<{ cardId: string; quantity: number }> {
  return CARDS.map((card) => ({ cardId: card.id, quantity: SEED_QUANTITY }))
}

export function seedDecks(): Deck[] {
  return [{ ...PLAYER_DECK, updatedAt: new Date().toISOString() }]
}
