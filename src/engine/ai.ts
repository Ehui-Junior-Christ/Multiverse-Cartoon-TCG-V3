/**
 * IA locale — utilise le même moteur et les mêmes règles que le joueur.
 * Elle ne lit jamais la main adverse : toutes les décisions reposent sur
 * l'état public (plateau, LP, compteurs, main de l'IA).
 */
import { CARD_INDEX } from './catalog'
import { applyAction, legalActions, monstersOf, statsFor } from './duel'
import type { Action, DuelState, LegalMove, Side } from './types'

export type Difficulty = 'beginner' | 'normal' | 'advanced' | 'expert'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: 'Débutante',
  normal: 'Normale',
  advanced: 'Avancée',
  expert: 'Experte',
}

const other = (side: Side): Side => (side === 'player' ? 'ai' : 'player')

/** Vue strictement publique : aucune carte cachée adverse n'est lisible. */
interface PublicView {
  myMonsters: ReturnType<typeof monstersOf>
  myLp: number
  foeMonsters: ReturnType<typeof monstersOf>
  foeLp: number
}

function publicView(state: DuelState, side: Side): PublicView {
  const me = state.players[side]
  const foe = state.players[other(side)]
  return {
    myMonsters: monstersOf(me),
    myLp: me.lp,
    foeMonsters: monstersOf(foe),
    foeLp: foe.lp,
  }
}

function scoreMove(state: DuelState, move: LegalMove, side: Side): number {
  const view = publicView(state, side)
  const card = move.cardId ? CARD_INDEX.get(move.cardId) : undefined

  switch (move.kind) {
    case 'summon': {
      const atk = card?.atk ?? 0
      const needed = card?.tributes ?? 0
      return 44 + atk / 55 - needed * 14 + (move.key.endsWith('defense') ? -4 : 4)
    }
    case 'set':
      return 12
    case 'special':
      return 68 + (card?.atk ?? 0) / 70
    case 'activate': {
      const fx = (card?.fx ?? []).find((f) => f.trigger === 'activate')
      let score = 24
      for (const op of fx?.ops ?? []) {
        switch (op.op) {
          case 'damage':
            score += Math.min(30, op.amount / 35)
            break
          case 'heal':
            score += view.myLp < 4000 ? 20 : 4
            break
          case 'draw':
            score += 14 * op.amount
            break
          case 'destroy':
            score += view.foeMonsters.length ? 30 : -20
            break
          case 'buff':
            score += view.myMonsters.length * 3 + 6
            break
          case 'banishTop':
            score += 4 * op.amount
            break
          default:
            score += 4
        }
      }
      if (card?.lpCost) score -= card.lpCost / 120
      return score
    }
    case 'attack': {
      const attacker = view.myMonsters.find((m) => m.uid === move.uid)
      if (!attacker) return -50
      const atk = statsFor(state, side, attacker).atk
      if (!move.targetUid) return 55 + atk / 90
      const target = view.foeMonsters.find((m) => m.uid === move.targetUid)
      if (!target) return -50
      const t = statsFor(state, other(side), target)
      const value = target.position === 'attack' ? t.atk : t.def
      if (target.position === 'attack') {
        if (atk > value) return 60 + (atk - value) / 70
        if (atk === value) return 26
        return -30
      }
      if (atk > value) return 52 + (atk - value) / 120
      return -12
    }
    case 'position':
      return 6
    case 'phase': {
      if (move.action.type === 'endTurn') return 3
      // L'IA doit progresser dans ses phases : sans cela elle terminait son tour
      // depuis la phase de pioche et ne jouait jamais de carte.
      switch (state.phase) {
        case 'draw':
          return 70
        case 'standby':
          return 65
        case 'battle':
          return 46
        case 'main1':
          return 40
        default:
          return 4
      }
    }
    case 'pass':
      return 0
    default:
      return 0
  }
}

function chooseFromMoves(state: DuelState, moves: LegalMove[], side: Side): LegalMove | null {
  let best: LegalMove | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const move of moves) {
    const score = scoreMove(state, move, side)
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }
  return best
}

/**
 * Évaluation heuristique d'un état, du point de vue de `side`.
 * Uniquement des informations publiques : LP, plateau, compteurs.
 */
function evaluate(state: DuelState, side: Side): number {
  if (state.over) {
    if (state.winner === side) return 100000
    if (state.winner === null) return 0
    return -100000
  }
  const me = state.players[side]
  const foe = state.players[other(side)]
  const board = (p: typeof me) =>
    monstersOf(p).reduce((sum, m) => sum + statsFor(state, p.side, m).atk + statsFor(state, p.side, m).def / 2, 0)
  return (me.lp - foe.lp) * 0.1 + (board(me) - board(foe)) * 0.25
}

/** Cherche une attaque létale : renvoie l'action si elle gagne immédiatement. */
function findLethal(state: DuelState, moves: LegalMove[], side: Side): Action | null {
  for (const move of moves) {
    if (move.kind !== 'attack' || move.targetUid) continue
    let next: DuelState
    try {
      next = applyAction(state, move.action, side)
    } catch {
      continue
    }
    if (next.over && next.winner === side) return move.action
  }
  return null
}

/**
 * Un demi-coup : simule l'action puis la meilleure réponse adversaire connue.
 * Renvoie l'évaluation la plus défavorable (du point de vue de `side`).
 */
function lookahead(state: DuelState, move: LegalMove, side: Side): number {
  let next: DuelState
  try {
    next = applyAction(state, move.action, side)
  } catch {
    return Number.NEGATIVE_INFINITY
  }
  if (next.over || next.suspended) return evaluate(next, side)

  const foe = other(side)
  const replies = next.pending
    ? next.pending.responder === foe
      ? legalActions(next, foe)
      : []
    : next.active === foe
      ? legalActions(next, foe)
      : []

  let worst = Number.POSITIVE_INFINITY
  for (const reply of replies.slice(0, 12)) {
    try {
      const after = applyAction(next, reply.action, foe)
      worst = Math.min(worst, evaluate(after, side))
    } catch {
      /* coup illégal : ignoré */
    }
  }
  return worst === Number.POSITIVE_INFINITY ? evaluate(next, side) : worst
}

function chooseChain(state: DuelState, side: Side): Action {
  const moves = legalActions(state, side)
  const chainable = moves.filter((m) => m.kind === 'chain')
  if (!chainable.length) return { type: 'pass' }

  const top = state.chain[state.chain.length - 1]
  const harmful = (top?.ops ?? []).some(
    (op) =>
      (op.op === 'damage' && top?.controller !== side) ||
      op.op === 'destroy' ||
      op.op === 'discard' ||
      op.op === 'banishTop',
  )
  if (!harmful) return { type: 'pass' }

  const best = chooseFromMoves(state, chainable, side)
  return best && scoreMove(state, best, side) > 0 ? best.action : { type: 'pass' }
}

/**
 * Renvoie la prochaine action de l'IA, ou null si ce n'est pas à elle d'agir.
 * `difficulty` module l'agressivité sans jamais contourner les règles.
 */
export function aiChooseAction(state: DuelState, difficulty: Difficulty = 'beginner', side: Side = 'ai'): Action | null {
  if (state.over || state.suspended) return null

  if (state.pending) {
    if (state.pending.responder !== side) return null
    return chooseChain(state, side)
  }
  if (state.active !== side) return null

  const moves = legalActions(state, side)
  if (!moves.length) return null

  if (difficulty === 'beginner') {
    const attacks = moves.filter((m) => m.kind === 'attack' || m.kind === 'special')
    const acts = moves.filter((m) => m.kind !== 'attack' && m.kind !== 'special' && m.kind !== 'phase')
    if (attacks.length || acts.length) {
      const pool = attacks.length && acts.length ? (state.turn % 2 === 0 ? attacks : acts) : attacks.length ? attacks : acts
      const pick = pool[state.rngState % pool.length]
      return pick.action
    }
    return chooseFromMoves(state, moves, side)?.action ?? null
  }

  // Avancée et experte : coup létal d'abord, puis évaluation.
  const lethal = findLethal(state, moves, side)
  if (lethal) return lethal

  if (difficulty === 'advanced') {
    const best = chooseFromMoves(state, moves, side)
    if (!best) return null
    if (best.kind === 'attack' && scoreMove(state, best, side) < 0) {
      const alternative = moves.find((m) => m.kind === 'phase' && m.action.type === 'endTurn')
      if (alternative) return alternative.action
    }
    return best.action
  }

  // Experte : recherche limitée sur les coups les mieux notés.
  const ranked = [...moves].sort((a, b) => scoreMove(state, b, side) - scoreMove(state, a, side))
  const candidates = ranked.slice(0, 8)
  let best: LegalMove = candidates[0]
  let bestValue = Number.NEGATIVE_INFINITY
  for (const move of candidates) {
    const value = lookahead(state, move, side) + scoreMove(state, move, side) * 0.05
    if (value > bestValue) {
      bestValue = value
      best = move
    }
  }
  return best.action
}
