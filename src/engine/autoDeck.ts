/**
 * Constructeur de deck automatique.
 *
 * Le choix n'est pas aléatoire : un archétype est déduit du catalogue possédé,
 * puis chaque carte est notée selon sa synergie avec cet archétype (univers
 * dominant, tags partagés, rôles, effets) et le deck est composé par quotas.
 * Les invocations spéciales ne sont retenues que si le deck principal permet
 * réellement de remplir leurs conditions.
 *
 * Module pur : aucun accès réseau, aucun DOM, résultat déterministe à graine fixe.
 */
import { CARD_INDEX, getCard, universeOf } from './catalog'
import { DECK_MAX, DECK_MIN, EXTRA_MAX, MAX_COPIES, validateDeck } from './deck'
import type { CardDef, Category, EffectDef, Keyword, Rarity } from './types'

export type AutoStrategy = 'aggro' | 'control' | 'resonance'

export interface AutoDeckOptions {
  /** Quantité possédée par carte (par défaut : 3 partout). */
  owned?: (cardId: string) => number
  /** Taille visée du deck principal (44–64). */
  size?: number
  /** Impose une stratégie au lieu de la déduire. */
  strategy?: AutoStrategy
  /** Impose un univers principal. */
  universe?: string
  /** Graine de départage (déterminisme). */
  seed?: number
}

export interface AutoDeckReport {
  strategy: AutoStrategy
  strategyLabel: string
  universe: string
  universeName: string
  tags: string[]
  score: number
  monsters: number
  spells: number
  traps: number
  terrains: number
  specials: number
  extraReasons: string[]
  notes: string[]
}

export interface AutoDeckResult {
  deck: { id: string; name: string; main: string[]; extra: string[] }
  report: AutoDeckReport
  errors: string[]
}

const STRATEGY_LABEL: Record<AutoStrategy, string> = {
  aggro: 'Agressif',
  control: 'Contrôle',
  resonance: 'Résonance',
}

const CHARACTER_CATEGORIES: Category[] = ['character']
const SPELL_CATEGORIES: Category[] = ['technique', 'magic']
void CHARACTER_CATEGORIES

/** Petite fonction de hachage pour départager les égalités de façon déterministe. */
function tieBreak(id: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0
  return h
}

function effectValue(fx: EffectDef | undefined, strategy: AutoStrategy): number {
  if (!fx) return 0
  let value = 0
  for (const op of fx.ops) {
    switch (op.op) {
      case 'damage':
        value += op.amount / 90
        break
      case 'heal':
        value += op.amount / 240
        break
      case 'draw':
        value += 4 * op.amount
        break
      case 'destroy':
        value += strategy === 'control' ? 9 : 7
        break
      case 'discard':
        value += strategy === 'control' ? 5 : 3
        break
      case 'banishTop':
        value += 3 * op.amount
        break
      case 'buff':
        value += ((op.atk ?? 0) + (op.def ?? 0)) / 130
        break
      case 'setStats':
        value += ((op.atk ?? 0) + (op.def ?? 0)) / 300
        break
      case 'multiplyStats':
        value += strategy === 'aggro' ? 4 : 3
        break
      case 'grantKeyword':
        value += keywordValue(op.keyword, strategy)
        break
      case 'gyToHand':
        value += 3 * op.amount
        break
      case 'negate':
        value += 6
        break
      default:
        break
    }
  }
  return value
}

function keywordValue(keyword: Keyword, strategy: AutoStrategy): number {
  const table: Record<AutoStrategy, Record<Keyword, number>> = {
    aggro: { piercing: 3.5, doubleAttack: 4, counterAttack: 1.5, destroyImmune: 1, targetImmune: 1, reflect: 1, absorb: 1 },
    control: { piercing: 1, doubleAttack: 1, counterAttack: 3, destroyImmune: 4, targetImmune: 3.5, reflect: 3, absorb: 3.5 },
    resonance: { piercing: 2, doubleAttack: 2, counterAttack: 2, destroyImmune: 2, targetImmune: 2, reflect: 2, absorb: 2 },
  }
  return table[strategy][keyword] ?? 0
}

function rarityValue(rarity: Rarity): number {
  return { common: 0, rare: 1, epic: 2.5, legendary: 4, ultra: 6 }[rarity]
}

interface ScoringContext {
  strategy: AutoStrategy
  universe: string
  tags: Map<string, number>
  seed: number
}

function scoreCard(card: CardDef, ctx: ScoringContext): number {
  let score = rarityValue(card.rarity)
  const activate = (card.fx ?? []).find((fx) => fx.trigger === 'activate')
  const continuous = (card.fx ?? []).find((fx) => fx.trigger === 'continuous')

  if (card.category === 'character') {
    const atk = card.atk ?? 0
    const def = card.def ?? 0
    score += atk / 90 + def / 150
    score += (card.popularity ?? 0) * 0.25
    if (card.universe === ctx.universe) score += 7
    for (const tag of card.tags) score += (ctx.tags.get(tag) ?? 0) * 1.6
    for (const keyword of card.keywords) score += keywordValue(keyword, ctx.strategy)
    score += effectValue(activate, ctx.strategy) * 0.7
    score += effectValue(continuous, ctx.strategy) * 0.4
    // Un personnage à sacrifice est excellent en aggro mais lourd ailleurs.
    if ((card.tributes ?? 0) >= 2 && ctx.strategy !== 'aggro') score -= 4
  } else if (card.category === 'terrain') {
    score += 9 + (card.universe === ctx.universe ? 7 : 0)
    score += effectValue(continuous, ctx.strategy)
  } else if (card.category === 'support') {
    score += 4 + (card.universe === ctx.universe ? 2 : 0)
    score += effectValue(continuous, ctx.strategy)
  } else if (card.category === 'trap') {
    score += 3 + effectValue(activate, ctx.strategy)
  } else {
    score += effectValue(activate, ctx.strategy)
  }

  // Départage stable : la graine influence l'ordre sans écraser le score.
  score += (tieBreak(card.id, ctx.seed) % 100) / 1000
  return score
}

/** Déduit l'archétype à partir du catalogue possédé. */
export function pickStrategy(pool: CardDef[]): AutoStrategy {
  let aggro = 0
  let control = 0
  let resonance = 0
  for (const card of pool) {
    if (card.category !== 'character') continue
    aggro += ((card.atk ?? 0) - 1800) / 200
    control += ((card.def ?? 0) - 1800) / 200
    for (const keyword of card.keywords) {
      if (keyword === 'piercing' || keyword === 'doubleAttack') aggro += 2
      if (keyword === 'destroyImmune' || keyword === 'targetImmune' || keyword === 'absorb' || keyword === 'reflect') control += 2
      if (keyword === 'counterAttack') {
        aggro += 1
        control += 1
      }
    }
    for (const tag of card.tags) resonance += 0.2
  }
  if (aggro >= control && aggro >= resonance * 0.5) return 'aggro'
  if (control >= resonance * 0.5) return 'control'
  return 'resonance'
}

/** Univers dominant : pondéré par la puissance et le nombre de personnages. */
export function pickUniverse(pool: CardDef[]): string {
  const totals = new Map<string, number>()
  for (const card of pool) {
    if (card.category !== 'character') continue
    const weight = 1 + (card.atk ?? 0) / 2000
    totals.set(card.universe, (totals.get(card.universe) ?? 0) + weight)
  }
  let best = 'titans'
  let bestValue = -1
  for (const [universe, value] of [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (value > bestValue) {
      best = universe
      bestValue = value
    }
  }
  return best
}

function topTags(pool: CardDef[], universe: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const card of pool) {
    if (card.category !== 'character') continue
    const weight = card.universe === universe ? 2 : 1
    for (const tag of card.tags) counts.set(tag, (counts.get(tag) ?? 0) + weight)
  }
  return counts
}

interface Slot {
  category: Category | 'spell'
  count: number
}

/** Quotas par rôle, adaptés à l'archétype pour atteindre la taille visée. */
function buildQuotas(target: number, strategy: AutoStrategy): Slot[] {
  const ratios: Record<AutoStrategy, { terrain: number; support: number; equipment: number; trap: number; spell: number }> = {
    aggro: { terrain: 0.02, support: 0.05, equipment: 0.05, trap: 0.07, spell: 0.17 },
    control: { terrain: 0.02, support: 0.07, equipment: 0.05, trap: 0.14, spell: 0.17 },
    resonance: { terrain: 0.02, support: 0.09, equipment: 0.04, trap: 0.08, spell: 0.17 },
  }
  const r = ratios[strategy]
  const terrain = Math.max(1, Math.round(target * r.terrain))
  const support = Math.max(2, Math.round(target * r.support))
  const equipment = Math.max(2, Math.round(target * r.equipment))
  const trap = Math.max(3, Math.round(target * r.trap))
  const spell = Math.max(8, Math.round(target * r.spell))
  const monsters = target - terrain - support - equipment - trap - spell
  return [
    { category: 'character', count: monsters },
    { category: 'spell', count: spell },
    { category: 'trap', count: trap },
    { category: 'support', count: support },
    { category: 'equipment', count: equipment },
    { category: 'terrain', count: terrain },
  ]
}

function takesCategory(card: CardDef, slot: Slot['category']): boolean {
  if (slot === 'spell') return SPELL_CATEGORIES.includes(card.category)
  return card.category === slot
}

/**
 * Remplit un rôle avec un nombre d'exemplaires réaliste :
 * les meilleures cartes montent à 3 copies, les suivantes à 2, le reste à 1.
 */
function fill(
  ordered: CardDef[],
  wanted: number,
  copies: Map<string, number>,
  maxCopies: (card: CardDef) => number,
  take: (card: CardDef) => boolean,
): void {
  if (wanted <= 0) return
  const candidates = ordered.filter(take)
  if (!candidates.length) return

  // ~2 exemplaires par carte en moyenne.
  const unique = Math.min(candidates.length, Math.max(1, Math.round(wanted / 2)))
  const plan = new Map<string, number>()
  for (let i = 0; i < unique; i++) plan.set(candidates[i].id, 1)

  let remaining = wanted - unique
  // Deuxième exemplaire en commençant par le haut du classement.
  for (let i = 0; i < unique && remaining > 0; i++) {
    const card = candidates[i]
    if ((plan.get(card.id) ?? 0) >= maxCopies(card)) continue
    plan.set(card.id, 2)
    remaining -= 1
  }
  // Troisième exemplaire pour les meilleures uniquement.
  for (let i = 0; i < unique && remaining > 0; i++) {
    const card = candidates[i]
    if ((plan.get(card.id) ?? 0) >= maxCopies(card)) continue
    if ((plan.get(card.id) ?? 0) < 2) continue
    plan.set(card.id, 3)
    remaining -= 1
  }

  for (const [id, count] of plan) {
    copies.set(id, Math.min(count, maxCopies(getCard(id))))
  }
}

interface Feasibility {
  universes: Set<string>
  tags: Map<string, number>
  maxPopularity: number
  hasBanish: boolean
  hasDiscard: boolean
}

function feasibilityOf(cards: CardDef[]): Feasibility {
  const universes = new Set<string>()
  const tags = new Map<string, number>()
  let maxPopularity = 0
  let hasBanish = false
  let hasDiscard = false
  for (const card of cards) {
    universes.add(card.universe)
    if (card.category === 'character') {
      maxPopularity = Math.max(maxPopularity, card.popularity ?? 0)
      for (const tag of card.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1)
    }
    for (const fx of card.fx ?? []) {
      for (const op of fx.ops) {
        if (op.op === 'banishTop') hasBanish = true
        if (op.op === 'discard') hasDiscard = true
      }
    }
  }
  return { universes, tags, maxPopularity, hasBanish, hasDiscard }
}

/** Vérifie qu'une invocation spéciale est réalisable avec ce deck principal. */
function specialFeasible(card: CardDef, facts: Feasibility): { ok: boolean; reason: string } {
  const req = card.special?.requires
  if (!req) return { ok: false, reason: 'conditions inconnues' }
  const kind = card.special?.kind ?? 'crossover'

  if (kind === 'crossover' && req.universesDiffer && facts.universes.size < 2) {
    return { ok: false, reason: 'un seul univers dans le deck' }
  }
  if (kind === 'awakening' && (req.minPopularity ?? 0) > facts.maxPopularity) {
    return { ok: false, reason: `aucun personnage de Popularité ${req.minPopularity}+` }
  }
  if (kind === 'resonance' && req.sharedTag) {
    if ((facts.tags.get(req.sharedTag) ?? 0) < req.count) {
      return { ok: false, reason: `pas assez de personnages « ${req.sharedTag} »` }
    }
  }
  if (kind === 'dimensional') {
    if (req.banishedMin && !facts.hasBanish) return { ok: false, reason: 'aucun effet de bannissement' }
    if (req.graveMin && req.graveMin > 6) return { ok: false, reason: 'Cimetière trop lent à remplir' }
    if (req.graveMin && !facts.hasDiscard) {
      // Le Cimetière se remplit aussi par les combats et les techniques jouées.
      return { ok: req.graveMin <= 4, reason: 'Cimetière lent à remplir' }
    }
  }
  if (req.count > 0 && req.count > 3) return { ok: false, reason: 'trop de matériaux requis' }
  return { ok: true, reason: 'conditions réalisables' }
}

/**
 * Construit un deck cohérent et valide.
 * En cas d'impossibilité (collection trop pauvre), renvoie le meilleur effort
 * avec la liste d'erreurs de validation.
 */
export function buildAutoDeck(cards: CardDef[], options: AutoDeckOptions = {}): AutoDeckResult {
  const owned = options.owned ?? (() => 3)
  const seed = options.seed ?? 1337
  const target = Math.min(DECK_MAX, Math.max(DECK_MIN, options.size ?? 60))

  const pool = cards.filter((card) => card.category !== 'special' && owned(card.id) > 0)
  const ownedSpecials = cards.filter((card) => card.category === 'special' && owned(card.id) > 0)

  if (pool.length === 0) {
    return {
      deck: { id: 'auto-vide', name: 'Deck auto (vide)', main: [], extra: [] },
      report: {
        strategy: 'aggro',
        strategyLabel: STRATEGY_LABEL.aggro,
        universe: '',
        universeName: '—',
        tags: [],
        score: 0,
        monsters: 0,
        spells: 0,
        traps: 0,
        terrains: 0,
        specials: 0,
        extraReasons: [],
        notes: ['Aucune carte possédée.'],
      },
      errors: ['Collection vide.'],
    }
  }

  const strategy = options.strategy ?? pickStrategy(pool)
  const universe = options.universe ?? pickUniverse(pool)
  const tags = topTags(pool, universe)
  const ctx: ScoringContext = { strategy, universe, tags, seed }

  const scored = pool
    .map((card) => ({ card, score: scoreCard(card, ctx) }))
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id))

  const ordered = scored.map((entry) => entry.card)
  const copies = new Map<string, number>()
  const maxCopies = (card: CardDef) => Math.max(1, Math.min(MAX_COPIES, owned(card.id)))

  for (const slot of buildQuotas(target, strategy)) {
    fill(ordered, slot.count, copies, maxCopies, (card) => takesCategory(card, slot.category))
  }

  // Complète ou réduit pour respecter exactement la cible.
  let total = [...copies.values()].reduce((sum, n) => sum + n, 0)
  for (const card of ordered) {
    if (total >= target) break
    const current = copies.get(card.id) ?? 0
    if (current >= maxCopies(card)) continue
    copies.set(card.id, current + 1)
    total += 1
  }
  while (total > target) {
    const weakest = [...copies.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => {
        const rankA = ordered.findIndex((card) => card.id === a[0])
        const rankB = ordered.findIndex((card) => card.id === b[0])
        return rankB - rankA
      })[0]
    if (!weakest) break
    copies.set(weakest[0], weakest[1] - 1)
    if (weakest[1] - 1 <= 0) copies.delete(weakest[0])
    total -= 1
  }

  const main = [...copies.entries()].flatMap(([id, count]) => Array.from({ length: count }, () => id))
  const mainCards = main.map((id) => getCard(id))
  const facts = feasibilityOf(mainCards)

  const extraReasons: string[] = []
  const extra: string[] = []
  for (const card of ownedSpecials) {
    if (extra.length >= EXTRA_MAX) break
    const check = specialFeasible(card, facts)
    if (!check.ok) continue
    extra.push(card.id)
    extraReasons.push(`${card.name} — ${check.reason}`)
  }

  const counts = (category: Category | 'spell') => mainCards.filter((card) => takesCategory(card, category)).length
  const scoreTotal = scored
    .filter((entry) => copies.has(entry.card.id))
    .reduce((sum, entry) => sum + entry.score * (copies.get(entry.card.id) ?? 0), 0)

  const orderedTags = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag)

  const notes: string[] = [
    `Archétype ${STRATEGY_LABEL[strategy]} déduit du catalogue possédé.`,
    `Univers dominant : ${universe} (bonus de synergie aux cartes de cet univers).`,
    orderedTags.length ? `Tags partagés privilégiés : ${orderedTags.join(', ')}.` : 'Aucun tag partagé notable.',
    `${extra.length} invocation(s) spéciale(s) retenue(s) selon les conditions réellement réalisables.`,
  ]

  const deck = {
    id: `auto-${strategy}-${Date.now().toString(36)}`,
    name: `Auto · ${STRATEGY_LABEL[strategy]} (${main.length})`,
    main,
    extra,
  }

  const validation = validateDeck(main, extra)

  return {
    deck,
    report: {
      strategy,
      strategyLabel: STRATEGY_LABEL[strategy],
      universe,
      universeName: universeOf(universe).name,
      tags: orderedTags,
      score: Math.round(scoreTotal),
      monsters: counts('character'),
      spells: counts('spell'),
      traps: counts('trap'),
      terrains: counts('terrain'),
      specials: extra.length,
      extraReasons,
      notes,
    },
    errors: validation.errors,
  }
}
