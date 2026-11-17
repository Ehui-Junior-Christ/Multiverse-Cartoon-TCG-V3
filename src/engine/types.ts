/**
 * Types du domaine — partagés par le moteur, l'API locale et l'interface.
 * Aucun import Vue ici : le moteur est une bibliothèque pure et testable.
 */

export type Side = 'player' | 'ai'

export type Category =
  | 'character'
  | 'technique'
  | 'equipment'
  | 'support'
  | 'magic'
  | 'trap'
  | 'terrain'
  | 'special'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'ultra'

export type Keyword =
  | 'piercing'
  | 'doubleAttack'
  | 'destroyImmune'
  | 'targetImmune'
  /** Contre-attaque : détruit l'attaquant après le calcul de dégâts. */
  | 'counterAttack'
  /** Réflexion : les dégâts de combat subis sont renvoyés au contrôleur de l'attaquant. */
  | 'reflect'
  /** Absorption : annule les dégâts de combat subis. */
  | 'absorb'

export type Phase = 'draw' | 'standby' | 'main1' | 'battle' | 'main2' | 'end'

export type Trigger = 'activate' | 'onSummon' | 'onDestroyed' | 'continuous'

export type SpecialKind = 'crossover' | 'awakening' | 'sacrifice' | 'dimensional' | 'resonance'

export type BuffTarget = 'self' | 'equipped' | 'allAllies' | 'strongestAlly' | 'strongestEnemy'

/** Opérations déclaratives : aucune ne peut exécuter de code arbitraire. */
export type Op =
  | { op: 'damage'; who: 'opponent' | 'both' | 'self'; amount: number }
  | { op: 'heal'; amount: number }
  | { op: 'draw'; amount: number }
  | { op: 'buff'; target: BuffTarget; atk?: number; def?: number; duration: 'turn' | 'duel' }
  | { op: 'setStats'; target: BuffTarget; atk?: number; def?: number; duration: 'turn' | 'duel' }
  | { op: 'multiplyStats'; target: BuffTarget; atk?: number; def?: number; duration: 'turn' | 'duel' }
  | { op: 'destroy'; target: 'strongestEnemy' | 'chosenEnemy' }
  | { op: 'discard'; who: 'opponent' | 'self'; amount: number }
  | { op: 'banishTop'; who: 'opponent' | 'self'; amount: number }
  | { op: 'grantKeyword'; target: 'allAllies' | 'self' | 'equipped'; keyword: Keyword; duration: 'turn' | 'duel' }
  | { op: 'gyToHand'; amount: number }
  | { op: 'negate' }

export interface EffectDef {
  id: string
  trigger: Trigger
  speed?: 1 | 2 | 3
  oncePerTurn?: boolean
  /** Limite « une fois par duel » (brief §7). */
  oncePerDuel?: boolean
  mandatory?: boolean
  target?: BuffTarget
  /** Effet ciblé, non ciblé ou global (brief §7). */
  targeting?: 'targeted' | 'untargeted' | 'global'
  ops: Op[]
  text?: string
}

export interface SpecialRequires {
  count: number
  minPopularity?: number
  universesDiffer?: boolean
  sharedTag?: string
  banishedMin?: number
  graveMin?: number
  consume: 'gy' | 'banish' | 'none'
}

export interface CardDef {
  id: string
  name: string
  universe: string
  category: Category
  subcategory?: string
  rarity: Rarity
  popularity?: number
  atk?: number
  def?: number
  tributes?: number
  tags: string[]
  keywords: Keyword[]
  text: string
  fx?: EffectDef[]
  speed?: 1 | 2 | 3
  persistent?: boolean
  lpCost?: number
  special?: { kind: SpecialKind; requires: SpecialRequires }
  signature?: string
  version: number
  status: 'published'
}

export interface Universe {
  id: string
  name: string
  hue: number
  glyph: string
}

export interface CardInstance {
  uid: string
  cardId: string
  faceDown: boolean
  position: 'attack' | 'defense'
  attacksUsed: number
  positionChanged: boolean
  summonedTurn: number
  buffAtk: number
  buffDef: number
  turnAtk: number
  turnDef: number
  /** Modification fixe (setStats) — absente si non modifiée. */
  setAtk?: number
  setDef?: number
  /** Modification multiplicative (multiplyStats), 1 = neutre. */
  mulAtk?: number
  mulDef?: number
  grantedTurn: Keyword[]
  grantedDuel: Keyword[]
  equippedUids: string[]
  equipTargetUid?: string
  slot?: number
  setTurn?: number
  usedEffects: string[]
}

export interface SideState {
  side: Side
  name: string
  lp: number
  deckName: string
  deck: CardInstance[]
  hand: CardInstance[]
  monsters: (CardInstance | null)[]
  spells: (CardInstance | null)[]
  terrain: CardInstance | null
  /** Ordre global d'activation du Terrain : le plus récent a priorité en cas de conflit. */
  terrainOrder: number
  gy: CardInstance[]
  banished: CardInstance[]
  extra: CardInstance[]
}

export interface ChainLink {
  id: number
  controller: Side
  speed: number
  sourceUid: string
  sourceName: string
  ops: Op[]
  negated: boolean
  zone: 'hand' | 'spell' | 'monster' | 'terrain'
  /** Effet ciblé (défaut), non ciblé ou global (brief §7). */
  targeting?: 'targeted' | 'untargeted' | 'global'
}

export type EventKind =
  | 'draw'
  | 'summon'
  | 'set'
  | 'special'
  | 'activate'
  | 'chain'
  | 'resolve'
  | 'attack'
  | 'damage'
  | 'heal'
  | 'destroy'
  | 'banish'
  | 'discard'
  | 'position'
  | 'battle'
  | 'phase'
  | 'turn'
  | 'win'
  | 'suspend'
  | 'info'

export interface DuelEvent {
  n: number
  kind: EventKind
  side?: Side
  text: string
  uid?: string
  cardId?: string
  amount?: number
  targetUid?: string
}

export interface DuelState {
  id: string
  seed: number
  rngState: number
  turn: number
  active: Side
  phase: Phase
  firstSide: Side
  players: Record<Side, SideState>
  chain: ChainLink[]
  pending: { responder: Side } | null
  winner: Side | 'draw' | null
  endReason: string | null
  over: boolean
  suspended: boolean
  diagnostic: string | null
  events: DuelEvent[]
  eventSeq: number
  uid: number
  chainSeq: number
  /** Compteur global d'activations de Terrain (priorité du Terrain le plus récent). */
  terrainSeq: number
  lastDamageSource: Side | null
}

export type Action =
  | { type: 'advance' }
  | { type: 'endTurn' }
  | { type: 'summon'; handIndex: number; position: 'attack' | 'defense'; tributeUids?: string[] }
  | { type: 'setCard'; handIndex: number }
  | { type: 'activate'; handIndex: number; targetUid?: string }
  | { type: 'activateSet'; spellIndex: number }
  | { type: 'activateMonster'; uid: string }
  | { type: 'special'; extraIndex: number }
  | { type: 'attack'; attackerUid: string; targetUid?: string }
  | { type: 'position'; uid: string }
  | { type: 'chain'; handIndex?: number; spellIndex?: number }
  | { type: 'pass' }
  | { type: 'concede'; reason?: string }

export type MoveKind =
  | 'phase'
  | 'summon'
  | 'set'
  | 'activate'
  | 'special'
  | 'attack'
  | 'position'
  | 'chain'
  | 'pass'

export interface LegalMove {
  key: string
  kind: MoveKind
  label: string
  hint?: string
  action: Action
  cardId?: string
  uid?: string
  targetUid?: string
  handIndex?: number
  spellIndex?: number
}

export interface DuelOptions {
  playerName: string
  aiName: string
  playerDeckName: string
  aiDeckName: string
  playerMain: string[]
  playerExtra: string[]
  aiMain: string[]
  aiExtra: string[]
  seed: number
  firstSide: Side
  duelId?: string
}
