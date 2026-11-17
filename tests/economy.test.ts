import { describe, expect, it } from 'vitest'
import { CARDS } from '../src/engine/catalog'
import {
  BASE_RATES,
  EMPTY_PITY,
  GUARANTEED_RATES,
  JM_REWARDS,
  PACKS,
  PITY_THRESHOLDS,
  RARITY_RANK,
  openBoosterWithPity,
  packById,
} from '../src/engine/economy'
import type { Rarity } from '../src/engine/types'

const sum = (rates: Record<Rarity, number>) => Object.values(rates).reduce((a, b) => a + b, 0)

describe('économie — boosters', () => {
  it('les tables de raretés sont normalisées', () => {
    expect(sum(BASE_RATES)).toBeCloseTo(1, 5)
    expect(sum(GUARANTEED_RATES)).toBeCloseTo(1, 5)
    // La 10e carte ne peut jamais être Common.
    expect(GUARANTEED_RATES.common).toBe(0)
  })

  it('les boosters ont une taille et un coût cohérents', () => {
    for (const pack of PACKS) {
      expect(pack.size).toBe(10)
      expect(pack.cost).toBeGreaterThan(0)
    }
    expect(packById('classic')?.size).toBe(10)
    expect(packById('inconnu')).toBeUndefined()
  })

  it('ouvre 10 cartes valides avec une 10e Rare ou mieux', () => {
    const result = openBoosterWithPity({ kind: 'classic', seed: 12345 }, { ...EMPTY_PITY })
    expect(result.cards).toHaveLength(10)
    for (const card of result.cards) {
      expect(CARDS.some((entry) => entry.id === card.id), card.id).toBe(true)
    }
    const last = result.cards[result.cards.length - 1]
    expect(RARITY_RANK[last.rarity]).toBeGreaterThanOrEqual(1)
  })

  it('est déterministe pour une même graine', () => {
    const a = openBoosterWithPity({ kind: 'classic', seed: 4242 }, { ...EMPTY_PITY })
    const b = openBoosterWithPity({ kind: 'classic', seed: 4242 }, { ...EMPTY_PITY })
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id))
  })

  it('déclenche la pity Epic après 5 boosters sans Epic+', () => {
    const pity = { epic: PITY_THRESHOLDS.epic, legendary: 0, ultra: 0 }
    const result = openBoosterWithPity({ kind: 'classic', seed: 99 }, pity)
    expect(result.pityTriggered).toBe('epic')
    const best = result.cards.reduce((rank, card) => Math.max(rank, RARITY_RANK[card.rarity]), 0)
    expect(best).toBeGreaterThanOrEqual(2)
  })

  it('déclenche la pity Legendary après 19 boosters sans Legendary+', () => {
    const pity = { epic: 0, legendary: PITY_THRESHOLDS.legendary, ultra: 0 }
    const result = openBoosterWithPity({ kind: 'classic', seed: 7 }, pity)
    expect(result.pityTriggered).toBe('legendary')
    const best = result.cards.reduce((rank, card) => Math.max(rank, RARITY_RANK[card.rarity]), 0)
    expect(best).toBeGreaterThanOrEqual(3)
  })

  it('déclenche la pity Ultra après 49 boosters sans Ultra', () => {
    const pity = { epic: 0, legendary: 0, ultra: PITY_THRESHOLDS.ultra }
    const result = openBoosterWithPity({ kind: 'classic', seed: 3 }, pity)
    expect(result.pityTriggered).toBe('ultra')
    expect(result.cards.some((card) => card.rarity === 'ultra')).toBe(true)
  })

  it('les compteurs de pity repartent à zéro après un tirage supérieur', () => {
    const pity = { epic: 3, legendary: 3, ultra: 300 }
    const result = openBoosterWithPity({ kind: 'premium', seed: 11 }, pity)
    expect(result.pity.ultra).toBe(0)
    expect(result.pity.epic).toBe(0)
    expect(result.pity.legendary).toBe(0)
  })

  it('un booster thématique ne sort que des cartes de l’univers choisi', () => {
    const result = openBoosterWithPity({ kind: 'thematic', universe: 'ben10', seed: 55 }, { ...EMPTY_PITY })
    for (const card of result.cards) {
      expect(card.universe, card.id).toBe('ben10')
    }
  })

  it('un booster événementiel garantit une Legendary au minimum', () => {
    const result = openBoosterWithPity({ kind: 'event', seed: 77 }, { ...EMPTY_PITY })
    const last = result.cards[result.cards.length - 1]
    expect(RARITY_RANK[last.rarity]).toBeGreaterThanOrEqual(3)
  })

  it('les récompenses de duel sont positives', () => {
    expect(JM_REWARDS.win).toBeGreaterThan(JM_REWARDS.loss)
    expect(JM_REWARDS.loss).toBeGreaterThan(0)
  })
})
