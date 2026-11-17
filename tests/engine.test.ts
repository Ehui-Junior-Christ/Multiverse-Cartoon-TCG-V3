import { describe, expect, it } from 'vitest'
import { CARDS, getCard } from '../src/engine/catalog'
import { AI_DECK, PLAYER_DECK } from '../src/data/decks'
import { validateDeck } from '../src/engine/deck'
import {
  activeTerrain,
  applyAction,
  createDuel,
  isOpeningTurnFor,
  legalActions,
  RuleError,
  specialOptions,
  statsFor,
  terrainEffectText,
  terrainPriorityOf,
} from '../src/engine/duel'
import { aiChooseAction } from '../src/engine/ai'
import type { CardDef, CardInstance, DuelState, Side } from '../src/engine/types'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let uidSeq = 0
function mk(cardId: string, overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    uid: `${cardId}#test${++uidSeq}`,
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
    ...overrides,
  }
}

function newDuel(seed = 42, firstSide: Side = 'player'): DuelState {
  return createDuel({
    playerName: 'Joueur',
    aiName: 'IA Cosmique',
    playerDeckName: PLAYER_DECK.name,
    aiDeckName: AI_DECK.name,
    playerMain: PLAYER_DECK.main,
    playerExtra: PLAYER_DECK.extra,
    aiMain: AI_DECK.main,
    aiExtra: AI_DECK.extra,
    seed,
    firstSide,
  })
}

/** Prépare un plateau contrôlé : vide les mains et places les cartes demandées. */
function scenario(config: {
  playerMonsters?: Array<{ id: string; position?: 'attack' | 'defense'; grantedDuel?: CardDef['keywords'] }>
  aiMonsters?: Array<{ id: string; position?: 'attack' | 'defense'; grantedDuel?: CardDef['keywords'] }>
  playerHand?: string[]
  aiTrapSet?: string[]
  phase?: DuelState['phase']
  turn?: number
}): DuelState {
  const state = newDuel(7, 'player')
  for (const side of ['player', 'ai'] as Side[]) {
    const p = state.players[side]
    p.hand = []
    p.monsters = [null, null, null, null, null]
    p.spells = [null, null, null, null, null]
    p.gy = []
    p.banished = []
  }
  state.phase = config.phase ?? 'main1'
  state.turn = config.turn ?? 2
  ;(config.playerMonsters ?? []).forEach((m, i) => {
    state.players.player.monsters[i] = mk(m.id, { position: m.position ?? 'attack', grantedDuel: m.grantedDuel ?? [] })
  })
  ;(config.aiMonsters ?? []).forEach((m, i) => {
    state.players.ai.monsters[i] = mk(m.id, { position: m.position ?? 'attack', grantedDuel: m.grantedDuel ?? [] })
  })
  ;(config.playerHand ?? []).forEach((id) => state.players.player.hand.push(mk(id)))
  ;(config.aiTrapSet ?? []).forEach((id, i) => {
    state.players.ai.spells[i] = mk(id, { faceDown: true, slot: i, setTurn: 1 })
  })
  return state
}

/* ------------------------------------------------------------------ */
/* Catalogue et construction de deck                                   */
/* ------------------------------------------------------------------ */

describe('catalogue de démonstration', () => {
  it('contient 360 cartes réparties par catégorie', () => {
    expect(CARDS).toHaveLength(360)
    const count = (category: CardDef['category']) => CARDS.filter((c) => c.category === category).length
    expect(count('character')).toBe(164)
    expect(count('technique')).toBe(41)
    expect(count('equipment')).toBe(25)
    expect(count('support')).toBe(25)
    expect(count('magic')).toBe(34)
    expect(count('trap')).toBe(23)
    expect(count('terrain')).toBe(14)
    expect(count('special')).toBe(34)
  })

  it('respecte Popularité 1..12 et bannit le vocabulaire énergie/niveau', () => {
    for (const card of CARDS) {
      if (card.category === 'character') {
        expect(card.popularity, card.id).toBeGreaterThanOrEqual(1)
        expect(card.popularity, card.id).toBeLessThanOrEqual(12)
      }
      const text = `${card.name} ${card.text}`.toLowerCase()
      expect(text, card.id).not.toMatch(/niveau|énergie|energie|mana|stamina/)
    }
  })

  it('ne contient que des opérations déclaratives connues', () => {
    const allowed = new Set([
      'damage',
      'heal',
      'draw',
      'buff',
      'setStats',
      'multiplyStats',
      'destroy',
      'discard',
      'banishTop',
      'grantKeyword',
      'gyToHand',
      'negate',
    ])
    for (const card of CARDS) {
      for (const fx of card.fx ?? []) {
        for (const op of fx.ops) expect(allowed.has(op.op), `${card.id}:${op.op}`).toBe(true)
      }
    }
  })
})

describe('règles de deck', () => {
  it('accepte les decks de démonstration', () => {
    expect(validateDeck(PLAYER_DECK.main, PLAYER_DECK.extra).valid, validateDeck(PLAYER_DECK.main, PLAYER_DECK.extra).errors.join(' | ')).toBe(true)
    expect(validateDeck(AI_DECK.main, AI_DECK.extra).valid, validateDeck(AI_DECK.main, AI_DECK.extra).errors.join(' | ')).toBe(true)
  })

  it('refuse un deck trop court, un doublon excédentaire et une invocation spéciale en main', () => {
    const short = PLAYER_DECK.main.slice(0, 40)
    expect(validateDeck(short, []).valid).toBe(false)

    const tooMany = [...PLAYER_DECK.main.slice(0, 41), 'chr-bugs', 'chr-bugs', 'chr-bugs', 'chr-bugs']
    expect(validateDeck(tooMany, []).errors.some((e) => e.includes('maximum'))).toBe(true)

    const withSpecial = [...PLAYER_DECK.main.slice(0, 43), 'spx-heros-multivers']
    expect(validateDeck(withSpecial, []).errors.some((e) => e.includes('Extra Deck'))).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Mise en place                                                       */
/* ------------------------------------------------------------------ */

describe('mise en place du duel', () => {
  it('applique 10 000 LP, 6 cartes en main et un premier joueur sans pioche', () => {
    const state = newDuel()
    expect(state.players.player.lp).toBe(10000)
    expect(state.players.ai.lp).toBe(10000)
    expect(state.players.player.hand).toHaveLength(6)
    expect(state.players.ai.hand).toHaveLength(6)
    expect(state.players.ai.deck).toHaveLength(AI_DECK.main.length - 6)
    expect(state.turn).toBe(1)
    expect(state.active).toBe('player')
    expect(state.phase).toBe('standby')
    expect(state.events.some((e) => e.text.includes('ne pioche pas'))).toBe(true)
  })

  it('applique la main de 6 sans mulligan et un second joueur qui pioche', () => {
    const state = newDuel(3, 'ai')
    expect(state.players.ai.hand).toHaveLength(6)
    expect(state.players.player.hand).toHaveLength(6)
    expect(state.active).toBe('ai')
  })

  it('enchaîne les phases puis passe la main avec pioche', () => {
    let state = newDuel(11, 'player')
    expect(state.phase).toBe('standby')
    state = applyAction(state, { type: 'advance' }, 'player')
    expect(state.phase).toBe('main1')
    const handBefore = state.players.ai.hand.length
    state = applyAction(state, { type: 'endTurn' }, 'player')
    expect(state.active).toBe('ai')
    expect(state.turn).toBe(2)
    expect(state.players.ai.hand.length).toBe(handBefore + 1)
  })
})

/* ------------------------------------------------------------------ */
/* Invocation et sacrifices                                            */
/* ------------------------------------------------------------------ */

describe('invocations', () => {
  it('invoque un personnage et déclenche son effet onSummon', () => {
    const state = scenario({ playerHand: ['chr-ben-tenyson'] })
    const handBefore = state.players.player.hand.length
    const next = applyAction(state, { type: 'summon', handIndex: 0, position: 'attack' }, 'player')
    expect(next.players.player.monsters[0]?.cardId).toBe('chr-ben-tenyson')
    // La carte quitte la main (-1) puis l'effet d'invocation fait piocher (+1).
    expect(next.players.player.hand).toHaveLength(handBefore)
    const log = next.events.map((e) => e.text).join(' | ')
    expect(log).toContain('invoque Ben Tennyson')
    expect(next.events.some((e) => e.kind === 'draw')).toBe(true)
  })

  it('exige et consomme les sacrifices des personnages puissants', () => {
    const waybig = getCard('chr-waybig')
    expect(waybig.tributes).toBe(2)
    const state = scenario({
      playerMonsters: [{ id: 'chr-bob' }, { id: 'chr-tom' }],
      playerHand: ['chr-waybig'],
    })
    const next = applyAction(state, { type: 'summon', handIndex: 0, position: 'attack' }, 'player')
    const fielded = next.players.player.monsters.filter(Boolean).map((m) => m!.cardId)
    expect(fielded).toContain('chr-waybig')
    expect(fielded).not.toContain('chr-bob')
    expect(fielded).not.toContain('chr-tom')
    expect(next.players.player.gy.map((c) => c.cardId)).toEqual(expect.arrayContaining(['chr-bob', 'chr-tom']))
    // onSummon de Way Big : 600 dégâts
    expect(next.players.ai.lp).toBe(9400)
  })

  it('refuse une invocation sans sacrifices disponibles', () => {
    const state = scenario({ playerHand: ['chr-waybig'] })
    expect(() => applyAction(state, { type: 'summon', handIndex: 0, position: 'attack' }, 'player')).toThrow(RuleError)
  })

  it('refuse une invocation hors Main Phase', () => {
    const state = scenario({ playerHand: ['chr-bob'], phase: 'battle' })
    expect(() => applyAction(state, { type: 'summon', handIndex: 0, position: 'attack' }, 'player')).toThrow(/Main Phase/)
  })
})

/* ------------------------------------------------------------------ */
/* Combat                                                              */
/* ------------------------------------------------------------------ */

describe('combat', () => {
  it('ATK vs ATK : le plus faible est détruit et la différence est infligée', () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-buttercup' }], // 2100
      aiMonsters: [{ id: 'chr-tom' }], // 1700
    })
    const attacker = state.players.player.monsters[0]!
    const target = state.players.ai.monsters[0]!
    const next = applyAction(state, { type: 'attack', attackerUid: attacker.uid, targetUid: target.uid }, 'player')
    expect(next.players.ai.monsters[0]).toBeNull()
    expect(next.players.ai.gy.map((c) => c.cardId)).toContain('chr-tom')
    expect(next.players.ai.lp).toBe(10000 - 400)
    expect(next.players.player.lp).toBe(10000)
  })

  it('ATK vs ATK égal : destruction mutuelle sans perte de LP', () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-finn' }], // 1900
      aiMonsters: [{ id: 'chr-butch' }], // 1900
    })
    const next = applyAction(
      state,
      {
        type: 'attack',
        attackerUid: state.players.player.monsters[0]!.uid,
        targetUid: state.players.ai.monsters[0]!.uid,
      },
      'player',
    )
    expect(next.players.player.monsters[0]).toBeNull()
    expect(next.players.ai.monsters[0]).toBeNull()
    expect(next.players.player.lp).toBe(10000)
    expect(next.players.ai.lp).toBe(10000)
  })

  it('ATK vs DEF : détruit sans dégâts si ATK > DEF, sinon rien', () => {
    const win = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-surchauffe' }], // 2100, sans piercing
      aiMonsters: [{ id: 'chr-carlo', position: 'defense' }], // 1900 DEF
    })
    const afterWin = applyAction(
      win,
      { type: 'attack', attackerUid: win.players.player.monsters[0]!.uid, targetUid: win.players.ai.monsters[0]!.uid },
      'player',
    )
    expect(afterWin.players.ai.monsters[0]).toBeNull()
    expect(afterWin.players.ai.lp).toBe(10000)

    const block = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-bob' }], // 1200
      aiMonsters: [{ id: 'chr-diamantane', position: 'defense' }], // 2200 DEF
    })
    const afterBlock = applyAction(
      block,
      { type: 'attack', attackerUid: block.players.player.monsters[0]!.uid, targetUid: block.players.ai.monsters[0]!.uid },
      'player',
    )
    expect(afterBlock.players.ai.monsters[0]).not.toBeNull()
    expect(afterBlock.players.player.monsters[0]).not.toBeNull()
    expect(afterBlock.players.ai.lp).toBe(10000)
  })

  it("transperce avec le mot-clé piercing", () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-quatre-bras' }], // 2400 + piercing
      aiMonsters: [{ id: 'chr-carlo', position: 'defense' }], // 1900 DEF
    })
    const next = applyAction(
      state,
      { type: 'attack', attackerUid: state.players.player.monsters[0]!.uid, targetUid: state.players.ai.monsters[0]!.uid },
      'player',
    )
    expect(next.players.ai.lp).toBe(10000 - 500)
  })

  it('autorise une attaque directe sans personnage adverse', () => {
    const state = scenario({ phase: 'battle', playerMonsters: [{ id: 'chr-bob' }] })
    const next = applyAction(state, { type: 'attack', attackerUid: state.players.player.monsters[0]!.uid }, 'player')
    expect(next.players.ai.lp).toBe(10000 - 1200)
  })

  it("interdit d'attaquer deux fois sans Attaque double", () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-bob' }],
      aiMonsters: [{ id: 'chr-titi', position: 'defense' }],
    })
    const attacker = state.players.player.monsters[0]!.uid
    const target = state.players.ai.monsters[0]!.uid
    const once = applyAction(state, { type: 'attack', attackerUid: attacker, targetUid: target }, 'player')
    expect(() => applyAction(once, { type: 'attack', attackerUid: attacker, targetUid: target }, 'player')).toThrow(/déjà attaqué/)
  })

  it("autorise deux attaques avec Attaque double", () => {
    const state = scenario({ phase: 'battle', playerMonsters: [{ id: 'chr-tom' }] })
    const attacker = state.players.player.monsters[0]!.uid
    const once = applyAction(state, { type: 'attack', attackerUid: attacker }, 'player')
    const twice = applyAction(once, { type: 'attack', attackerUid: attacker }, 'player')
    expect(twice.players.ai.lp).toBe(10000 - 3400)
  })
})

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

describe('positions', () => {
  it('limite le changement de position à une fois par tour', () => {
    const state = scenario({ playerMonsters: [{ id: 'chr-bob' }] })
    const uid = state.players.player.monsters[0]!.uid
    const next = applyAction(state, { type: 'position', uid }, 'player')
    expect(next.players.player.monsters[0]!.position).toBe('defense')
    expect(() => applyAction(next, { type: 'position', uid }, 'player')).toThrow(/déjà changée/)
  })

  it("interdit l'attaque en position de défense", () => {
    const state = scenario({ phase: 'battle', playerMonsters: [{ id: 'chr-bob', position: 'defense' }] })
    expect(() => applyAction(state, { type: 'attack', attackerUid: state.players.player.monsters[0]!.uid }, 'player')).toThrow(/position/)
  })
})

/* ------------------------------------------------------------------ */
/* Règle du premier tour                                               */
/* ------------------------------------------------------------------ */

describe('règle du premier tour', () => {
  it('reconnaît le tour 1 du premier joueur', () => {
    const state = newDuel(7, 'player')
    expect(state.turn).toBe(1)
    expect(isOpeningTurnFor(state, 'player')).toBe(true)
    expect(isOpeningTurnFor(state, 'ai')).toBe(false)
  })

  it("interdit au premier joueur d'attaquer au tour 1", () => {
    const state = scenario({ phase: 'battle', turn: 1, playerMonsters: [{ id: 'chr-bob' }] })
    const attackerUid = state.players.player.monsters[0]!.uid
    expect(() => applyAction(state, { type: 'attack', attackerUid }, 'player')).toThrow(/premier tour/)
    expect(legalActions(state, 'player').some((m) => m.kind === 'attack')).toBe(false)
  })

  it("autorise l'attaque à partir du tour 2", () => {
    const state = scenario({ phase: 'battle', turn: 2, playerMonsters: [{ id: 'chr-bob' }] })
    expect(legalActions(state, 'player').some((m) => m.kind === 'attack')).toBe(true)
  })

  it("n'empêche pas le second joueur d'attaquer à son premier tour", () => {
    const state = newDuel(7, 'player')
    state.turn = 2
    state.active = 'ai'
    state.phase = 'battle'
    state.players.ai.monsters[0] = mk('chr-bob')
    expect(isOpeningTurnFor(state, 'ai')).toBe(false)
    expect(legalActions(state, 'ai').some((m) => m.kind === 'attack')).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Terrains                                                            */
/* ------------------------------------------------------------------ */

describe('terrains', () => {
  it('active un Terrain dans sa zone et applique son effet continu', () => {
    const state = scenario({ playerHand: ['ter-cite'], playerMonsters: [{ id: 'chr-bob' }] })
    expect(activeTerrain(state, 'player')).toBeNull()
    const next = applyAction(state, { type: 'activate', handIndex: 0 }, 'player')
    expect(activeTerrain(next, 'player')?.cardId).toBe('ter-cite')
    expect(terrainEffectText(next, 'player')).toMatch(/\+300 ATK/)
    // Bob 1200 + 300 du Terrain
    const bob = next.players.player.monsters[0]!
    expect(statsFor(next, 'player', bob).atk).toBe(1500)
  })

  it('remplace le Terrain existant : l’ancien part au Cimetière', () => {
    const state = scenario({ playerHand: ['ter-bikini'] })
    state.players.player.terrain = mk('ter-cite')
    state.players.player.terrainOrder = 1
    state.terrainSeq = 1
    const next = applyAction(state, { type: 'activate', handIndex: 0 }, 'player')
    expect(activeTerrain(next, 'player')?.cardId).toBe('ter-bikini')
    expect(next.players.player.gy.map((c) => c.cardId)).toContain('ter-cite')
    expect(next.players.player.terrainOrder).toBeGreaterThan(1)
  })

  it('les deux camps peuvent avoir un Terrain actif en même temps', () => {
    const state = scenario({ playerHand: ['ter-cite'] })
    state.players.ai.terrain = mk('ter-lab')
    const next = applyAction(state, { type: 'activate', handIndex: 0 }, 'player')
    expect(activeTerrain(next, 'player')?.cardId).toBe('ter-cite')
    expect(activeTerrain(next, 'ai')?.cardId).toBe('ter-lab')
    expect(terrainPriorityOf(next, 'player')).toBeGreaterThan(terrainPriorityOf(next, 'ai'))
  })

  it('refuse de poser un Terrain face cachée', () => {
    const state = scenario({ playerHand: ['ter-cite'] })
    expect(() => applyAction(state, { type: 'setCard', handIndex: 0 }, 'player')).toThrow(/Terrain/)
  })

  it('active un Terrain uniquement en Main Phase', () => {
    const state = scenario({ playerHand: ['ter-cite'], phase: 'battle' })
    expect(() => applyAction(state, { type: 'activate', handIndex: 0 }, 'player')).toThrow(/Main Phase/)
  })
})

/* ------------------------------------------------------------------ */
/* Sous-étapes de combat et capacités défensives                       */
/* ------------------------------------------------------------------ */

describe('sous-étapes de combat', () => {
  it('journalise Battle Start, Damage Step et Battle End', () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-buttercup' }],
      aiMonsters: [{ id: 'chr-tom' }],
    })
    const next = applyAction(
      state,
      { type: 'attack', attackerUid: state.players.player.monsters[0]!.uid, targetUid: state.players.ai.monsters[0]!.uid },
      'player',
    )
    const log = next.events.map((e) => e.text).join(' | ')
    expect(log).toMatch(/Battle Start/)
    expect(log).toMatch(/Damage Step/)
    expect(log).toMatch(/Battle End/)
  })

  it('annule les dégâts de combat avec Absorption', () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-quatre-bras' }],
      aiMonsters: [{ id: 'chr-carlo', grantedDuel: ['absorb'] }],
    })
    const next = applyAction(
      state,
      { type: 'attack', attackerUid: state.players.player.monsters[0]!.uid, targetUid: state.players.ai.monsters[0]!.uid },
      'player',
    )
    expect(next.players.ai.lp).toBe(10000)
  })

  it('renvoie les dégâts à l’attaquant avec Réflexion', () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-quatre-bras' }],
      aiMonsters: [{ id: 'chr-carlo', grantedDuel: ['reflect'] }],
    })
    const next = applyAction(
      state,
      { type: 'attack', attackerUid: state.players.player.monsters[0]!.uid, targetUid: state.players.ai.monsters[0]!.uid },
      'player',
    )
    expect(next.players.player.lp).toBe(10000 - 1100)
  })

  it('détruit l’attaquant avec Contre-attaque', () => {
    const state = scenario({
      phase: 'battle',
      playerMonsters: [{ id: 'chr-bob' }],
      aiMonsters: [{ id: 'chr-carlo', grantedDuel: ['counterAttack'] }],
    })
    const next = applyAction(
      state,
      { type: 'attack', attackerUid: state.players.player.monsters[0]!.uid, targetUid: state.players.ai.monsters[0]!.uid },
      'player',
    )
    expect(next.players.player.monsters[0]).toBeNull()
  })

  it('applique les statistiques fixes et multiplicatives', () => {
    const state = scenario({ playerMonsters: [{ id: 'chr-bob' }] })
    const bob = state.players.player.monsters[0]!
    bob.setAtk = 5000
    expect(statsFor(state, 'player', bob).atk).toBe(5000)
    bob.mulAtk = 2
    expect(statsFor(state, 'player', bob).atk).toBe(10000)
  })
})

/* ------------------------------------------------------------------ */
/* Ciblage des effets (brief §7)                                       */
/* ------------------------------------------------------------------ */

describe('ciblage des effets', () => {
  it('un effet ciblé ne peut pas détruire une cible protégée par « Ciblage impossible »', () => {
    const state = scenario({
      aiMonsters: [{ id: 'chr-waybig', grantedDuel: ['targetImmune'] }],
      playerHand: ['trap-piege'],
    })
    state.players.player.spells[0] = mk('trap-piege', { faceDown: true, slot: 0, setTurn: 1 })
    const opened = applyAction(state, { type: 'activateSet', spellIndex: 0 }, 'player')
    // Vitesse 2 : la chaîne se résout quand l'adversaire passe.
    const resolved = applyAction(opened, { type: 'pass' }, 'ai')
    expect(resolved.players.ai.monsters[0]).not.toBeNull()
  })

  it('un effet non ciblé ignore « Ciblage impossible » mais pas « Immunité à la destruction »', () => {
    const open = scenario({
      aiMonsters: [{ id: 'chr-waybig', grantedDuel: ['targetImmune'] }],
      playerHand: ['tec-masse'],
    })
    expect(applyAction(open, { type: 'activate', handIndex: 0 }, 'player').players.ai.monsters[0]).toBeNull()

    const immune = scenario({
      aiMonsters: [{ id: 'chr-waybig', grantedDuel: ['targetImmune', 'destroyImmune'] }],
      playerHand: ['tec-masse'],
    })
    expect(applyAction(immune, { type: 'activate', handIndex: 0 }, 'player').players.ai.monsters[0]).not.toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Scénarios reproductibles (brief §13)                                */
/* ------------------------------------------------------------------ */

describe('déterminisme', () => {
  it('même graine + mêmes actions ⇒ même duel', () => {
    const play = () => {
      let state = newDuel(2024, 'player')
      const trace: string[] = []
      for (let i = 0; i < 60 && !state.over && !state.suspended; i++) {
        const side = state.pending ? state.pending.responder : state.active
        const action = aiChooseAction(state, 'normal', side)
        if (!action) break
        trace.push(JSON.stringify(action))
        state = applyAction(state, action, side)
      }
      return { trace, snapshot: JSON.stringify(state.players) }
    }
    const a = play()
    const b = play()
    expect(a.trace).toEqual(b.trace)
    expect(a.snapshot).toBe(b.snapshot)
  })

  it('deux graines différentes produisent des duels différents', () => {
    const first = newDuel(1, 'player')
    const second = newDuel(2, 'player')
    expect(JSON.stringify(first.players.player.hand.map((c) => c.cardId)))
      .not.toBe(JSON.stringify(second.players.player.hand.map((c) => c.cardId)))
  })
})

/* ------------------------------------------------------------------ */
/* Fin de duel                                                         */
/* ------------------------------------------------------------------ */

describe('fin de duel', () => {
  it('déclare forfait le joueur qui ne peut plus piocher', () => {
    const state = newDuel(5, 'player')
    state.players.ai.deck = []
    const next = applyAction(state, { type: 'endTurn' }, 'player')
    expect(next.over).toBe(true)
    expect(next.winner).toBe('player')
    expect(next.endReason).toMatch(/deck vide/i)
  })

  it("déclare vainqueur l'adversaire quand les LP tombent à zéro", () => {
    const state = scenario({ playerHand: ['tec-fournaise'], phase: 'main1' })
    state.players.ai.lp = 800
    const next = applyAction(state, { type: 'activate', handIndex: 0 }, 'player')
    expect(next.over).toBe(true)
    expect(next.winner).toBe('player')
    expect(next.players.ai.lp).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* Chaînes, vitesses, annulation                                       */
/* ------------------------------------------------------------------ */

describe('chaînes et effets', () => {
  it('ouvre une chaîne de vitesse 2 et demande une réponse', () => {
    const state = scenario({ playerHand: ['mag-gel'] })
    const next = applyAction(state, { type: 'activate', handIndex: 0 }, 'player')
    expect(next.chain).toHaveLength(1)
    expect(next.pending?.responder).toBe('ai')
    expect(next.players.ai.lp).toBe(10000)
    // Le joueur ne peut pas répondre à sa propre chaîne
    expect(() => applyAction(next, { type: 'pass' }, 'player')).toThrow(RuleError)
    const resolved = applyAction(next, { type: 'pass' }, 'ai')
    expect(resolved.players.ai.lp).toBe(9500)
    expect(resolved.chain).toHaveLength(0)
  })

  it('résout en ordre inverse et gère l’annulation d’activation', () => {
    const state = scenario({})
    state.chain = [
      {
        id: 1,
        controller: 'player',
        speed: 1,
        sourceUid: 'x',
        sourceName: 'Soin test',
        ops: [{ op: 'heal', amount: 500 }],
        negated: false,
        zone: 'spell',
      },
      {
        id: 2,
        controller: 'ai',
        speed: 3,
        sourceUid: 'y',
        sourceName: 'Annulation test',
        ops: [{ op: 'negate' }],
        negated: false,
        zone: 'spell',
      },
    ]
    state.pending = { responder: 'player' }
    const resolved = applyAction(state, { type: 'pass' }, 'player')
    expect(resolved.players.player.lp).toBe(10000)
    expect(resolved.events.some((e) => e.text.includes('annule'))).toBe(true)
  })

  it('empêche une vitesse inférieure de répondre à une vitesse supérieure', () => {
    const state = scenario({ playerHand: ['mag-gel'] }) // vitesse 2
    state.chain = [
      {
        id: 1,
        controller: 'ai',
        speed: 3,
        sourceUid: 'z',
        sourceName: 'Piège vitesse 3',
        ops: [{ op: 'damage', who: 'opponent', amount: 300 }],
        negated: false,
        zone: 'spell',
      },
    ]
    state.pending = { responder: 'player' }
    const moves = legalActions(state, 'player')
    expect(moves.some((m) => m.kind === 'chain')).toBe(false)
  })

  it('suspend le duel au plafond de 100 maillons sans désigner de vainqueur', () => {
    const state = scenario({ playerHand: ['mag-gel'] })
    for (let i = 0; i < 99; i++) {
      state.chain.push({
        id: i + 1,
        controller: i % 2 === 0 ? 'ai' : 'player',
        speed: 2,
        sourceUid: `link-${i}`,
        sourceName: `Maillon ${i}`,
        ops: [{ op: 'heal', amount: 10 }],
        negated: false,
        zone: 'spell',
      })
    }
    state.pending = { responder: 'player' }
    const next = applyAction(state, { type: 'chain', handIndex: 0 }, 'player')
    expect(next.chain).toHaveLength(100)
    expect(next.suspended).toBe(true)
    expect(next.diagnostic).toMatch(/100 maillons/)
    expect(next.winner).toBeNull()
    expect(next.over).toBe(false)
  })

  it('applique les buffs d’équipement aux statistiques', () => {
    const state = scenario({ playerHand: ['eq-epee'] })
    // Aucun personnage : activation impossible, la carte reste en main
    expect(() => applyAction(state, { type: 'activate', handIndex: 0 }, 'player')).toThrow(/équiper/)
    expect(state.players.player.hand).toHaveLength(1)

    const withTarget = scenario({ playerMonsters: [{ id: 'chr-bob' }], playerHand: ['eq-epee'] })
    const equipped = applyAction(withTarget, { type: 'activate', handIndex: 0 }, 'player')
    const monster = equipped.players.player.monsters[0]!
    expect(statsFor(equipped, 'player', monster).atk).toBe(1200 + 600)
  })
})

/* ------------------------------------------------------------------ */
/* Cinq invocations spéciales                                          */
/* ------------------------------------------------------------------ */

describe('invocations spéciales', () => {
  function withExtra(extra: string[]) {
    const state = newDuel(19, 'player')
    state.players.player.extra = extra.map((id) => mk(id))
    state.phase = 'main1'
    state.players.player.hand = []
    state.players.player.monsters = [null, null, null, null, null]
    return state
  }

  it('Crossover : deux univers différents requis', () => {
    const state = withExtra(['spx-heros-multivers'])
    state.players.player.monsters[0] = mk('chr-waybig') as never
    state.players.player.monsters[1] = mk('chr-lui') as never
    const options = specialOptions(state, 'player')
    expect(options[0].ok, options[0].reason).toBe(true)
    const next = applyAction(state, { type: 'special', extraIndex: 0 }, 'player')
    expect(next.players.player.monsters.some((m) => m?.cardId === 'spx-heros-multivers')).toBe(true)
  })

  it('Crossover : refuse deux personnages du même univers', () => {
    const state = withExtra(['spx-heros-multivers'])
    state.players.player.monsters[0] = mk('chr-bugs') as never
    state.players.player.monsters[1] = mk('chr-daffy') as never
    const options = specialOptions(state, 'player')
    expect(options[0].ok).toBe(false)
    expect(options[0].reason).toMatch(/univers/)
  })

  it('Éveil : transforme un personnage de Popularité suffisante', () => {
    const state = withExtra(['spx-forme-ultime'])
    state.players.player.monsters[0] = mk('chr-bugs') as never
    const options = specialOptions(state, 'player')
    expect(options[0].ok, options[0].reason).toBe(true)
    const next = applyAction(state, { type: 'special', extraIndex: 0 }, 'player')
    expect(next.players.player.gy.map((c) => c.cardId)).toContain('chr-bugs')
  })

  it('Sacrifice : consomme les matériaux au Cimetière', () => {
    const state = withExtra(['spx-offrande'])
    state.players.player.monsters[0] = mk('chr-waybig') as never
    const next = applyAction(state, { type: 'special', extraIndex: 0 }, 'player')
    expect(next.players.player.gy.map((c) => c.cardId)).toContain('chr-waybig')
    expect(next.players.player.monsters.some((m) => m?.cardId === 'spx-offrande')).toBe(true)
  })

  it('Dimensionnelle : exige des cartes bannies, sans les consommer', () => {
    const state = withExtra(['spx-faille'])
    const blocked = specialOptions(state, 'player')
    expect(blocked[0].ok).toBe(false)
    expect(blocked[0].reason).toMatch(/bannie/)

    state.players.player.banished = [mk('chr-bob'), mk('chr-tom')]
    expect(specialOptions(state, 'player')[0].ok).toBe(true)
    const next = applyAction(state, { type: 'special', extraIndex: 0 }, 'player')
    expect(next.players.player.banished).toHaveLength(2)
  })

  it('Résonance : exige un tag partagé', () => {
    const state = withExtra(['spx-duo'])
    // Jerry (comique, souris) + Scooby (héros, chien) : aucun tag partagé.
    state.players.player.monsters[0] = mk('chr-jerry') as never
    state.players.player.monsters[1] = mk('chr-scooby') as never
    expect(specialOptions(state, 'player')[0].ok).toBe(false)
    // Bob (comique, héros) partage « comique » avec Jerry.
    state.players.player.monsters[1] = mk('chr-bob') as never
    expect(specialOptions(state, 'player')[0].ok).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* IA : duel complet                                                   */
/* ------------------------------------------------------------------ */

describe('IA', () => {
  it('termine un duel complet sans intervention et sans action illégale', () => {
    let state = newDuel(2024, 'player')
    let actions = 0
    while (!state.over && !state.suspended && actions < 1500) {
      const side = state.pending ? state.pending.responder : state.active
      const action = aiChooseAction(state, 'normal', side)
      if (!action) break
      state = applyAction(state, action, side)
      actions += 1
    }
    expect(state.suspended, state.diagnostic ?? '').toBe(false)
    expect(actions).toBeLessThan(1500)
    expect(state.over, 'le duel doit se terminer').toBe(true)
    expect(state.winner).not.toBeNull()
  })

  it('progresse dans ses phases, invoque, et n’attaque pas au premier tour', () => {
    // Régression : l'IA terminait son tour dès la phase de pioche, sans invoquer.
    let state = newDuel(2024, 'ai')
    const firstTurn = state.turn
    const firstTurnTypes: string[] = []
    for (let i = 0; i < 60 && state.turn === firstTurn && !state.over; i++) {
      const side = state.pending ? state.pending.responder : state.active
      const action = aiChooseAction(state, 'normal', side)
      if (!action) break
      firstTurnTypes.push(action.type)
      state = applyAction(state, action, side)
    }
    expect(firstTurnTypes).toContain('summon')
    // Le premier joueur ne peut pas attaquer lors de son premier tour.
    expect(firstTurnTypes).not.toContain('attack')

    // Le tour suivant, l'IA attaque réellement et inflige des dégâts.
    let attacked = false
    let actions = 0
    while (!state.over && !state.suspended && actions < 300 && !attacked) {
      const side = state.pending ? state.pending.responder : state.active
      const action = aiChooseAction(state, 'normal', side)
      if (!action) break
      if (action.type === 'attack') attacked = true
      state = applyAction(state, action, side)
      actions += 1
    }
    expect(attacked).toBe(true)
    expect(state.players.player.lp + state.players.ai.lp).toBeLessThan(20000)
  })

  it('ne lit pas la main adverse (décision identique après camouflage)', () => {
    const state = newDuel(77, 'ai')
    const masked = structuredClone(state)
    masked.players.player.hand = []
    const a = aiChooseAction(state, 'normal', 'ai')
    const b = aiChooseAction(masked, 'normal', 'ai')
    expect(a).toEqual(b)
  })

  it('les duels IA vs IA s’achèvent par des dégâts et restent équilibrés', () => {
    let winsPlayer = 0
    for (let i = 0; i < 8; i++) {
      let state = newDuel(500 + i, i % 2 ? 'ai' : 'player')
      let actions = 0
      while (!state.over && !state.suspended && actions < 1500) {
        const side = state.pending ? state.pending.responder : state.active
        const action = aiChooseAction(state, 'normal', side)
        if (!action) break
        state = applyAction(state, action, side)
        actions += 1
      }
      expect(state.over, state.diagnostic ?? '').toBe(true)
      expect(state.players.player.lp + state.players.ai.lp).toBeLessThan(20000)
      if (state.winner === 'player') winsPlayer += 1
    }
    // Aucun camp ne doit gagner systématiquement (les deux camps sont pilotés par la même IA).
    expect(winsPlayer).toBeGreaterThan(0)
    expect(winsPlayer).toBeLessThan(8)
  }, 25000)
})
