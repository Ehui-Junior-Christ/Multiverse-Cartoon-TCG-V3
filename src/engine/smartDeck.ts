/**
 * Concepteur de deck intelligent avec synergies et affinités.
 *
 * Analyse la collection réelle du joueur, identifie les meilleures
 * affinités d'univers, de tags et de mécaniques de jeu, et compose
 * un deck optimisé et immédiatement jouable.
 *
 * Module pur et testable (aucun DOM, aucun import Vue).
 */

import { CARDS, CARD_INDEX, UNIVERSES, getCard, universeOf } from './catalog'
import { DECK_MAX, DECK_MIN, EXTRA_MAX, MAX_COPIES, validateDeck } from './deck'
import type { CardDef, Category, EffectDef, Keyword, Rarity } from './types'

export type SmartArchetype = 'optimal' | 'aggro' | 'control' | 'resonance' | 'themed'

export interface SmartDeckOptions {
  /** Map id -> quantité possédée. */
  owned: Record<string, number>
  /** Stratégie ou archétype recherché. */
  archetype?: SmartArchetype
  /** Univers favori (optionnel). */
  preferredUniverse?: string
  /** Taille cible du deck principal (44 à 64). */
  targetSize?: number
  /** Graine aléatoire (pour varier les suggestions). */
  seed?: number
}

export interface SynergyBreakdown {
  /** Score global de synergie (0 à 100). */
  overallScore: number
  /** Cohérence et pureté d'univers (0 à 100). */
  universeAffinity: number
  /** Résonance des tags partagés (0 à 100). */
  tagResonance: number
  /** Équilibre de la courbe et des rôles (0 à 100). */
  tacticalBalance: number
  /** Potentiel d'invocations spéciales réalisables (0 à 100). */
  bossPotential: number
  /** Puissance moyenne au combat (0 à 100). */
  combatPower: number
}

export interface SmartDeckReport {
  name: string
  archetype: SmartArchetype
  archetypeLabel: string
  dominantUniverse: string
  dominantUniverseName: string
  dominantUniverseGlyph: string
  synergy: SynergyBreakdown
  topTags: Array<{ tag: string; count: number }>
  mainCounts: {
    characters: number
    zeroTributeCharacters: number
    tributeCharacters: number
    spells: number
    traps: number
    terrains: number
    total: number
  }
  extraCount: number
  strategyDescription: string
  strengths: string[]
  tips: string[]
  warnings: string[]
}

export interface SmartDeckResult {
  deck: {
    id: string
    name: string
    main: string[]
    extra: string[]
  }
  report: SmartDeckReport
  valid: boolean
  validationErrors: string[]
}

const ARCHETYPE_LABELS: Record<SmartArchetype, string> = {
  optimal: 'Synergie Optimale',
  aggro: 'Assaut & Pression',
  control: 'Contrôle & Pièges',
  resonance: 'Résonance & Combos',
  themed: 'Monothématique',
}

/** Calcule le score de synergie directe entre deux cartes. */
export function calculateCardAffinity(a: CardDef, b: CardDef): number {
  let affinity = 0

  // 1. Même univers : affinité majeure (+4)
  if (a.universe === b.universe) {
    affinity += 4
  }

  // 2. Tags partagés (+2 par tag commun)
  if (a.tags.length && b.tags.length) {
    for (const tag of a.tags) {
      if (b.tags.includes(tag)) affinity += 2.5
    }
  }

  // 3. Synergies de rôles
  // Terrain + Personnage du même univers
  if ((a.category === 'terrain' && b.category === 'character') || (b.category === 'terrain' && a.category === 'character')) {
    if (a.universe === b.universe) affinity += 5
  }

  // Équipement / Soutien + Personnage
  if ((a.category === 'equipment' || a.category === 'support') && b.category === 'character') {
    affinity += a.universe === b.universe ? 3 : 1.5
  } else if ((b.category === 'equipment' || b.category === 'support') && a.category === 'character') {
    affinity += a.universe === b.universe ? 3 : 1.5
  }

  // Techniques + Personnages
  if ((a.category === 'technique' && b.category === 'character') || (b.category === 'technique' && a.category === 'character')) {
    if (a.universe === b.universe) affinity += 2
  }

  return affinity
}

/** Poids d'une carte dans un archétype donné. */
function cardArchetypeFit(card: CardDef, archetype: SmartArchetype): number {
  let fit = 0

  switch (archetype) {
    case 'aggro': {
      if (card.category === 'character') {
        const atk = card.atk ?? 0
        if (atk >= 2000) fit += 5
        else if (atk >= 1700) fit += 3
        if ((card.tributes ?? 0) === 0) fit += 2
      }
      if (card.keywords.includes('piercing')) fit += 3
      if (card.keywords.includes('doubleAttack')) fit += 4
      if (card.category === 'technique') fit += 2.5
      break
    }
    case 'control': {
      if (card.category === 'trap') fit += 5
      if (card.category === 'magic') fit += 3
      if (card.category === 'character') {
        const def = card.def ?? 0
        if (def >= 1800) fit += 4
      }
      if (card.keywords.includes('destroyImmune') || card.keywords.includes('targetImmune')) fit += 3.5
      if (card.keywords.includes('counterAttack') || card.keywords.includes('reflect') || card.keywords.includes('absorb')) fit += 3.5
      break
    }
    case 'resonance': {
      fit += card.tags.length * 1.5
      if (card.category === 'support') fit += 4
      if (card.category === 'terrain') fit += 4
      if (card.fx?.some((f) => f.ops.some((op) => op.op === 'draw' || op.op === 'gyToHand'))) fit += 3
      break
    }
    case 'themed': {
      // Priorité à l'univers et aux cartes emblématiques
      fit += (card.popularity ?? 0) * 0.4
      if (card.category === 'terrain') fit += 5
      break
    }
    case 'optimal':
    default: {
      // Équilibre polyvalent
      if (card.category === 'character' && (card.tributes ?? 0) === 0) fit += 2
      if (card.category === 'character' && (card.atk ?? 0) >= 1800) fit += 2
      if (card.category === 'trap') fit += 1.5
      if (card.category === 'magic') fit += 1.5
      break
    }
  }

  // Bonus de rareté modéré
  const rarityBonus: Record<Rarity, number> = {
    common: 0,
    rare: 1,
    epic: 2,
    legendary: 3.5,
    ultra: 5,
  }
  fit += rarityBonus[card.rarity] ?? 0

  return fit
}

/** Quotas idéaux pour un deck équilibré selon l'archétype. */
function getRoleQuotas(targetSize: number, archetype: SmartArchetype) {
  const ratios: Record<SmartArchetype, {
    minZeroTributes: number
    targetCharacters: number
    spells: number
    traps: number
    terrains: number
    supports: number
    equipments: number
  }> = {
    aggro: {
      minZeroTributes: Math.round(targetSize * 0.28),
      targetCharacters: Math.round(targetSize * 0.46),
      spells: Math.round(targetSize * 0.22),
      traps: Math.round(targetSize * 0.10),
      terrains: 1,
      supports: Math.round(targetSize * 0.10),
      equipments: Math.round(targetSize * 0.11),
    },
    control: {
      minZeroTributes: Math.round(targetSize * 0.22),
      targetCharacters: Math.round(targetSize * 0.36),
      spells: Math.round(targetSize * 0.22),
      traps: Math.round(targetSize * 0.22),
      terrains: 1,
      supports: Math.round(targetSize * 0.10),
      equipments: Math.round(targetSize * 0.09),
    },
    resonance: {
      minZeroTributes: Math.round(targetSize * 0.25),
      targetCharacters: Math.round(targetSize * 0.42),
      spells: Math.round(targetSize * 0.20),
      traps: Math.round(targetSize * 0.12),
      terrains: 2,
      supports: Math.round(targetSize * 0.14),
      equipments: Math.round(targetSize * 0.10),
    },
    themed: {
      minZeroTributes: Math.round(targetSize * 0.25),
      targetCharacters: Math.round(targetSize * 0.42),
      spells: Math.round(targetSize * 0.20),
      traps: Math.round(targetSize * 0.14),
      terrains: 2,
      supports: Math.round(targetSize * 0.12),
      equipments: Math.round(targetSize * 0.10),
    },
    optimal: {
      minZeroTributes: Math.round(targetSize * 0.25),
      targetCharacters: Math.round(targetSize * 0.42),
      spells: Math.round(targetSize * 0.22),
      traps: Math.round(targetSize * 0.14),
      terrains: 1,
      supports: Math.round(targetSize * 0.11),
      equipments: Math.round(targetSize * 0.10),
    },
  }

  return ratios[archetype] ?? ratios.optimal
}

/** Détermine l'univers le plus riche et synergique dans la collection possédée. */
export function findBestUniverseInCollection(
  ownedPool: CardDef[],
  ownedMap: Record<string, number>,
): string {
  const scores = new Map<string, number>()

  for (const card of ownedPool) {
    const qty = Math.min(MAX_COPIES, ownedMap[card.id] ?? 0)
    if (qty <= 0) continue

    let val = qty
    if (card.category === 'character') val += (card.atk ?? 0) / 1000
    if (card.category === 'terrain') val += 3
    if (card.rarity === 'legendary' || card.rarity === 'ultra') val += 2

    scores.set(card.universe, (scores.get(card.universe) ?? 0) + val)
  }

  let best = 'adventure'
  let maxScore = -1
  for (const [uni, sc] of scores) {
    if (sc > maxScore) {
      maxScore = sc
      best = uni
    }
  }

  return best
}

/**
 * Concepteur de deck principal.
 * Construit un deck optimisé en combinant sélection gloutonne pondérée
 * par affinité globale et quotas tactiques stricts.
 */
export function generateSmartDeck(options: SmartDeckOptions): SmartDeckResult {
  const targetSize = Math.max(DECK_MIN, Math.min(DECK_MAX, options.targetSize ?? 44))
  const seed = options.seed ?? Date.now()

  // 1. Filtrer les cartes possédées
  const ownedCards = CARDS.filter((card) => (options.owned[card.id] ?? 0) > 0)
  const mainPool = ownedCards.filter((card) => card.category !== 'special')
  const extraPool = ownedCards.filter((card) => card.category === 'special')

  if (mainPool.length === 0) {
    return {
      deck: { id: `smart-empty`, name: 'Collection vide', main: [], extra: [] },
      report: {
        name: 'Collection vide',
        archetype: 'optimal',
        archetypeLabel: ARCHETYPE_LABELS.optimal,
        dominantUniverse: '—',
        dominantUniverseName: '—',
        dominantUniverseGlyph: '◇',
        synergy: { overallScore: 0, universeAffinity: 0, tagResonance: 0, tacticalBalance: 0, bossPotential: 0, combatPower: 0 },
        topTags: [],
        mainCounts: { characters: 0, zeroTributeCharacters: 0, tributeCharacters: 0, spells: 0, traps: 0, terrains: 0, total: 0 },
        extraCount: 0,
        strategyDescription: 'Aucune carte possédée.',
        strengths: [],
        tips: ['Ouvrez des boosters dans la boutique pour commencer à construire votre collection.'],
        warnings: ['Collection vide.'],
      },
      valid: false,
      validationErrors: ['Aucune carte possédée.'],
    }
  }

  // 2. Déterminer l'univers dominant
  const dominantUniverse = options.preferredUniverse || findBestUniverseInCollection(mainPool, options.owned)
  const archetype = options.archetype ?? 'optimal'
  const quotas = getRoleQuotas(targetSize, archetype)

  // 3. Constitution du deck principal avec calcul d'affinité itératif
  const selectedMain: CardDef[] = []
  const countMap = new Map<string, number>()

  const canAdd = (card: CardDef): boolean => {
    const current = countMap.get(card.id) ?? 0
    const maxPossessed = Math.min(MAX_COPIES, options.owned[card.id] ?? 0)
    return current < maxPossessed
  }

  const addCard = (card: CardDef) => {
    selectedMain.push(card)
    countMap.set(card.id, (countMap.get(card.id) ?? 0) + 1)
  }

  // Étape A : Garantir les personnages 0 sacrifice (fondation indispensable)
  const zeroTributeChars = mainPool
    .filter((c) => c.category === 'character' && (c.tributes ?? 0) === 0)
    .sort((a, b) => {
      const aAffinity = (a.universe === dominantUniverse ? 10 : 0) + cardArchetypeFit(a, archetype)
      const bAffinity = (b.universe === dominantUniverse ? 10 : 0) + cardArchetypeFit(b, archetype)
      return bAffinity - aAffinity || (b.atk ?? 0) - (a.atk ?? 0)
    })

  for (const char of zeroTributeChars) {
    if (selectedMain.filter((c) => (c.tributes ?? 0) === 0).length >= quotas.minZeroTributes) break
    while (canAdd(char) && selectedMain.filter((c) => (c.tributes ?? 0) === 0).length < quotas.minZeroTributes) {
      addCard(char)
    }
  }

  // Étape B : Terrain de l'univers dominant si possédé
  const matchingTerrains = mainPool.filter((c) => c.category === 'terrain' && c.universe === dominantUniverse)
  for (const ter of matchingTerrains) {
    if (selectedMain.filter((c) => c.category === 'terrain').length >= quotas.terrains) break
    if (canAdd(ter)) addCard(ter)
  }

  // Étape C : Sélection des cartes par synergie globale avec l'état actuel du deck
  while (selectedMain.length < targetSize) {
    // Calculer le meilleur candidat suivant
    let bestCard: CardDef | null = null
    let bestScore = -Infinity

    for (const card of mainPool) {
      if (!canAdd(card)) continue

      // Règle de sécurité : pas trop de boss à 2 sacrifices
      if ((card.tributes ?? 0) >= 2 && selectedMain.filter((c) => (c.tributes ?? 0) >= 2).length >= 4) {
        continue
      }

      // Base : adéquation à l'archétype
      let score = cardArchetypeFit(card, archetype) * 2

      // Bonus si univers dominant
      if (card.universe === dominantUniverse) score += 6

      // Affinité moyenne avec les cartes déjà présentes
      if (selectedMain.length > 0) {
        // Échantillon pour rapidité
        const sample = selectedMain.slice(-15)
        let totalAffinity = 0
        for (const present of sample) {
          totalAffinity += calculateCardAffinity(card, present)
        }
        score += totalAffinity / sample.length
      }

      // Priorisation par type si un rôle est sous-représenté
      const currentChars = selectedMain.filter((c) => c.category === 'character').length
      const currentSpells = selectedMain.filter((c) => c.category === 'technique' || c.category === 'magic' || c.category === 'support' || c.category === 'equipment').length
      const currentTraps = selectedMain.filter((c) => c.category === 'trap').length

      if (card.category === 'character' && currentChars < quotas.targetCharacters) score += 4
      if (card.category === 'trap' && currentTraps < quotas.traps) score += 3.5
      if ((card.category === 'magic' || card.category === 'technique') && currentSpells < quotas.spells) score += 3

      if (score > bestScore) {
        bestScore = score
        bestCard = card
      }
    }

    if (!bestCard) break
    addCard(bestCard)
  }

  // Si le deck n'atteint pas encore targetSize (collection restreinte), remplir avec n'importe quelle carte possédée
  if (selectedMain.length < targetSize) {
    for (const card of mainPool) {
      while (canAdd(card) && selectedMain.length < targetSize) {
        addCard(card)
      }
      if (selectedMain.length >= targetSize) break
    }
  }

  // 4. Extra Deck : Sélectionner les cartes spéciales compatibles
  const selectedExtra: CardDef[] = []
  const extraCountMap = new Map<string, number>()

  for (const special of extraPool) {
    if (selectedExtra.length >= EXTRA_MAX) break
    const currentCount = extraCountMap.get(special.id) ?? 0
    const maxOwned = Math.min(MAX_COPIES, options.owned[special.id] ?? 0)
    if (currentCount >= maxOwned) continue

    // Vérifier pertinence (même univers ou requis partagés)
    const matchesUniverse = special.universe === dominantUniverse || selectedMain.some((c) => c.universe === special.universe)
    if (matchesUniverse) {
      selectedExtra.push(special)
      extraCountMap.set(special.id, currentCount + 1)
    }
  }

  // 5. Calcul des métriques de synergie
  const universeMatches = selectedMain.filter((c) => c.universe === dominantUniverse).length
  const universeAffinity = Math.min(100, Math.round((universeMatches / Math.max(1, selectedMain.length)) * 100 * 1.2))

  const allTags = selectedMain.flatMap((c) => c.tags)
  const tagCounts = new Map<string, number>()
  for (const t of allTags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  const sharedTagCount = [...tagCounts.values()].filter((v) => v >= 3).reduce((acc, v) => acc + v, 0)
  const tagResonance = Math.min(100, Math.round((sharedTagCount / Math.max(1, allTags.length)) * 100 * 1.5))

  const zeroTrib = selectedMain.filter((c) => c.category === 'character' && (c.tributes ?? 0) === 0).length
  const trib = selectedMain.filter((c) => c.category === 'character' && (c.tributes ?? 0) > 0).length
  const spells = selectedMain.filter((c) => c.category === 'magic' || c.category === 'technique' || c.category === 'support' || c.category === 'equipment').length
  const traps = selectedMain.filter((c) => c.category === 'trap').length
  const terrains = selectedMain.filter((c) => c.category === 'terrain').length

  // Équilibre tactique : pénalise si manque de 0 tribute ou trop de sorts/pièges
  let tacticalScore = 75
  if (zeroTrib >= 10 && zeroTrib <= 20) tacticalScore += 15
  else if (zeroTrib < 6) tacticalScore -= 25
  if (traps >= 2 && traps <= 12) tacticalScore += 5
  if (terrains >= 1) tacticalScore += 5
  const tacticalBalance = Math.min(100, Math.max(20, tacticalScore))

  const bossPotential = Math.min(100, Math.round((selectedExtra.length / 5) * 50 + (trib >= 4 ? 40 : trib * 10)))

  const charsWithAtk = selectedMain.filter((c) => c.category === 'character' && (c.atk ?? 0) > 0)
  const avgAtk = charsWithAtk.reduce((acc, c) => acc + (c.atk ?? 0), 0) / Math.max(1, charsWithAtk.length)
  const combatPower = Math.min(100, Math.round((avgAtk / 2400) * 100))

  const overallScore = Math.round(
    universeAffinity * 0.35 +
    tagResonance * 0.25 +
    tacticalBalance * 0.20 +
    bossPotential * 0.10 +
    combatPower * 0.10
  )

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }))

  // Conseils et points forts
  const strengths: string[] = []
  if (universeAffinity >= 60) strengths.push(`Forte cohésion thématique autour de ${universeOf(dominantUniverse).name}`)
  if (zeroTrib >= 10) strengths.push(`Excellente consistance au tour 1 (${zeroTrib} personnages d'invocation directe)`)
  if (terrains > 0) strengths.push(`Contrôle du Terrain pour amplifier les statistiques alliées`)
  if (traps >= 4) strengths.push(`Défense réactive solide (${traps} pièges posables)`)
  if (selectedExtra.length > 0) strengths.push(`${selectedExtra.length} invocation(s) spéciale(s) en Extra Deck`)
  if (topTags[0]) strengths.push(`Synergie d'équipe axée sur le tag « ${topTags[0].tag} »`)

  const tips: string[] = [
    `Commencez vos premiers tours en posant un personnage sans sacrifice en position d'attaque ou de défense.`,
    `Activez votre Terrain dès que possible pour activer les effets passifs de votre univers.`,
    `Gardez vos pièges face cachée pour surprendre les assauts ennemis pendant son tour.`,
  ]

  const warnings: string[] = []
  if (selectedMain.length < DECK_MIN) {
    warnings.push(`Votre collection ne contient pas assez de cartes pour atteindre le minimum légal de ${DECK_MIN} cartes (${selectedMain.length} trouvées).`)
  }
  if (zeroTrib < 6) {
    warnings.push(`Attention : peu de monstres sans sacrifice (${zeroTrib}), risque de mains de départ bloquées.`)
  }

  const uInfo = universeOf(dominantUniverse)
  const deckName = options.archetype === 'themed'
    ? `Deck ${uInfo.name}`
    : `Deck ${ARCHETYPE_LABELS[archetype]} · ${uInfo.name}`

  const mainIds = selectedMain.map((c) => c.id)
  const extraIds = selectedExtra.map((c) => c.id)
  const validation = validateDeck(mainIds, extraIds)

  return {
    deck: {
      id: `smart-${archetype}-${Date.now().toString(36)}`,
      name: deckName,
      main: mainIds,
      extra: extraIds,
    },
    report: {
      name: deckName,
      archetype,
      archetypeLabel: ARCHETYPE_LABELS[archetype],
      dominantUniverse,
      dominantUniverseName: uInfo.name,
      dominantUniverseGlyph: uInfo.glyph,
      synergy: {
        overallScore,
        universeAffinity,
        tagResonance,
        tacticalBalance,
        bossPotential,
        combatPower,
      },
      topTags,
      mainCounts: {
        characters: zeroTrib + trib,
        zeroTributeCharacters: zeroTrib,
        tributeCharacters: trib,
        spells,
        traps,
        terrains,
        total: selectedMain.length,
      },
      extraCount: selectedExtra.length,
      strategyDescription: getStrategyDescription(archetype, uInfo.name, topTags[0]?.tag),
      strengths,
      tips,
      warnings,
    },
    valid: validation.valid,
    validationErrors: validation.errors,
  }
}

function getStrategyDescription(archetype: SmartArchetype, universeName: string, mainTag?: string): string {
  switch (archetype) {
    case 'aggro':
      return `Stratégie offensive rapide conçue pour infliger des dégâts massifs dès les premiers tours grâce aux attaquants puissants de ${universeName}.`
    case 'control':
      return `Stratégie défensive et méthodique axée sur les pièges, la neutralisation des menaces adverses et la guerre d'usure.`
    case 'resonance':
      return `Stratégie articulée autour des tags partagés${mainTag ? ` (« ${mainTag} »)` : ''} et des synergies de pioche et de soutien.`
    case 'themed':
      return `Immersion maximale dans l'univers de ${universeName} combinant ses héros phares, ses techniques signatures et son terrain.`
    case 'optimal':
    default:
      return `Composition équilibrée combinant la force de frappe de ${universeName} avec une protection solide et une fluidité de main optimale.`
  }
}
