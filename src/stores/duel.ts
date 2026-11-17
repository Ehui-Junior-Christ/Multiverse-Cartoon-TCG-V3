import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { aiChooseAction, type Difficulty } from '../engine/ai'
import { TURN_SECONDS } from '../engine/deck'
import { applyAction, createDuel, legalActions, RuleError } from '../engine/duel'
import type { Action, DuelState, LegalMove, Side } from '../engine/types'
import { AI_DECK } from '../data/decks'
import { useProfileStore } from './profile'

const AI_NAME = 'IA — Marée Cosmique'
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Délai d'inactivité continue avant défaite (brief §8). */
export const INACTIVITY_SECONDS = 120

export const useDuelStore = defineStore('duel', () => {
  const profileStore = useProfileStore()

  const state = ref<DuelState | null>(null)
  const difficulty = ref<Difficulty>('beginner')
  /** Duel classé (ELO) ou amical (sans ELO), brief §11. */
  const mode = ref<'ranked' | 'friendly'>('ranked')
  const busy = ref(false)
  const error = ref<string | null>(null)
  const turnRemaining = ref(TURN_SECONDS)
  const idleSeconds = ref(0)
  const flashUid = ref<string | null>(null)
  const recorded = ref(false)
  const result = ref<'win' | 'loss' | null>(null)

  const events = computed(() => state.value?.events ?? [])
  const playerMoves = computed<LegalMove[]>(() =>
    state.value && !state.value.over ? legalActions(state.value, 'player') : [],
  )
  const waitingForPlayerChain = computed(
    () => Boolean(state.value?.pending) && state.value?.pending?.responder === 'player',
  )
  const isPlayerTurn = computed(() => state.value?.active === 'player')
  const lastEvent = computed(() => events.value[events.value.length - 1] ?? null)
  const recentEvents = computed(() => events.value.slice(-40).reverse())

  function flash(uid: string | undefined): void {
    if (!uid) return
    flashUid.value = uid
    window.setTimeout(() => {
      if (flashUid.value === uid) {
        flashUid.value = null
      }
    }, 620)
  }

  function flashFromLastEvent(): void {
    const last = lastEvent.value
    if (!last) return
    if (last.kind === 'damage' || last.kind === 'destroy' || last.kind === 'summon' || last.kind === 'special' || last.kind === 'attack' || last.kind === 'activate') {
      flash(last.uid ?? last.targetUid)
    }
  }

  function startDeckChoice(): { main: string[]; extra: string[]; name: string } | null {
    const deck = profileStore.activeDeck
    if (!deck) return null
    return { main: deck.main, extra: deck.extra, name: deck.name }
  }

  function start(
    firstSide: Side,
    chosenDifficulty: Difficulty,
    opponent?: { name: string; main: string[]; extra: string[] },
    chosenMode: 'ranked' | 'friendly' = 'ranked',
  ): boolean {
    const deck = startDeckChoice()
    if (!deck) {
      error.value = 'Sélectionnez un deck valide avant de lancer un duel.'
      return false
    }
    difficulty.value = chosenDifficulty
    mode.value = chosenMode
    recorded.value = false
    result.value = null
    error.value = null
    turnRemaining.value = TURN_SECONDS
    idleSeconds.value = 0
    state.value = createDuel({
      playerName: profileStore.profile.name,
      aiName: opponent?.name ?? AI_NAME,
      playerDeckName: deck.name,
      aiDeckName: opponent?.name ?? 'Marée Cosmique',
      playerMain: deck.main,
      playerExtra: deck.extra,
      aiMain: opponent?.main ?? AI_DECK.main,
      aiExtra: opponent?.extra ?? AI_DECK.extra,
      seed: Math.floor(Math.random() * 2 ** 31),
      firstSide,
    })
    return true
  }

  async function runAi(): Promise<void> {
    let guard = 0
    while (state.value && !state.value.over && !state.value.suspended && guard < 90) {
      const side: Side | undefined = state.value.pending ? state.value.pending.responder : state.value.active
      if (side !== 'ai') break
      const action = aiChooseAction(state.value, difficulty.value, 'ai')
      if (!action) break
      await delay(560)
      try {
        // toRaw : le moteur clone l'état, ce que refuse un proxy réactif Vue.
        state.value = applyAction(toRaw(state.value), action, 'ai')
      } catch (err) {
        console.error('[duel] action IA rejetée', err)
        error.value = err instanceof RuleError ? err.message : 'Action IA impossible'
        break
      }
      flashFromLastEvent()
      guard += 1
    }
    if (state.value?.over) await finish()
  }

  async function act(action: Action): Promise<void> {
    if (!state.value || busy.value || state.value.over) return
    busy.value = true
    idleSeconds.value = 0
    error.value = null
    try {
      // toRaw : le moteur clone l'état, ce que refuse un proxy réactif Vue.
      state.value = applyAction(toRaw(state.value), action, 'player')
      if (action.type === 'special') profileStore.bumpMission('specials', 1)
      flashFromLastEvent()
      await runAi()
      if (state.value?.pending?.responder === 'player') {
        // L'IA a répondu : le joueur peut chaîner à son tour.
        turnRemaining.value = Math.min(turnRemaining.value, 60)
      }
      if (state.value?.over) await finish()
    } catch (err) {
      console.error('[duel] action rejetée', err)
      error.value = err instanceof RuleError ? err.message : 'Action impossible'
    } finally {
      busy.value = false
    }
  }

  /** Appelé par le chronomètre de tour (3 min 30). */
  async function turnTimeout(): Promise<void> {
    if (!state.value || state.value.over || busy.value) return
    if (state.value.pending?.responder === 'player') {
      await act({ type: 'pass' })
      return
    }
    if (state.value.active === 'player' && !state.value.pending) {
      await act({ type: 'endTurn' })
      turnRemaining.value = TURN_SECONDS
    }
  }

  function tick(): void {
    if (!state.value || state.value.over || busy.value) return
    if (state.value.active !== 'player' || state.value.pending) {
      // Hors tour joueur : l'inactivité ne s'applique qu'au joueur qui doit agir.
      idleSeconds.value = 0
      return
    }

    idleSeconds.value += 1
    if (idleSeconds.value >= INACTIVITY_SECONDS) {
      void forfeitInactivity()
      return
    }

    turnRemaining.value = Math.max(0, turnRemaining.value - 1)
    if (turnRemaining.value === 0) void turnTimeout()
  }

  /** Défaite pour inactivité continue de 2 minutes (brief §8). */
  async function forfeitInactivity(): Promise<void> {
    if (!state.value || state.value.over || busy.value) return
    await act({ type: 'concede', reason: 'inactivité continue de 2 minutes' })
  }

  async function finish(): Promise<void> {
    if (!state.value || recorded.value) return
    const winner = state.value.winner
    if (winner === null) return
    recorded.value = true
    result.value = winner === 'player' ? 'win' : 'loss'
    await profileStore.recordMatch({
      result: result.value,
      turns: state.value.turn,
      opponent: AI_NAME,
      deckName: state.value.players.player.deckName,
      reason: state.value.endReason ?? '',
      log: state.value.events.map((event) => event.text),
    }, { ranked: mode.value === 'ranked' })
    claimCampaignReward()
  }

  /** Termine une mission de campagne : progression + récompense JM. */
  function claimCampaignReward(): void {
    const pending = localStorage.getItem('mv-campaign-pending')
    if (!pending) return
    localStorage.removeItem('mv-campaign-pending')
    if (result.value !== 'win') return
    try {
      const done = JSON.parse(localStorage.getItem('mv-campaign-done') ?? '[]') as string[]
      if (!done.includes(pending)) done.push(pending)
      localStorage.setItem('mv-campaign-done', JSON.stringify(done))
    } catch {
      /* stockage indisponible : rien à faire */
    }
    const reward = Number(localStorage.getItem('mv-campaign-reward') ?? '0') || 0
    localStorage.removeItem('mv-campaign-reward')
    if (reward > 0) profileStore.profile.jm += reward
    void profileStore.pushProfile({})
  }

  function reset(): void {
    state.value = null
    error.value = null
    result.value = null
    recorded.value = false
    turnRemaining.value = TURN_SECONDS
    idleSeconds.value = 0
  }

  return {
    state,
    difficulty,
    mode,
    busy,
    runAi,
    error,
    turnRemaining,
    idleSeconds,
    flashUid,
    result,
    recorded,
    events,
    recentEvents,
    playerMoves,
    waitingForPlayerChain,
    isPlayerTurn,
    start,
    act,
    tick,
    turnTimeout,
    forfeitInactivity,
    reset,
    finish,
  }
})

