/**
 * MOTEUR DE DUEL — autorité unique des règles.
 *
 * Bibliothèque pure : aucun import Vue, aucun DOM, aucune horloge implicite.
 * `applyAction` clone l'état, valide l'action puis renvoie un nouvel état.
 * Une même graine + les mêmes actions ⇒ le même duel (déterminisme).
 */
import { CARD_INDEX, getCard, SPECIAL_LABEL } from './catalog'
import { STARTING_HAND, START_LP } from './deck'
import { nextInt, seedState, shuffle } from './rng'
import type {
  Action,
  CardDef,
  CardInstance,
  ChainLink,
  DuelEvent,
  DuelOptions,
  DuelState,
  EffectDef,
  EventKind,
  Keyword,
  LegalMove,
  Op,
  Phase,
  Side,
  SideState,
  SpecialKind,
} from './types'

export class RuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleError'
  }
}

export const PHASE_ORDER: Phase[] = ['draw', 'standby', 'main1', 'battle', 'main2', 'end']

export const PHASE_LABEL: Record<Phase, string> = {
  draw: 'Pioche',
  standby: 'Préparation',
  main1: 'Main 1',
  battle: 'Combat',
  main2: 'Main 2',
  end: 'Fin de tour',
}

export const MONSTER_ZONES = 5
export const SPELL_ZONES = 5
export const MAX_CHAIN = 100

const other = (side: Side): Side => (side === 'player' ? 'ai' : 'player')

/**
 * Le joueur qui ouvre le duel ne peut pas attaquer lors du tour 1.
 * Le tour 1 est toujours celui de `firstSide`.
 */
export function isOpeningTurnFor(state: DuelState, side: Side): boolean {
  return state.turn === 1 && side === state.firstSide
}

/* ------------------------------------------------------------------ */
/* Utilitaires d'état                                                  */
/* ------------------------------------------------------------------ */

function pushEvent(state: DuelState, ev: Omit<DuelEvent, 'n'>): void {
  state.events.push({ n: ++state.eventSeq, ...ev })
  if (state.events.length > 600) state.events.splice(0, state.events.length - 600)
}

function cardNameOf(inst: CardInstance): string {
  return CARD_INDEX.get(inst.cardId)?.name ?? inst.cardId
}

function makeInstance(state: DuelState, cardId: string): CardInstance {
  return {
    uid: `${cardId}#${++state.uid}`,
    cardId,
    faceDown: false,
    position: 'attack',
    attacksUsed: 0,
    positionChanged: false,
    summonedTurn: 0,
    buffAtk: 0,
    buffDef: 0,
    turnAtk: 0,
    turnDef: 0,
    grantedTurn: [],
    grantedDuel: [],
    equippedUids: [],
    usedEffects: [],
  }
}

export function monstersOf(p: SideState): CardInstance[] {
  return p.monsters.filter((m): m is CardInstance => Boolean(m))
}

export function allInstances(p: SideState): CardInstance[] {
  return [
    ...p.hand,
    ...p.deck,
    ...p.gy,
    ...p.banished,
    ...p.extra,
    ...monstersOf(p),
    ...p.spells.filter((s): s is CardInstance => Boolean(s)),
    ...(p.terrain ? [p.terrain] : []),
  ]
}

export interface Located {
  inst: CardInstance
  side: Side
  zone: 'hand' | 'deck' | 'gy' | 'banished' | 'extra' | 'monster' | 'spell' | 'terrain'
  index: number
}

export function findByUid(state: DuelState, uid: string): Located | null {
  for (const side of ['player', 'ai'] as Side[]) {
    const p = state.players[side]
    let i = p.hand.findIndex((c) => c.uid === uid)
    if (i >= 0) return { inst: p.hand[i], side, zone: 'hand', index: i }
    i = p.deck.findIndex((c) => c.uid === uid)
    if (i >= 0) return { inst: p.deck[i], side, zone: 'deck', index: i }
    i = p.gy.findIndex((c) => c.uid === uid)
    if (i >= 0) return { inst: p.gy[i], side, zone: 'gy', index: i }
    i = p.banished.findIndex((c) => c.uid === uid)
    if (i >= 0) return { inst: p.banished[i], side, zone: 'banished', index: i }
    i = p.extra.findIndex((c) => c.uid === uid)
    if (i >= 0) return { inst: p.extra[i], side, zone: 'extra', index: i }
    i = p.monsters.findIndex((c) => c?.uid === uid)
    if (i >= 0) return { inst: p.monsters[i] as CardInstance, side, zone: 'monster', index: i }
    i = p.spells.findIndex((c) => c?.uid === uid)
    if (i >= 0) return { inst: p.spells[i] as CardInstance, side, zone: 'spell', index: i }
    if (p.terrain?.uid === uid) return { inst: p.terrain, side, zone: 'terrain', index: 0 }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Statistiques effectives (ATK / DEF / mots-clés)                     */
/* ------------------------------------------------------------------ */

export function statsFor(state: DuelState, side: Side, inst: CardInstance): { atk: number; def: number } {
  const def = CARD_INDEX.get(inst.cardId)
  let atk = def?.atk ?? 0
  let dfn = def?.def ?? 0

  // 1) modificateurs fixes (prioritaires sur la valeur imprimée)
  if (inst.setAtk !== undefined) atk = inst.setAtk
  if (inst.setDef !== undefined) dfn = inst.setDef

  // 2) modificateurs additifs (buffs, tour, équipement)
  atk += inst.buffAtk + inst.turnAtk
  dfn += inst.buffDef + inst.turnDef

  const me = state.players[side]
  const continuousSources: CardInstance[] = [
    ...me.spells.filter((s): s is CardInstance => Boolean(s)),
    ...(me.terrain ? [me.terrain] : []),
  ]
  let mulAtk = inst.mulAtk ?? 1
  let mulDef = inst.mulDef ?? 1

  for (const src of continuousSources) {
    if (src.faceDown) continue
    const srcDef = CARD_INDEX.get(src.cardId)
    for (const fx of srcDef?.fx ?? []) {
      if (fx.trigger !== 'continuous') continue
      for (const op of fx.ops) {
        if (op.op !== 'buff' && op.op !== 'setStats' && op.op !== 'multiplyStats') continue
        if (op.target !== 'allAllies' && op.target !== 'self') continue
        if (op.op === 'buff') {
          atk += op.atk ?? 0
          dfn += op.def ?? 0
        } else if (op.op === 'setStats') {
          if (op.atk !== undefined) atk = op.atk
          if (op.def !== undefined) dfn = op.def
        } else if (op.op === 'multiplyStats') {
          mulAtk *= op.atk ?? 1
          mulDef *= op.def ?? 1
        }
      }
    }
  }

  for (const eqUid of inst.equippedUids) {
    const eq = me.spells.find((s) => s?.uid === eqUid)
    if (!eq) continue
    for (const fx of CARD_INDEX.get(eq.cardId)?.fx ?? []) {
      for (const op of fx.ops) {
        if (op.op === 'buff' && op.target === 'equipped') {
          atk += op.atk ?? 0
          dfn += op.def ?? 0
        }
      }
    }
  }

  // 3) modificateurs multiplicatifs, puis plancher à 0 (brief §6)
  return {
    atk: Math.max(0, Math.round(atk * mulAtk)),
    def: Math.max(0, Math.round(dfn * mulDef)),
  }
}

export function keywordsFor(state: DuelState, side: Side, inst: CardInstance): Set<Keyword> {
  const set = new Set<Keyword>(CARD_INDEX.get(inst.cardId)?.keywords ?? [])
  for (const k of inst.grantedTurn) set.add(k)
  for (const k of inst.grantedDuel) set.add(k)
  const me = state.players[side]
  for (const eqUid of inst.equippedUids) {
    const eq = me.spells.find((s) => s?.uid === eqUid)
    if (!eq) continue
    for (const k of CARD_INDEX.get(eq.cardId)?.keywords ?? []) set.add(k)
  }
  return set
}

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */

/** Terrain actif d'un camp (chaque joueur a le sien ; les deux coexistent). */
export function activeTerrain(state: DuelState, side: Side): CardInstance | null {
  return state.players[side].terrain
}

/** Ordre d'activation du Terrain : la valeur la plus haute a priorité en cas de conflit. */
export function terrainPriorityOf(state: DuelState, side: Side): number {
  return state.players[side].terrain ? state.players[side].terrainOrder : 0
}

/** Texte d'effet continu du Terrain, pour l'interface et le journal. */
export function terrainEffectText(state: DuelState, side: Side): string | null {
  const terrain = activeTerrain(state, side)
  if (!terrain) return null
  const card = CARD_INDEX.get(terrain.cardId)
  const fx = (card?.fx ?? []).find((f) => f.trigger === 'continuous')
  return fx?.text ?? card?.text ?? null
}

/* ------------------------------------------------------------------ */
/* Création du duel                                                    */
/* ------------------------------------------------------------------ */

function buildSide(
  state: DuelState,
  side: Side,
  name: string,
  deckName: string,
  main: string[],
  extra: string[],
): SideState {
  const mainInstances = main.map((id) => makeInstance(state, id))
  const extraInstances = extra.map((id) => makeInstance(state, id))
  return {
    side,
    name,
    deckName,
    lp: START_LP,
    deck: shuffle(state, mainInstances),
    hand: [],
    monsters: Array.from({ length: MONSTER_ZONES }, () => null),
    spells: Array.from({ length: SPELL_ZONES }, () => null),
    terrain: null,
    terrainOrder: 0,
    gy: [],
    banished: [],
    extra: extraInstances,
  }
}

export function createDuel(opts: DuelOptions): DuelState {
  const state: DuelState = {
    id: opts.duelId ?? `duel-${opts.seed}`,
    seed: opts.seed,
    rngState: seedState(opts.seed),
    turn: 1,
    active: opts.firstSide,
    phase: 'standby',
    firstSide: opts.firstSide,
    players: {} as Record<Side, SideState>,
    chain: [],
    pending: null,
    winner: null,
    endReason: null,
    over: false,
    suspended: false,
    diagnostic: null,
    events: [],
    eventSeq: 0,
    uid: 0,
    chainSeq: 0,
    terrainSeq: 0,
    lastDamageSource: null,
  }

  state.players.player = buildSide(state, 'player', opts.playerName, opts.playerDeckName, opts.playerMain, opts.playerExtra)
  state.players.ai = buildSide(state, 'ai', opts.aiName, opts.aiDeckName, opts.aiMain, opts.aiExtra)

  pushEvent(state, { kind: 'info', text: `Duel : ${opts.playerName} (${opts.playerDeckName}) contre ${opts.aiName} (${opts.aiDeckName}).` })
  drawCards(state, 'player', STARTING_HAND, true, true)
  drawCards(state, 'ai', STARTING_HAND, true, true)
  pushEvent(state, { kind: 'info', text: `Mains initiales distribuées : ${STARTING_HAND} cartes chacun, sans mulligan.` })
  beginTurn(state, opts.firstSide, true)
  return state
}

function clearTurnModifiers(state: DuelState): void {
  for (const side of ['player', 'ai'] as Side[]) {
    for (const inst of allInstances(state.players[side])) {
      inst.turnAtk = 0
      inst.turnDef = 0
      inst.grantedTurn = []
    }
  }
}

function beginTurn(state: DuelState, side: Side, opening = false): void {
  if (state.over || state.suspended) return
  state.active = side
  state.phase = 'draw'
  const p = state.players[side]
  for (const m of monstersOf(p)) {
    m.attacksUsed = 0
    m.positionChanged = false
  }
  clearTurnModifiers(state)
  pushEvent(state, { kind: 'turn', side, text: `Tour ${state.turn} — ${p.name}` })

  if (opening && state.turn === 1) {
    pushEvent(state, { kind: 'info', side, text: 'Le premier joueur ne pioche pas à son premier tour.' })
  } else {
    drawCards(state, side, 1)
  }
  if (!state.over) {
    state.phase = 'standby'
  }
}

function drawCards(state: DuelState, side: Side, amount: number, opening = false, quiet = false): void {
  const p = state.players[side]
  for (let i = 0; i < amount; i++) {
    if (!p.deck.length) {
      endDuel(state, other(side), 'Pioche impossible : deck vide')
      return
    }
    const inst = p.deck.shift() as CardInstance
    p.hand.push(inst)
    if (quiet) continue
    const reveal = side === 'player'
    pushEvent(state, {
      kind: 'draw',
      side,
      uid: reveal ? inst.uid : undefined,
      cardId: reveal ? inst.cardId : undefined,
      text: reveal ? `${p.name} pioche ${cardNameOf(inst)}` : `${p.name} pioche une carte`,
    })
  }
  if (opening) return
}

function endDuel(state: DuelState, winner: Side | 'draw' | null, reason: string): void {
  if (state.over) return
  state.over = true
  state.winner = winner
  state.endReason = reason
  state.pending = null
  pushEvent(state, {
    kind: 'win',
    side: winner === 'draw' || winner === null ? undefined : winner,
    text: winner === 'draw' || winner === null ? `Duel interrompu : ${reason}` : `${state.players[winner].name} remporte le duel — ${reason}`,
  })
}

function applyDamage(state: DuelState, targets: Side[], amount: number, controller: Side): void {
  if (state.over || amount <= 0) return
  state.lastDamageSource = controller
  for (const target of targets) {
    const p = state.players[target]
    p.lp = Math.max(0, p.lp - amount)
    pushEvent(state, { kind: 'damage', side: target, amount, text: `${p.name} subit ${amount} dégâts — ${p.lp} LP` })
  }
  const dead = targets.filter((s) => state.players[s].lp <= 0)
  if (dead.length === 0) return
  if (dead.length === targets.length && targets.length > 1) {
    endDuel(state, controller, 'Défaite simultanée : le contrôleur de l’effet l’emporte')
    return
  }
  endDuel(state, other(dead[0]), 'LP épuisés')
}

/* ------------------------------------------------------------------ */
/* Déplacement de cartes                                               */
/* ------------------------------------------------------------------ */

function detachEquipment(state: DuelState, side: Side, inst: CardInstance): void {
  const p = state.players[side]
  for (const m of monstersOf(p)) {
    const idx = m.equippedUids.indexOf(inst.uid)
    if (idx >= 0) m.equippedUids.splice(idx, 1)
  }
}

function removeFromBoard(state: DuelState, side: Side, inst: CardInstance): void {
  const p = state.players[side]
  const monsterIndex = p.monsters.findIndex((m) => m?.uid === inst.uid)
  if (monsterIndex >= 0) {
    p.monsters[monsterIndex] = null
    // Un équipement rejoint le Cimetière si son porteur quitte le terrain.
    for (const eqUid of inst.equippedUids) {
      const eq = p.spells.find((s) => s?.uid === eqUid)
      if (eq) {
        p.spells[eq.slot ?? p.spells.findIndex((s) => s?.uid === eqUid)] = null
        eq.slot = undefined
        eq.equipTargetUid = undefined
        p.gy.push(eq)
        pushEvent(state, { kind: 'info', side, uid: eq.uid, cardId: eq.cardId, text: `${cardNameOf(eq)} rejoint le Cimetière (porteur retiré).` })
      }
    }
    inst.equippedUids = []
  }
  const spellIndex = p.spells.findIndex((s) => s?.uid === inst.uid)
  if (spellIndex >= 0) {
    p.spells[spellIndex] = null
    inst.slot = undefined
  }
  if (p.terrain?.uid === inst.uid) p.terrain = null
  detachEquipment(state, side, inst)
}

function toGraveyard(state: DuelState, side: Side, inst: CardInstance, reason = 'envoyé au Cimetière'): void {
  removeFromBoard(state, side, inst)
  state.players[side].gy.push(inst)
  pushEvent(state, {
    kind: 'destroy',
    side,
    uid: inst.uid,
    cardId: inst.cardId,
    text: `${cardNameOf(inst)} ${reason}`,
  })
}

function destroyMonster(state: DuelState, side: Side, inst: CardInstance, cause: 'effect' | 'battle'): boolean {
  if (cause === 'effect' && keywordsFor(state, side, inst).has('destroyImmune')) {
    pushEvent(state, { kind: 'info', side, uid: inst.uid, cardId: inst.cardId, text: `${cardNameOf(inst)} ne peut pas être détruit par un effet.` })
    return false
  }
  toGraveyard(state, side, inst, cause === 'battle' ? 'est détruit au combat' : 'est détruit par un effet')
  runTrigger(state, side, inst, 'onDestroyed')
  return true
}

/* ------------------------------------------------------------------ */
/* Effets                                                              */
/* ------------------------------------------------------------------ */

type OpContext = Pick<ChainLink, 'controller' | 'sourceUid' | 'sourceName' | 'ops'> & {
  targeting?: 'targeted' | 'untargeted' | 'global'
}

function findStrongest(state: DuelState, side: Side): CardInstance | null {
  const monsters = monstersOf(state.players[side])
  if (!monsters.length) return null
  return monsters.reduce((best, m) => (statsFor(state, side, m).atk > statsFor(state, side, best).atk ? m : best))
}

function resolveBuffTargets(state: DuelState, side: Side, target: string, source: CardInstance | null): Array<{ inst: CardInstance; side: Side }> {
  const me = state.players[side]
  const foe = state.players[other(side)]
  switch (target) {
    case 'self':
      return source && me.monsters.some((m) => m?.uid === source.uid) ? [{ inst: source, side }] : []
    case 'equipped': {
      if (!source) return []
      const carrier = monstersOf(me).find((m) => m.uid === source.equipTargetUid)
      return carrier ? [{ inst: carrier, side }] : []
    }
    case 'allAllies':
      return monstersOf(me)
        .filter((m) => !m.faceDown)
        .map((inst) => ({ inst, side }))
    case 'strongestAlly': {
      const best = findStrongest(state, side)
      return best ? [{ inst: best, side }] : []
    }
    case 'strongestEnemy': {
      const best = findStrongest(state, other(side))
      return best ? [{ inst: best, side: other(side) }] : []
    }
    default:
      return monstersOf(foe).map((inst) => ({ inst, side: other(side) }))
  }
}

function runOps(state: DuelState, ctx: OpContext): void {
  const side = ctx.controller
  const me = state.players[side]
  const foeSide = other(side)
  const sourceLoc = findByUid(state, ctx.sourceUid)
  const source = sourceLoc?.inst ?? null

  for (const op of ctx.ops) {
    if (state.over || state.suspended) return
    switch (op.op) {
      case 'damage': {
        const targets: Side[] = op.who === 'both' ? [side, foeSide] : op.who === 'self' ? [side] : [foeSide]
        applyDamage(state, targets, op.amount, side)
        break
      }
      case 'heal': {
        me.lp += op.amount
        pushEvent(state, { kind: 'heal', side, amount: op.amount, text: `${me.name} gagne ${op.amount} LP — ${me.lp} LP` })
        break
      }
      case 'draw':
        drawCards(state, side, op.amount)
        break
      case 'buff': {
        for (const { inst, side: owner } of resolveBuffTargets(state, side, op.target, source)) {
          if (op.duration === 'turn') {
            inst.turnAtk += op.atk ?? 0
            inst.turnDef += op.def ?? 0
          } else {
            inst.buffAtk += op.atk ?? 0
            inst.buffDef += op.def ?? 0
          }
          const stats = statsFor(state, owner, inst)
          pushEvent(state, {
            kind: 'info',
            side: owner,
            uid: inst.uid,
            cardId: inst.cardId,
            text: `${cardNameOf(inst)} : ${op.atk ? `+${op.atk} ATK` : ''}${op.atk && op.def ? ' / ' : ''}${op.def ? `+${op.def} DEF` : ''} (${stats.atk}/${stats.def})`,
          })
        }
        break
      }
      case 'setStats': {
        for (const { inst, side: owner } of resolveBuffTargets(state, side, op.target, source)) {
          if (op.atk !== undefined) inst.setAtk = op.atk
          if (op.def !== undefined) inst.setDef = op.def
          const stats = statsFor(state, owner, inst)
          pushEvent(state, {
            kind: 'info',
            side: owner,
            uid: inst.uid,
            cardId: inst.cardId,
            text: `${cardNameOf(inst)} : statistiques fixées (${stats.atk}/${stats.def})`,
          })
        }
        break
      }
      case 'multiplyStats': {
        for (const { inst, side: owner } of resolveBuffTargets(state, side, op.target, source)) {
          inst.mulAtk = (inst.mulAtk ?? 1) * (op.atk ?? 1)
          inst.mulDef = (inst.mulDef ?? 1) * (op.def ?? 1)
          const stats = statsFor(state, owner, inst)
          pushEvent(state, {
            kind: 'info',
            side: owner,
            uid: inst.uid,
            cardId: inst.cardId,
            text: `${cardNameOf(inst)} : statistiques multipliées (${stats.atk}/${stats.def})`,
          })
        }
        break
      }
      case 'destroy': {
        const victim = findStrongest(state, foeSide)
        // `targetImmune` protège d'un effet **ciblé** ; un effet non ciblé ou global l'ignore (brief §7).
        const targeted = (ctx.targeting ?? 'targeted') === 'targeted'
        const immune = victim && targeted && keywordsFor(state, foeSide, victim).has('targetImmune')
        if (victim && !immune) destroyMonster(state, foeSide, victim, 'effect')
        else if (immune && victim) {
          pushEvent(state, { kind: 'info', side: foeSide, uid: victim.uid, cardId: victim.cardId, text: `${cardNameOf(victim)} ne peut pas être ciblé.` })
        }
        break
      }
      case 'discard': {
        const victimSide = op.who === 'self' ? side : foeSide
        const victim = state.players[victimSide]
        for (let i = 0; i < op.amount; i++) {
          if (!victim.hand.length) break
          const idx = nextInt(state, victim.hand.length)
          const [card] = victim.hand.splice(idx, 1)
          victim.gy.push(card)
          pushEvent(state, { kind: 'discard', side: victimSide, text: `${victim.name} défausse une carte`, cardId: victimSide === 'player' ? card.cardId : undefined })
        }
        break
      }
      case 'banishTop': {
        const victimSide = op.who === 'self' ? side : foeSide
        const victim = state.players[victimSide]
        for (let i = 0; i < op.amount; i++) {
          const card = victim.deck.shift()
          if (!card) break
          victim.banished.push(card)
        }
        pushEvent(state, { kind: 'banish', side: victimSide, amount: op.amount, text: `${victim.name} bannit ${op.amount} carte(s) du dessus de son deck` })
        break
      }
      case 'grantKeyword': {
        const resolved =
          op.target === 'equipped'
            ? resolveBuffTargets(state, side, 'equipped', source)
            : op.target === 'allAllies'
              ? resolveBuffTargets(state, side, 'allAllies', source)
              : resolveBuffTargets(state, side, 'self', source)
        for (const { inst } of resolved) {
          if (op.duration === 'turn') inst.grantedTurn.push(op.keyword)
          else inst.grantedDuel.push(op.keyword)
          pushEvent(state, { kind: 'info', side, uid: inst.uid, cardId: inst.cardId, text: `${cardNameOf(inst)} gagne : ${KEYWORD_LABEL[op.keyword]}` })
        }
        break
      }
      case 'gyToHand': {
        for (let i = 0; i < op.amount; i++) {
          const candidates = me.gy
            .map((c, idx) => ({ c, idx }))
            .filter(({ c }) => CARD_INDEX.get(c.cardId)?.category === 'character')
            .sort((a, b) => (CARD_INDEX.get(b.c.cardId)?.atk ?? 0) - (CARD_INDEX.get(a.c.cardId)?.atk ?? 0))
          const pick = candidates[0]
          if (!pick) break
          me.gy.splice(pick.idx, 1)
          me.hand.push(pick.c)
          pushEvent(state, { kind: 'info', side, uid: pick.c.uid, cardId: pick.c.cardId, text: `${cardNameOf(pick.c)} revient du Cimetière dans la main` })
        }
        break
      }
      case 'negate':
        // Traité pendant la résolution de la chaîne.
        break
    }
  }
}

export const KEYWORD_LABEL: Record<Keyword, string> = {
  piercing: 'Transperce',
  doubleAttack: 'Attaque double',
  destroyImmune: 'Immunité à la destruction par effet',
  targetImmune: 'Ciblage impossible',
  counterAttack: 'Contre-attaque',
  reflect: 'Réflexion des dégâts',
  absorb: 'Absorption des dégâts',
}

/** Clé de limite d'effet : par tour (brief §7) ou par duel. */
function effectLimitKey(fx: EffectDef, state: DuelState): string {
  return fx.oncePerDuel ? `${fx.id}@duel` : `${fx.id}@${state.turn}`
}

function effectLimited(inst: CardInstance, fx: EffectDef, state: DuelState): boolean {
  if (!fx.oncePerTurn && !fx.oncePerDuel) return false
  return inst.usedEffects.includes(effectLimitKey(fx, state))
}

function markEffectUsed(inst: CardInstance, fx: EffectDef, state: DuelState): void {
  if (fx.oncePerTurn || fx.oncePerDuel) inst.usedEffects.push(effectLimitKey(fx, state))
}

function runTrigger(state: DuelState, side: Side, inst: CardInstance, trigger: 'onSummon' | 'onDestroyed'): void {
  const card = getCard(inst.cardId)
  for (const fx of card.fx ?? []) {
    if (fx.trigger !== trigger) continue
    if (effectLimited(inst, fx, state)) continue
    markEffectUsed(inst, fx, state)
    pushEvent(state, { kind: 'activate', side, uid: inst.uid, cardId: inst.cardId, text: `${card.name} — ${fx.text ?? 'effet déclenché'}` })
    runOps(state, { controller: side, sourceUid: inst.uid, sourceName: card.name, ops: fx.ops, targeting: fx.targeting })
  }
}

/* ------------------------------------------------------------------ */
/* Chaînes                                                             */
/* ------------------------------------------------------------------ */

function openChain(
  state: DuelState,
  side: Side,
  link: {
    sourceUid: string
    sourceName: string
    speed: number
    ops: Op[]
    zone: ChainLink['zone']
    targeting?: ChainLink['targeting']
  },
): void {
  state.chainSeq += 1
  state.chain.push({
    id: state.chainSeq,
    controller: side,
    negated: false,
    ...link,
  })
  pushEvent(state, {
    kind: 'chain',
    side,
    text: `Chaîne ${state.chain.length} — ${link.sourceName} (Vitesse ${link.speed})`,
  })

  if (state.chain.length >= MAX_CHAIN) {
    state.suspended = true
    state.diagnostic = `Plafond de sécurité atteint (${MAX_CHAIN} maillons) : duel suspendu sans vainqueur désigné.`
    pushEvent(state, { kind: 'suspend', text: state.diagnostic })
    state.pending = null
    return
  }

  if (link.speed >= 2) {
    state.pending = { responder: other(side) }
  } else {
    // Speed 1 : aucune réponse possible, résolution immédiate.
    resolveChain(state)
  }
}

function cleanupChainSource(state: DuelState, link: ChainLink): void {
  const loc = findByUid(state, link.sourceUid)
  if (!loc) return
  const card = CARD_INDEX.get(loc.inst.cardId)
  if (!card) return
  if (card.persistent) return
  if (loc.zone === 'spell') {
    toGraveyard(state, loc.side, loc.inst, 'rejoint le Cimetière après résolution')
  }
}

function resolveChain(state: DuelState): void {
  state.pending = null
  while (state.chain.length && !state.over && !state.suspended) {
    const link = state.chain.pop() as ChainLink
    if (link.negated) {
      pushEvent(state, { kind: 'info', side: link.controller, text: `${link.sourceName} — activation annulée` })
      cleanupChainSource(state, link)
      continue
    }
    pushEvent(state, { kind: 'resolve', side: link.controller, text: `Résolution : ${link.sourceName}` })
    runOps(state, link)
    if (!state.over && !state.suspended && link.ops.some((o) => o.op === 'negate')) {
      const target = state.chain[state.chain.length - 1]
      if (target) {
        target.negated = true
        pushEvent(state, { kind: 'info', side: link.controller, text: `${link.sourceName} annule ${target.sourceName}` })
      }
    }
    cleanupChainSource(state, link)
  }
  state.chain = []
}

/* ------------------------------------------------------------------ */
/* Actions de jeu                                                      */
/* ------------------------------------------------------------------ */

function playerOf(state: DuelState, side: Side): SideState {
  return state.players[side]
}

function requireActive(state: DuelState, side: Side): void {
  if (state.over) throw new RuleError('Le duel est terminé.')
  if (state.suspended) throw new RuleError('Le duel est suspendu.')
  if (state.pending) throw new RuleError('Une chaîne attend une réponse.')
  if (state.active !== side) throw new RuleError("Ce n'est pas votre tour.")
}

function freeMonsterZone(p: SideState): number {
  return p.monsters.findIndex((z) => z === null)
}

function freeSpellZone(p: SideState): number {
  return p.spells.findIndex((z) => z === null)
}

function tributesNeeded(card: CardDef): number {
  return card.tributes ?? 0
}

function sacrificeMaterials(state: DuelState, side: Side, needed: number): CardInstance[] {
  const p = playerOf(state, side)
  return monstersOf(p)
    .slice()
    .sort((a, b) => statsFor(state, side, a).atk - statsFor(state, side, b).atk)
    .slice(0, needed)
}

function summonCharacter(state: DuelState, side: Side, handIndex: number, position: 'attack' | 'defense'): void {
  requireActive(state, side)
  if (state.phase !== 'main1' && state.phase !== 'main2') throw new RuleError('Invocation possible uniquement en Main Phase.')
  const p = playerOf(state, side)
  const inst = p.hand[handIndex]
  if (!inst) throw new RuleError('Carte introuvable en main.')
  const card = getCard(inst.cardId)
  if (card.category !== 'character') throw new RuleError('Seul un personnage peut être invoqué.')
  const needed = tributesNeeded(card)
  const owned = monstersOf(p)
  if (owned.length < needed) throw new RuleError(`${card.name} nécessite ${needed} sacrifice(s).`)
  const zone = freeMonsterZone(p)
  if (zone === -1 && needed === 0) throw new RuleError('Aucune zone Personnage libre.')

  if (needed > 0) {
    for (const material of sacrificeMaterials(state, side, needed)) {
      toGraveyard(state, side, material, 'est sacrifié')
    }
  }
  p.hand.splice(handIndex, 1)
  inst.position = position
  inst.faceDown = false
  inst.summonedTurn = state.turn
  const slot = freeMonsterZone(p)
  if (slot === -1) throw new RuleError('Aucune zone Personnage libre.')
  p.monsters[slot] = inst
  pushEvent(state, {
    kind: 'summon',
    side,
    uid: inst.uid,
    cardId: inst.cardId,
    text: `${p.name} invoque ${card.name} en position ${position === 'attack' ? "d'attaque" : 'de défense'}`,
  })
  runTrigger(state, side, inst, 'onSummon')
}

function setCard(state: DuelState, side: Side, handIndex: number): void {
  requireActive(state, side)
  if (state.phase !== 'main1' && state.phase !== 'main2') throw new RuleError('Pose possible uniquement en Main Phase.')
  const p = playerOf(state, side)
  const inst = p.hand[handIndex]
  if (!inst) throw new RuleError('Carte introuvable en main.')
  const card = getCard(inst.cardId)

  if (card.category === 'character') {
    const zone = freeMonsterZone(p)
    if (zone === -1) throw new RuleError('Aucune zone Personnage libre.')
    p.hand.splice(handIndex, 1)
    inst.faceDown = true
    inst.position = 'defense'
    inst.summonedTurn = state.turn
    p.monsters[zone] = inst
    pushEvent(state, { kind: 'set', side, text: `${p.name} pose un personnage face cachée en défense` })
    return
  }

  if (card.category === 'terrain') throw new RuleError('Un Terrain s’active, il ne se pose pas.')
  if (card.category === 'equipment') throw new RuleError('Un Équipement doit être activé sur un personnage.')

  const slot = freeSpellZone(p)
  if (slot === -1) throw new RuleError('Zone Magie/Piège pleine.')
  p.hand.splice(handIndex, 1)
  inst.faceDown = true
  inst.slot = slot
  inst.setTurn = state.turn
  p.spells[slot] = inst
  pushEvent(state, { kind: 'set', side, text: `${p.name} pose une carte face cachée` })
}

interface ActivationCheck {
  ok: boolean
  reason?: string
  targetUid?: string
  fx?: EffectDef
  speed: number
}

function activationCheck(state: DuelState, side: Side, inst: CardInstance): ActivationCheck {
  const card = getCard(inst.cardId)
  const p = playerOf(state, side)
  if (card.category === 'character' || card.category === 'special') return { ok: false, reason: 'Carte non activable depuis la main.', speed: 1 }
  if (card.category === 'trap') return { ok: false, reason: 'Un Piège doit être posé avant activation.', speed: 2 }
  if ((card.lpCost ?? 0) > p.lp) return { ok: false, reason: `Coût de ${card.lpCost} LP non payé.`, speed: 1 }
  if (card.category === 'terrain') return { ok: true, fx: (card.fx ?? []).find((f) => f.trigger === 'activate'), speed: card.speed ?? 1 }
  if (card.category === 'equipment') {
    const target = monstersOf(p)
      .filter((m) => !m.faceDown)
      .sort((a, b) => statsFor(state, side, b).atk - statsFor(state, side, a).atk)[0]
    if (!target) return { ok: false, reason: 'Aucun personnage à équiper.', speed: 1 }
    return { ok: true, targetUid: target.uid, fx: (card.fx ?? []).find((f) => f.trigger === 'activate'), speed: card.speed ?? 1 }
  }
  if (freeSpellZone(p) === -1) return { ok: false, reason: 'Zone Magie/Piège pleine.', speed: 1 }
  return { ok: true, fx: (card.fx ?? []).find((f) => f.trigger === 'activate'), speed: card.speed ?? 1 }
}

function activateFromHand(state: DuelState, side: Side, handIndex: number): void {
  requireActive(state, side)
  if (state.phase !== 'main1' && state.phase !== 'main2') throw new RuleError('Activation possible uniquement en Main Phase.')
  const p = playerOf(state, side)
  const inst = p.hand[handIndex]
  if (!inst) throw new RuleError('Carte introuvable en main.')
  const card = getCard(inst.cardId)
  const check = activationCheck(state, side, inst)
  if (!check.ok) throw new RuleError(check.reason ?? 'Activation impossible.')

  if (card.lpCost) {
    p.lp -= card.lpCost
    pushEvent(state, { kind: 'info', side, text: `${p.name} paie ${card.lpCost} LP (${p.lp} LP restants)` })
    if (p.lp <= 0) {
      endDuel(state, other(side), 'LP épuisés par un coût')
      return
    }
  }

  p.hand.splice(handIndex, 1)

  if (card.category === 'terrain') {
    if (p.terrain) {
      toGraveyard(state, side, p.terrain, 'est remplacé')
    }
    p.terrain = inst
    inst.slot = 0
    inst.faceDown = false
    state.terrainSeq += 1
    p.terrainOrder = state.terrainSeq
    const effect = (card.fx ?? []).find((f) => f.trigger === 'continuous')
    pushEvent(state, {
      kind: 'activate',
      side,
      uid: inst.uid,
      cardId: inst.cardId,
      text: `${p.name} active le Terrain ${card.name}${effect?.text ? ` — ${effect.text}` : ''}`,
    })
    return
  }

  const slot = freeSpellZone(p)
  inst.slot = slot
  inst.faceDown = false
  p.spells[slot] = inst

  if (card.category === 'equipment' && check.targetUid) {
    const target = monstersOf(p).find((m) => m.uid === check.targetUid)
    if (target) {
      target.equippedUids.push(inst.uid)
      inst.equipTargetUid = target.uid
    }
  }

  pushEvent(state, { kind: 'activate', side, uid: inst.uid, cardId: inst.cardId, text: `${p.name} active ${card.name}` })

  if (check.fx) {
    openChain(state, side, {
      sourceUid: inst.uid,
      sourceName: card.name,
      speed: check.speed,
      ops: check.fx.ops,
      targeting: check.fx.targeting,
      zone: 'spell',
    })
  }
}

function activateSet(state: DuelState, side: Side, spellIndex: number): void {
  requireActive(state, side)
  if (state.phase !== 'main1' && state.phase !== 'main2') throw new RuleError('Activation possible uniquement en Main Phase.')
  const p = playerOf(state, side)
  const inst = p.spells[spellIndex]
  if (!inst || !inst.faceDown) throw new RuleError('Aucune carte posée dans cette zone.')
  if ((inst.setTurn ?? 0) >= state.turn) throw new RuleError('Une carte posée ne peut pas être activée le tour de sa pose.')
  const card = getCard(inst.cardId)
  inst.faceDown = false
  pushEvent(state, { kind: 'activate', side, uid: inst.uid, cardId: inst.cardId, text: `${p.name} active ${card.name}` })
  const fx = (card.fx ?? []).find((f) => f.trigger === 'activate')
  if (fx) {
    openChain(state, side, {
      sourceUid: inst.uid,
      sourceName: card.name,
      speed: fx.speed ?? card.speed ?? 2,
      ops: fx.ops,
      targeting: fx.targeting,
      zone: 'spell',
    })
  }
}

function activateMonsterEffect(state: DuelState, side: Side, uid: string): void {
  requireActive(state, side)
  if (state.phase !== 'main1' && state.phase !== 'main2') throw new RuleError('Effet activable uniquement en Main Phase.')
  const p = playerOf(state, side)
  const inst = monstersOf(p).find((m) => m.uid === uid)
  if (!inst) throw new RuleError('Personnage introuvable.')
  if (inst.faceDown) throw new RuleError('Un personnage face cachée ne peut pas activer son effet.')
  const card = getCard(inst.cardId)
  const fx = (card.fx ?? []).find((f) => f.trigger === 'activate')
  if (!fx) throw new RuleError('Aucun effet activable.')
  if (effectLimited(inst, fx, state)) {
    throw new RuleError(fx.oncePerDuel ? 'Effet déjà utilisé durant ce duel.' : 'Effet déjà utilisé ce tour.')
  }
  markEffectUsed(inst, fx, state)
  pushEvent(state, { kind: 'activate', side, uid: inst.uid, cardId: inst.cardId, text: `${card.name} — ${fx.text ?? 'effet activé'}` })
  openChain(state, side, { sourceUid: inst.uid, sourceName: card.name, speed: fx.speed ?? 1, ops: fx.ops, targeting: fx.targeting, zone: 'monster' })
}

function chainWithCard(state: DuelState, side: Side, handIndex?: number, spellIndex?: number): void {
  if (!state.pending) throw new RuleError('Aucune chaîne en cours.')
  if (state.pending.responder !== side) throw new RuleError('Vous ne pouvez pas répondre à cette chaîne.')
  const topSpeed = state.chain[state.chain.length - 1]?.speed ?? 1
  const p = playerOf(state, side)

  if (handIndex != null) {
    const inst = p.hand[handIndex]
    if (!inst) throw new RuleError('Carte introuvable en main.')
    const card = getCard(inst.cardId)
    if (card.category === 'trap') throw new RuleError('Un Piège doit être posé avant activation.')
    const fx = (card.fx ?? []).find((f) => f.trigger === 'activate')
    const speed = fx?.speed ?? card.speed ?? 1
    if (!fx) throw new RuleError('Cette carte n’a pas d’effet activable.')
    if (speed < 2) throw new RuleError('Vitesse 1 : impossible de répondre à une chaîne.')
    if (speed < topSpeed) throw new RuleError(`Vitesse ${speed} insuffisante face à une Vitesse ${topSpeed}.`)
    if ((card.lpCost ?? 0) > p.lp) throw new RuleError('LP insuffisants.')
    if (card.lpCost) {
      p.lp -= card.lpCost
      if (p.lp <= 0) {
        endDuel(state, other(side), 'LP épuisés par un coût')
        return
      }
    }
    p.hand.splice(handIndex, 1)
    const slot = freeSpellZone(p)
    if (slot === -1) throw new RuleError('Zone Magie/Piège pleine.')
    inst.slot = slot
    inst.faceDown = false
    p.spells[slot] = inst
    openChain(state, side, { sourceUid: inst.uid, sourceName: card.name, speed, ops: fx.ops, zone: 'spell' })
    return
  }

  if (spellIndex != null) {
    const inst = p.spells[spellIndex]
    if (!inst || !inst.faceDown) throw new RuleError('Aucune carte posée dans cette zone.')
    if ((inst.setTurn ?? 0) >= state.turn) throw new RuleError('Carte posée ce tour : activation impossible.')
    const card = getCard(inst.cardId)
    const fx = (card.fx ?? []).find((f) => f.trigger === 'activate')
    const speed = fx?.speed ?? card.speed ?? 2
    if (!fx) throw new RuleError('Cette carte n’a pas d’effet activable.')
    if (speed < topSpeed) throw new RuleError(`Vitesse ${speed} insuffisante face à une Vitesse ${topSpeed}.`)
    inst.faceDown = false
    pushEvent(state, { kind: 'activate', side, uid: inst.uid, cardId: inst.cardId, text: `${p.name} chaîne ${card.name} (Vitesse ${speed})` })
    openChain(state, side, { sourceUid: inst.uid, sourceName: card.name, speed, ops: fx.ops, zone: 'spell' })
    return
  }

  throw new RuleError('Sélectionnez une carte à chaîner.')
}

function changePosition(state: DuelState, side: Side, uid: string): void {
  requireActive(state, side)
  if (state.phase !== 'main1' && state.phase !== 'main2') throw new RuleError('Changement de position uniquement en Main Phase.')
  const inst = monstersOf(playerOf(state, side)).find((m) => m.uid === uid)
  if (!inst) throw new RuleError('Personnage introuvable.')
  if (inst.positionChanged) throw new RuleError('Position déjà changée ce tour.')
  if (inst.attacksUsed > 0) throw new RuleError('Un personnage qui a attaqué ne peut pas changer de position.')
  inst.faceDown = false
  inst.position = inst.position === 'attack' ? 'defense' : 'attack'
  inst.positionChanged = true
  pushEvent(state, {
    kind: 'position',
    side,
    uid,
    cardId: inst.cardId,
    text: `${cardNameOf(inst)} passe en position ${inst.position === 'attack' ? "d'attaque" : 'de défense'}`,
  })
}

/**
 * Résolution d'une attaque en sous-étapes explicites (brief §6) :
 * Battle Start → Battle Step (révélation/target) → Damage Step → Battle End.
 * Chaque étape est journalisée ; les statistiques sont figées au Damage Step.
 */
function performAttack(state: DuelState, side: Side, attackerUid: string, targetUid?: string): void {
  requireActive(state, side)
  if (state.phase !== 'battle') throw new RuleError('Les attaques se déclarent en Battle Phase.')
  if (isOpeningTurnFor(state, side)) {
    throw new RuleError('Le premier joueur ne peut pas attaquer lors de son premier tour.')
  }
  const me = playerOf(state, side)
  const foeSide = other(side)
  const foe = playerOf(state, foeSide)
  const attacker = monstersOf(me).find((m) => m.uid === attackerUid)
  if (!attacker) throw new RuleError('Attaquant introuvable.')
  if (attacker.faceDown || attacker.position !== 'attack') throw new RuleError('Ce personnage ne peut pas attaquer dans cette position.')
  const attackLimit = keywordsFor(state, side, attacker).has('doubleAttack') ? 2 : 1
  if (attacker.attacksUsed >= attackLimit) throw new RuleError('Ce personnage a déjà attaqué ce tour.')

  const enemies = monstersOf(foe)

  // --- Battle Start ---
  pushEvent(state, {
    kind: 'battle',
    side,
    uid: attacker.uid,
    cardId: attacker.cardId,
    targetUid,
    text: `Battle Start — ${cardNameOf(attacker)} déclare une attaque`,
  })
  attacker.attacksUsed += 1

  if (enemies.length === 0) {
    if (targetUid) throw new RuleError('Aucun personnage adverse à cibler.')
    // --- Damage Step (attaque directe) ---
    const attackerStats = statsFor(state, side, attacker)
    pushEvent(state, {
      kind: 'battle',
      side,
      text: `Damage Step — attaque directe : ${attackerStats.atk} dégâts`,
    })
    applyDamage(state, [foeSide], attackerStats.atk, side)
    pushEvent(state, { kind: 'battle', side, text: 'Battle End' })
    return
  }

  if (!targetUid) throw new RuleError('Choisissez un personnage adverse à attaquer.')
  let target = enemies.find((m) => m.uid === targetUid)
  if (!target) throw new RuleError('Cible introuvable.')

  // --- Battle Step : changement de cible impossible, la cible est révélée ---
  if (target.faceDown) {
    target.faceDown = false
    pushEvent(state, { kind: 'position', side: foeSide, uid: target.uid, cardId: target.cardId, text: `${cardNameOf(target)} est révélé` })
  }

  // Si la cible a quitté le terrain entre la déclaration et le calcul, pas de combat (brief §6).
  const stillTarget = monstersOf(foe).find((m) => m.uid === targetUid)
  if (!stillTarget) {
    pushEvent(state, { kind: 'battle', side, text: 'Battle End — la cible a quitté le terrain, aucun dégât.' })
    return
  }
  target = stillTarget

  // --- Damage Step : statistiques figées ---
  const attackerStats = statsFor(state, side, attacker)
  const targetStats = statsFor(state, foeSide, target)
  const targetKeywords = keywordsFor(state, foeSide, target)
  const attackerKeywords = keywordsFor(state, side, attacker)
  pushEvent(state, {
    kind: 'battle',
    side,
    text: `Damage Step — ${attackerStats.atk} ATK contre ${target.position === 'attack' ? `${targetStats.atk} ATK` : `${targetStats.def} DEF`}`,
  })

  /** Applique des dégâts de combat en respectant absorption et réflexion (capacités de la victime, figées avant destruction). */
  const battleDamage = (victimSide: Side, amount: number, dealerSide: Side, victimKeywords: Set<Keyword>) => {
    if (amount <= 0) return
    if (victimKeywords.has('absorb')) {
      pushEvent(state, { kind: 'info', side: victimSide, text: 'Absorption : les dégâts de combat sont annulés.' })
      return
    }
    if (victimKeywords.has('reflect')) {
      pushEvent(state, { kind: 'info', side: victimSide, text: 'Réflexion : les dégâts sont renvoyés à l’attaquant.' })
      applyDamage(state, [dealerSide], amount, victimSide)
      return
    }
    applyDamage(state, [victimSide], amount, dealerSide)
  }

  if (target.position === 'attack') {
    if (attackerStats.atk > targetStats.atk) {
      const diff = attackerStats.atk - targetStats.atk
      const destroyed = destroyMonster(state, foeSide, target, 'battle')
      if (destroyed) battleDamage(foeSide, diff, side, targetKeywords)
    } else if (attackerStats.atk < targetStats.atk) {
      const diff = targetStats.atk - attackerStats.atk
      const destroyed = destroyMonster(state, side, attacker, 'battle')
      if (destroyed) battleDamage(side, diff, foeSide, attackerKeywords)
    } else {
      destroyMonster(state, side, attacker, 'battle')
      destroyMonster(state, foeSide, target, 'battle')
      pushEvent(state, { kind: 'info', side, text: 'Égalité d’ATK : les deux personnages sont détruits, aucun LP perdu.' })
    }
  } else if (attackerStats.atk > targetStats.def) {
    destroyMonster(state, foeSide, target, 'battle')
    if (attackerKeywords.has('piercing')) {
      battleDamage(foeSide, attackerStats.atk - targetStats.def, side, targetKeywords)
    }
  } else {
    pushEvent(state, {
      kind: 'info',
      side,
      text: targetStats.def > attackerStats.atk ? `La DEF de ${cardNameOf(target)} bloque l’attaque.` : 'Égalité : aucun personnage détruit.',
    })
  }

  // Contre-attaque : si la cible est toujours là, elle détruit l'attaquant.
  const stillThere = monstersOf(foe).some((m) => m.uid === targetUid)
  const attackerStillThere = monstersOf(me).some((m) => m.uid === attackerUid)
  if (stillThere && attackerStillThere && targetKeywords.has('counterAttack')) {
    pushEvent(state, { kind: 'info', side: foeSide, text: `Contre-attaque de ${cardNameOf(target)}.` })
    destroyMonster(state, side, attacker, 'battle')
  }
  void targetKeywords

  pushEvent(state, { kind: 'battle', side, text: 'Battle End' })
}

export interface SpecialOption {
  extraIndex: number
  cardId: string
  name: string
  kind: SpecialKind
  kindLabel: string
  ok: boolean
  reason?: string
  materials: string[]
}

function checkSpecial(state: DuelState, side: Side, card: CardDef): { ok: boolean; reason?: string; materials: string[] } {
  const p = playerOf(state, side)
  const req = card.special?.requires
  if (!req) return { ok: false, reason: 'Carte sans condition d’invocation.', materials: [] }
  if (!p.monsters.includes(null)) return { ok: false, reason: 'Aucune zone Personnage libre.', materials: [] }

  if (req.banishedMin && p.banished.length < req.banishedMin) {
    return { ok: false, reason: `${req.banishedMin} carte(s) bannie(s) requise(s) (${p.banished.length} actuellement).`, materials: [] }
  }
  if (req.graveMin && p.gy.length < req.graveMin) {
    return { ok: false, reason: `${req.graveMin} carte(s) au Cimetière requise(s) (${p.gy.length} actuellement).`, materials: [] }
  }
  if (card.special?.kind === 'dimensional') return { ok: true, materials: [] }

  const candidates = monstersOf(p)
    .filter((m) => !m.faceDown)
    .filter((m) => (CARD_INDEX.get(m.cardId)?.popularity ?? 0) >= (req.minPopularity ?? 0))

  if (candidates.length < req.count) {
    return { ok: false, reason: `${req.count} personnage(s) de Popularité ${req.minPopularity ?? 1}+ requis.`, materials: [] }
  }
  if (req.universesDiffer) {
    for (const a of candidates) {
      for (const b of candidates) {
        if (a.uid === b.uid) continue
        if (CARD_INDEX.get(a.cardId)?.universe !== CARD_INDEX.get(b.cardId)?.universe) {
          return { ok: true, materials: [a.uid, b.uid] }
        }
      }
    }
    return { ok: false, reason: 'Deux univers différents requis parmi les matériaux.', materials: [] }
  }
  if (req.sharedTag) {
    const tags = new Set(candidates.flatMap((m) => CARD_INDEX.get(m.cardId)?.tags ?? []))
    for (const tag of tags) {
      const withTag = candidates.filter((m) => (CARD_INDEX.get(m.cardId)?.tags ?? []).includes(tag))
      if (withTag.length >= req.count) return { ok: true, materials: withTag.slice(0, req.count).map((m) => m.uid) }
    }
    return { ok: false, reason: `Deux personnages partageant le tag « ${req.sharedTag} » requis.`, materials: [] }
  }
  return { ok: true, materials: candidates.slice(0, req.count).map((m) => m.uid) }
}

export function specialOptions(state: DuelState, side: Side): SpecialOption[] {
  const p = playerOf(state, side)
  return p.extra.map((inst, index) => {
    const card = getCard(inst.cardId)
    const check = checkSpecial(state, side, card)
    return {
      extraIndex: index,
      cardId: card.id,
      name: card.name,
      kind: card.special?.kind ?? 'crossover',
      kindLabel: SPECIAL_LABEL[card.special?.kind ?? 'crossover'],
      ok: check.ok,
      reason: check.reason,
      materials: check.materials,
    }
  })
}

function performSpecialSummon(state: DuelState, side: Side, extraIndex: number): void {
  requireActive(state, side)
  if (state.phase !== 'main1' && state.phase !== 'main2') throw new RuleError('Invocation spéciale uniquement en Main Phase.')
  const p = playerOf(state, side)
  const inst = p.extra[extraIndex]
  if (!inst) throw new RuleError('Carte introuvable dans l’Extra Deck.')
  const card = getCard(inst.cardId)
  const check = checkSpecial(state, side, card)
  if (!check.ok) throw new RuleError(check.reason ?? 'Conditions non remplies.')
  const req = card.special?.requires

  for (const uid of check.materials) {
    const found = findByUid(state, uid)
    if (!found || found.zone !== 'monster') continue
    if (req?.consume === 'banish') {
      removeFromBoard(state, found.side, found.inst)
      p.banished.push(found.inst)
      pushEvent(state, { kind: 'banish', side, text: `${cardNameOf(found.inst)} est banni comme matériau` })
    } else if (req?.consume === 'gy') {
      toGraveyard(state, side, found.inst, 'est utilisé comme matériau')
    }
  }

  const slot = freeMonsterZone(p)
  if (slot === -1) throw new RuleError('Aucune zone Personnage libre.')
  p.extra.splice(extraIndex, 1)
  inst.position = 'attack'
  inst.faceDown = false
  inst.summonedTurn = state.turn
  p.monsters[slot] = inst
  pushEvent(state, {
    kind: 'special',
    side,
    uid: inst.uid,
    cardId: inst.cardId,
    text: `${p.name} réalise ${SPECIAL_LABEL[card.special?.kind ?? 'crossover']} : ${card.name}`,
  })
  runTrigger(state, side, inst, 'onSummon')
}

function stepPhase(state: DuelState, side: Side): void {
  requireActive(state, side)
  switch (state.phase) {
    case 'standby':
      state.phase = 'main1'
      break
    case 'main1':
      state.phase = 'battle'
      break
    case 'battle':
      state.phase = 'main2'
      break
    case 'main2':
      state.phase = 'end'
      break
    case 'end':
      state.turn += 1
      beginTurn(state, other(state.active))
      return
    default:
      state.phase = 'standby'
  }
  pushEvent(state, { kind: 'phase', side, text: `Phase : ${PHASE_LABEL[state.phase]}` })
}

function endTurnEarly(state: DuelState, side: Side): void {
  requireActive(state, side)
  state.phase = 'end'
  pushEvent(state, { kind: 'phase', side, text: `Phase : ${PHASE_LABEL.end}` })
  state.turn += 1
  beginTurn(state, other(state.active))
}

/* ------------------------------------------------------------------ */
/* Actions légales                                                     */
/* ------------------------------------------------------------------ */

function chainMoves(state: DuelState, side: Side): LegalMove[] {
  const topSpeed = state.chain[state.chain.length - 1]?.speed ?? 1
  const p = playerOf(state, side)
  const moves: LegalMove[] = []

  p.hand.forEach((inst, index) => {
    const card = getCard(inst.cardId)
    if (card.category === 'trap' || card.category === 'character' || card.category === 'special') return
    const fx = (card.fx ?? []).find((f) => f.trigger === 'activate')
    if (!fx) return
    const speed = fx.speed ?? card.speed ?? 1
    if (speed < 2 || speed < topSpeed) return
    if ((card.lpCost ?? 0) > p.lp) return
    moves.push({
      key: `chain:hand:${inst.uid}`,
      kind: 'chain',
      label: `Chaîner ${card.name} (Vitesse ${speed})`,
      hint: fx.text,
      action: { type: 'chain', handIndex: index },
      cardId: card.id,
      handIndex: index,
    })
  })

  p.spells.forEach((inst, index) => {
    if (!inst || !inst.faceDown) return
    const card = getCard(inst.cardId)
    if (card.category !== 'trap') return
    if ((inst.setTurn ?? 0) >= state.turn) return
    const fx = (card.fx ?? []).find((f) => f.trigger === 'activate')
    if (!fx) return
    const speed = fx.speed ?? card.speed ?? 2
    if (speed < topSpeed) return
    moves.push({
      key: `chain:set:${inst.uid}`,
      kind: 'chain',
      label: `Chaîner ${card.name} (Vitesse ${speed})`,
      hint: fx.text,
      action: { type: 'chain', spellIndex: index },
      cardId: card.id,
      spellIndex: index,
    })
  })

  moves.push({ key: 'pass', kind: 'pass', label: 'Laisser résoudre', action: { type: 'pass' } })
  return moves
}

export function legalActions(state: DuelState, side: Side): LegalMove[] {
  if (state.over || state.suspended) return []
  if (state.pending) {
    if (state.pending.responder !== side) return []
    return chainMoves(state, side)
  }
  if (state.active !== side) return []

  const p = playerOf(state, side)
  const foe = playerOf(state, other(side))
  const moves: LegalMove[] = []
  const isMain = state.phase === 'main1' || state.phase === 'main2'

  moves.push({
    key: 'advance',
    kind: 'phase',
    label: state.phase === 'main2' ? 'Fin de tour' : 'Phase suivante',
    action: { type: 'advance' },
  })
  if (state.phase !== 'end') {
    moves.push({ key: 'endTurn', kind: 'phase', label: 'Terminer le tour', action: { type: 'endTurn' } })
  }

  if (isMain) {
    p.hand.forEach((inst, index) => {
      const card = getCard(inst.cardId)

      if (card.category === 'character') {
        const needed = tributesNeeded(card)
        const owned = monstersOf(p).length
        const freeZones = p.monsters.filter((z) => z === null).length
        const canPay = owned >= needed
        const zoneAfter = freeZones + Math.min(needed, owned)
        if (canPay && zoneAfter >= 1) {
          moves.push({
            key: `summon:${inst.uid}:attack`,
            kind: 'summon',
            label: `Invoquer ${card.name}`,
            hint: needed ? `${needed} sacrifice(s) · ATK ${card.atk}` : `ATK ${card.atk} · DEF ${card.def}`,
            action: { type: 'summon', handIndex: index, position: 'attack' },
            cardId: card.id,
            uid: inst.uid,
            handIndex: index,
          })
          moves.push({
            key: `summon:${inst.uid}:defense`,
            kind: 'summon',
            label: `Invoquer ${card.name} en défense`,
            hint: needed ? `${needed} sacrifice(s) · DEF ${card.def}` : `DEF ${card.def}`,
            action: { type: 'summon', handIndex: index, position: 'defense' },
            cardId: card.id,
            uid: inst.uid,
            handIndex: index,
          })
        }
        if (freeZones > 0) {
          moves.push({
            key: `set:${inst.uid}`,
            kind: 'set',
            label: `Poser ${card.name} face cachée`,
            hint: 'Position de défense',
            action: { type: 'setCard', handIndex: index },
            cardId: card.id,
            uid: inst.uid,
            handIndex: index,
          })
        }
      } else if (card.category === 'trap' || card.category === 'support') {
        if (freeSpellZone(p) >= 0) {
          moves.push({
            key: `set:${inst.uid}`,
            kind: 'set',
            label: `Poser ${card.name} face cachée`,
            action: { type: 'setCard', handIndex: index },
            cardId: card.id,
            uid: inst.uid,
            handIndex: index,
          })
        }
      }

      const check = activationCheck(state, side, inst)
      if (check.ok) {
        moves.push({
          key: `activate:${inst.uid}`,
          kind: 'activate',
          label: card.category === 'terrain' ? `Activer le Terrain ${card.name}` : `Activer ${card.name}`,
          hint: check.fx?.text ?? card.text,
          action: { type: 'activate', handIndex: index, targetUid: check.targetUid },
          cardId: card.id,
          uid: inst.uid,
          handIndex: index,
        })
      }
    })

    for (const option of specialOptions(state, side)) {
      if (!option.ok) continue
      moves.push({
        key: `special:${option.extraIndex}`,
        kind: 'special',
        label: `Invoquer ${option.name}`,
        hint: option.kindLabel,
        action: { type: 'special', extraIndex: option.extraIndex },
        cardId: option.cardId,
      })
    }

    p.spells.forEach((inst, index) => {
      if (!inst || !inst.faceDown) return
      if ((inst.setTurn ?? 0) >= state.turn) return
      const card = getCard(inst.cardId)
      if (!(card.fx ?? []).some((f) => f.trigger === 'activate')) return
      moves.push({
        key: `activateSet:${inst.uid}`,
        kind: 'activate',
        label: `Activer ${card.name}`,
        hint: 'Carte posée',
        action: { type: 'activateSet', spellIndex: index },
        cardId: card.id,
        uid: inst.uid,
        spellIndex: index,
      })
    })

    for (const m of monstersOf(p)) {
      if (m.faceDown) continue
      const card = getCard(m.cardId)
      const fx = (card.fx ?? []).find((f) => f.trigger === 'activate')
      if (!fx) continue
      if (effectLimited(m, fx, state)) continue
      moves.push({
        key: `monster:${m.uid}`,
        kind: 'activate',
        label: `${card.name} — effet`,
        hint: fx.text,
        action: { type: 'activateMonster', uid: m.uid },
        cardId: card.id,
        uid: m.uid,
      })
    }

    for (const m of monstersOf(p)) {
      if (m.positionChanged || m.attacksUsed > 0) continue
      moves.push({
        key: `position:${m.uid}`,
        kind: 'position',
        label: `Basculer ${cardNameOf(m)}`,
        hint: m.position === 'attack' ? '→ Défense' : '→ Attaque',
        action: { type: 'position', uid: m.uid },
        cardId: m.cardId,
        uid: m.uid,
      })
    }
  }

  if (state.phase === 'battle' && !isOpeningTurnFor(state, side)) {
    const enemies = monstersOf(foe)
    for (const m of monstersOf(p)) {
      if (m.faceDown || m.position !== 'attack') continue
      const limit = keywordsFor(state, side, m).has('doubleAttack') ? 2 : 1
      if (m.attacksUsed >= limit) continue
      const stats = statsFor(state, side, m)
      if (!enemies.length) {
        moves.push({
          key: `attack:${m.uid}:direct`,
          kind: 'attack',
          label: `Attaque directe — ${cardNameOf(m)}`,
          hint: `${stats.atk} dégâts`,
          action: { type: 'attack', attackerUid: m.uid },
          cardId: m.cardId,
          uid: m.uid,
        })
      } else {
        for (const target of enemies) {
          const tStats = statsFor(state, other(side), target)
          moves.push({
            key: `attack:${m.uid}:${target.uid}`,
            kind: 'attack',
            label: `${cardNameOf(m)} attaque ${cardNameOf(target)}`,
            hint: `${stats.atk} vs ${target.position === 'attack' ? tStats.atk : tStats.def}`,
            action: { type: 'attack', attackerUid: m.uid, targetUid: target.uid },
            cardId: m.cardId,
            uid: m.uid,
            targetUid: target.uid,
          })
        }
      }
    }
  }

  return moves
}

/* ------------------------------------------------------------------ */
/* Application d'une action                                            */
/* ------------------------------------------------------------------ */

export function applyAction(state: DuelState, action: Action, side: Side): DuelState {
  const next = structuredClone(state)

  switch (action.type) {
    case 'advance':
      stepPhase(next, side)
      break
    case 'endTurn':
      endTurnEarly(next, side)
      break
    case 'summon':
      summonCharacter(next, side, action.handIndex, action.position)
      break
    case 'setCard':
      setCard(next, side, action.handIndex)
      break
    case 'activate':
      activateFromHand(next, side, action.handIndex)
      break
    case 'activateSet':
      activateSet(next, side, action.spellIndex)
      break
    case 'activateMonster':
      activateMonsterEffect(next, side, action.uid)
      break
    case 'special':
      performSpecialSummon(next, side, action.extraIndex)
      break
    case 'attack':
      performAttack(next, side, action.attackerUid, action.targetUid)
      break
    case 'position':
      changePosition(next, side, action.uid)
      break
    case 'chain':
      chainWithCard(next, side, action.handIndex, action.spellIndex)
      break
    case 'pass': {
      if (!next.pending) throw new RuleError('Aucune chaîne en cours.')
      if (next.pending.responder !== side) throw new RuleError('Vous ne pouvez pas répondre à cette chaîne.')
      resolveChain(next)
      break
    }
    case 'concede':
      endDuel(next, other(side), action.reason ?? 'abandon')
      break
    default:
      throw new RuleError('Action inconnue.')
  }

  return next
}

/** Limite de sécurité pour les boucles d'IA (une IA ne doit jamais bloquer l'interface). */
export function isDuelFinished(state: DuelState): boolean {
  return state.over || state.suspended
}

export function remainingExtraDeck(state: DuelState, side: Side): number {
  return state.players[side].extra.length
}

export function hasPrompt(state: DuelState, side: Side): boolean {
  return Boolean(state.pending) && state.pending?.responder === side
}
