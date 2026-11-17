import { describe, expect, it } from 'vitest'
import { generateSmartDeck, calculateCardAffinity } from '../src/engine/smartDeck'
import { CARDS } from '../src/engine/catalog'
import { DECK_MIN, DECK_MAX, validateDeck } from '../src/engine/deck'

describe('Concepteur de deck intelligent (SmartDeck)', () => {
  it('calcule des affinités positives entre cartes du même univers et tags communs', () => {
    const ben10Cards = CARDS.filter((c) => c.universe === 'ben10')
    const titancards = CARDS.filter((c) => c.universe === 'titans')

    if (ben10Cards.length >= 2 && titancards.length >= 1) {
      const sameUniAffinity = calculateCardAffinity(ben10Cards[0], ben10Cards[1])
      const diffUniAffinity = calculateCardAffinity(ben10Cards[0], titancards[0])
      expect(sameUniAffinity).toBeGreaterThan(diffUniAffinity)
    }
  })

  it('génère un deck complet et valide à partir d’une collection standard', () => {
    // Simuler une collection où le joueur possède 3 exemplaires de chaque carte
    const fullCollection = Object.fromEntries(CARDS.map((c) => [c.id, 3]))

    const result = generateSmartDeck({
      owned: fullCollection,
      archetype: 'optimal',
      targetSize: 44,
    })

    expect(result.valid).toBe(true)
    expect(result.deck.main.length).toBeGreaterThanOrEqual(DECK_MIN)
    expect(result.deck.main.length).toBeLessThanOrEqual(DECK_MAX)
    expect(result.report.synergy.overallScore).toBeGreaterThan(50)
    expect(result.report.dominantUniverse).toBeTruthy()
    expect(result.report.mainCounts.zeroTributeCharacters).toBeGreaterThanOrEqual(6)

    const check = validateDeck(result.deck.main, result.deck.extra)
    expect(check.valid).toBe(true)
  })

  it('génère un deck axé sur un univers choisi (ex: adventure)', () => {
    const fullCollection = Object.fromEntries(CARDS.map((c) => [c.id, 3]))

    const result = generateSmartDeck({
      owned: fullCollection,
      archetype: 'themed',
      preferredUniverse: 'adventure',
      targetSize: 44,
    })

    expect(result.valid).toBe(true)
    expect(result.report.dominantUniverse).toBe('adventure')
    expect(result.report.synergy.universeAffinity).toBeGreaterThanOrEqual(50)
  })

  it('respecte strictement les cartes possédées et ne dépasse pas les quantités', () => {
    // Joueur possédant seulement 50 cartes spécifiques
    const sample = CARDS.slice(0, 50)
    const limitedCollection = Object.fromEntries(sample.map((c, idx) => [c.id, (idx % 2) + 1]))

    const result = generateSmartDeck({
      owned: limitedCollection,
      targetSize: 44,
    })

    for (const cardId of result.deck.main) {
      expect(limitedCollection[cardId]).toBeGreaterThan(0)
    }
  })
})
