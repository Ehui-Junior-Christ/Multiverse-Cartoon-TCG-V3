import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { CARDS } from '../engine/catalog'
import { validateDeck, type Deck } from '../engine/deck'
import { levelFromXp, xpProgress } from '../engine/progress'
import { ELO_START, eloKFactor, nextElo, seasonExpired, softResetElo } from '../engine/progress'
import { EMPTY_PITY, JM_REWARDS, openBoosterWithPity, packById, type PackKind, type PityState } from '../engine/economy'
import {
  bumpMetric,
  canClaim,
  claimMission as claimMissionPure,
  emptyProgress,
  MISSIONS,
  missionValue,
  normalizeProgress,
  type MissionMetric,
  type MissionProgress,
} from '../engine/missions'
import type { CardDef } from '../engine/types'
import { api } from '../lib/api'
import { seedCollection, seedDecks, seedProfile } from '../data/seed'

export interface Profile {
  name: string
  xp: number
  jm: number
  wins: number
  losses: number
  /** Classement ELO 1v1 local (brief §10). */
  elo?: number
  /** Début de la saison courante (8 semaines). */
  seasonStartedAt?: string | null
  /** Photo de profil (data URL base64). */
  avatar?: string
}

export interface MatchRecord {
  id: string
  opponent: string
  deckName: string
  result: 'win' | 'loss'
  turns: number
  reason: string
  playedAt: string
  /** Journal d'événements du duel, pour le replay (facultatif). */
  log?: string[]
}

export interface BootstrapPayload {
  profile: Profile
  collection: Array<{ cardId: string; quantity: number }>
  decks: Deck[]
  matches: MatchRecord[]
  pity?: PityState
  storage: 'sqlite' | 'memory'
}

const LOCAL_KEY = 'mv-tcg-local-state-v1'
const ACTIVE_DECK_KEY = 'mv-tcg-active-deck'
const PITY_KEY = 'mv-tcg-pity'
const MISSIONS_KEY = 'mv-tcg-missions'
/** Conservation des replays (brief §11). */
export const MATCH_RETENTION_DAYS = 90

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<Profile>(seedProfile())
  const collection = ref<Record<string, number>>({})
  const decks = ref<Deck[]>([])
  const matches = ref<MatchRecord[]>([])
  const pity = ref<PityState>({ ...EMPTY_PITY })
  const daily = ref<MissionProgress>(emptyProgress('daily'))
  const weekly = ref<MissionProgress>(emptyProgress('weekly'))
  const activeDeckId = ref<string>(localStorage.getItem(ACTIVE_DECK_KEY) ?? '')
  const ready = ref(false)
  const offline = ref(false)
  const loadingError = ref<string | null>(null)
  const saving = ref(false)

  const level = computed(() => levelFromXp(profile.value.xp))
  const progress = computed(() => xpProgress(profile.value.xp))
  const elo = computed(() => profile.value.elo ?? ELO_START)
  const matchesPlayed = computed(() => profile.value.wins + profile.value.losses)
  const ownedCount = computed(() => Object.values(collection.value).reduce((sum, qty) => sum + qty, 0))
  const uniqueCount = computed(() => Object.values(collection.value).filter((qty) => qty > 0).length)
  const activeDeck = computed(() => decks.value.find((d) => d.id === activeDeckId.value) ?? null)

  function applyBootstrap(payload: BootstrapPayload): void {
    profile.value = payload.profile
    // Restore avatar from localStorage (not stored in API payload)
    const savedAvatar = localStorage.getItem('mv-tcg-avatar')
    if (savedAvatar) profile.value = { ...profile.value, avatar: savedAvatar }
    collection.value = Object.fromEntries(payload.collection.map((entry) => [entry.cardId, entry.quantity]))
    decks.value = payload.decks
    matches.value = payload.matches
    if (payload.pity) pity.value = payload.pity
    else {
      const raw = localStorage.getItem(PITY_KEY)
      if (raw) {
        try {
          pity.value = JSON.parse(raw) as PityState
        } catch {
          pity.value = { ...EMPTY_PITY }
        }
      }
    }
    if (!decks.value.some((deck) => deck.id === activeDeckId.value)) {
      activeDeckId.value = decks.value[0]?.id ?? ''
      localStorage.setItem(ACTIVE_DECK_KEY, activeDeckId.value)
    }
  }

  function seedLocal(): void {
    profile.value = seedProfile()
    collection.value = Object.fromEntries(seedCollection().map((entry) => [entry.cardId, entry.quantity]))
    decks.value = seedDecks()
    matches.value = []
    activeDeckId.value = decks.value[0]?.id ?? ''
  }

  function persistLocal(): void {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        profile: profile.value,
        collection: collection.value,
        decks: decks.value,
        matches: matches.value,
        pity: pity.value,
      }),
    )
    localStorage.setItem(PITY_KEY, JSON.stringify(pity.value))
    localStorage.setItem(MISSIONS_KEY, JSON.stringify({ daily: daily.value, weekly: weekly.value }))
  }

  function loadMissions(): void {
    daily.value = normalizeProgress(undefined, 'daily')
    weekly.value = normalizeProgress(undefined, 'weekly')
    try {
      const raw = localStorage.getItem(MISSIONS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { daily?: MissionProgress; weekly?: MissionProgress }
      daily.value = normalizeProgress(parsed.daily, 'daily')
      weekly.value = normalizeProgress(parsed.weekly, 'weekly')
    } catch {
      /* stockage illisible : on repart de zéro */
    }
  }

  /** Incrémente une métrique de mission (duels, victoires, boosters, invocations). */
  function bumpMission(metric: MissionMetric, amount = 1): void {
    daily.value = bumpMetric(normalizeProgress(daily.value, 'daily'), metric, amount)
    weekly.value = bumpMetric(normalizeProgress(weekly.value, 'weekly'), metric, amount)
    localStorage.setItem(MISSIONS_KEY, JSON.stringify({ daily: daily.value, weekly: weekly.value }))
  }

  function claimMission(id: string): number {
    const mission = MISSIONS.find((entry) => entry.id === id)
    if (!mission) return 0
    const target = mission.scope === 'daily' ? daily : weekly
    target.value = normalizeProgress(target.value, mission.scope)
    if (!canClaim(target.value, mission)) return 0
    const result = claimMissionPure(target.value, mission)
    target.value = result.progress
    if (result.reward > 0) {
      profile.value = { ...profile.value, jm: profile.value.jm + result.reward }
      persistLocal()
    }
    return result.reward
  }

  /** Supprime les duels plus anciens que la durée de conservation. */
  function pruneMatches(): void {
    const cutoff = Date.now() - MATCH_RETENTION_DAYS * 24 * 60 * 60 * 1000
    matches.value = matches.value.filter((match) => {
      const played = new Date(match.playedAt).getTime()
      return Number.isNaN(played) || played >= cutoff
    })
  }

  async function load(): Promise<void> {
    loadingError.value = null
    try {
      applyBootstrap(await api.bootstrap<BootstrapPayload>())
      offline.value = false
    } catch (error) {
      offline.value = true
      loadingError.value = error instanceof Error ? error.message : 'API locale indisponible'
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            profile: Profile
            collection: Record<string, number>
            decks: Deck[]
            matches: MatchRecord[]
          }
          profile.value = parsed.profile
          collection.value = parsed.collection
          decks.value = parsed.decks
          matches.value = parsed.matches ?? []
        } catch {
          seedLocal()
        }
      } else {
        seedLocal()
      }
      if (!decks.value.length) seedLocal()
    } finally {
      loadMissions()
      pruneMatches()
      ready.value = true
    }
  }

  async function pushProfile(update: Partial<Profile>): Promise<void> {
    profile.value = { ...profile.value, ...update }
    // Persist avatar separately (large data URL, kept outside main state blob)
    if (profile.value.avatar) {
      localStorage.setItem('mv-tcg-avatar', profile.value.avatar)
    } else {
      localStorage.removeItem('mv-tcg-avatar')
    }
    if (offline.value) {
      persistLocal()
      return
    }
    try {
      await api.saveProfile({ name: profile.value.name, avatar: profile.value.avatar ?? null })
    } catch {
      offline.value = true
      persistLocal()
    }
  }

  function setAvatar(dataUrl: string): void {
    profile.value = { ...profile.value, avatar: dataUrl || undefined }
    if (dataUrl) {
      localStorage.setItem('mv-tcg-avatar', dataUrl)
    } else {
      localStorage.removeItem('mv-tcg-avatar')
    }
    void pushProfile({})
  }

  function setActiveDeck(id: string): void {
    activeDeckId.value = id
    localStorage.setItem(ACTIVE_DECK_KEY, id)
  }

  async function saveDeck(deck: Deck): Promise<{ ok: boolean; error?: string }> {
    const validation = validateDeck(deck.main, deck.extra)
    if (!validation.valid) return { ok: false, error: validation.errors[0] }
    saving.value = true
    const withTimestamp: Deck = { ...deck, updatedAt: new Date().toISOString() }
    const existing = decks.value.findIndex((d) => d.id === deck.id)
    if (existing >= 0) decks.value.splice(existing, 1, withTimestamp)
    else decks.value.push(withTimestamp)
    try {
      if (offline.value) persistLocal()
      else {
        const payload = await api.saveDeck<{ decks: Deck[] }>({
          id: deck.id,
          name: deck.name,
          main: deck.main,
          extra: deck.extra,
        })
        if (payload?.decks) decks.value = payload.decks
        else persistLocal()
      }
      setActiveDeck(deck.id)
      return { ok: true }
    } catch (error) {
      offline.value = true
      persistLocal()
      return { ok: true, error: error instanceof Error ? error.message : undefined }
    } finally {
      saving.value = false
    }
  }

  async function deleteDeck(id: string): Promise<void> {
    decks.value = decks.value.filter((deck) => deck.id !== id)
    if (activeDeckId.value === id) setActiveDeck(decks.value[0]?.id ?? '')
    try {
      if (!offline.value) await api.deleteDeck<{ decks: Deck[] }>(id)
      else persistLocal()
    } catch {
      offline.value = true
      persistLocal()
    }
  }

  async function recordMatch(
    match: Omit<MatchRecord, 'id' | 'playedAt'>,
    options?: { ranked?: boolean },
  ): Promise<void> {
    const local: MatchRecord = { ...match, id: crypto.randomUUID(), playedAt: new Date().toISOString() }
    matches.value = [local, ...matches.value].slice(0, 60)
    profile.value = {
      ...profile.value,
      wins: profile.value.wins + (match.result === 'win' ? 1 : 0),
      losses: profile.value.losses + (match.result === 'loss' ? 1 : 0),
      xp: profile.value.xp + (match.result === 'win' ? 30 : 10),
      jm: profile.value.jm + (match.result === 'win' ? JM_REWARDS.win : JM_REWARDS.loss),
    }
    // ELO local : uniquement en duel classé (brief §11), calculé puis persisté.
    const ranked = options?.ranked !== false
    if (ranked) {
      const played = profile.value.wins + profile.value.losses
      const k = eloKFactor(played - 1, levelFromXp(profile.value.xp))
      profile.value.elo = nextElo(profile.value.elo ?? ELO_START, match.result === 'win' ? 1 : 0, k)
      if (!profile.value.seasonStartedAt) profile.value.seasonStartedAt = new Date().toISOString()
      if (seasonExpired(profile.value.seasonStartedAt)) {
        profile.value.elo = softResetElo(profile.value.elo)
        profile.value.seasonStartedAt = new Date().toISOString()
      }
      void api
        .saveProfile<{ profile: Profile }>({
          name: profile.value.name,
          elo: profile.value.elo,
          seasonStartedAt: profile.value.seasonStartedAt,
        })
        .catch(() => undefined)
    }
    bumpMission('duels', 1)
    if (match.result === 'win') bumpMission('wins', 1)
    try {
      if (offline.value) throw new Error('offline')
      const payload = await api.recordMatch<{ profile: Profile; matches: MatchRecord[] }>({
        result: match.result,
        turns: match.turns,
        opponent: match.opponent,
        deckName: match.deckName,
        reason: match.reason,
        log: match.log,
      })
      profile.value = payload.profile
      matches.value = payload.matches
    } catch {
      offline.value = true
      persistLocal()
    }
  }

  function quantityOf(cardId: string): number {
    return collection.value[cardId] ?? 0
  }

  /** Ouvre un booster : API locale en priorité, repli local sinon. */
  async function openBooster(
    kind: PackKind,
    universe?: string,
  ): Promise<{ ok: true; cards: string[]; pityTriggered: string | null } | { ok: false; error: string }> {
    const pack = packById(kind)
    if (!pack) return { ok: false, error: 'Booster inconnu.' }
    if (profile.value.jm < pack.cost) return { ok: false, error: 'Jetons Multivers insuffisants.' }

    const seed = Math.floor(Math.random() * 2 ** 31)
    const applyResult = (payload: { profile?: Profile; collection?: Array<{ cardId: string; quantity: number }>; pity?: PityState }) => {
      if (payload.profile) profile.value = payload.profile
      if (payload.collection) {
        collection.value = Object.fromEntries(payload.collection.map((entry) => [entry.cardId, entry.quantity]))
      }
      if (payload.pity) pity.value = payload.pity
      bumpMission('boosters', 1)
      persistLocal()
    }

    try {
      if (offline.value) throw new Error('offline')
      const payload = await api.openBooster<{
        profile: Profile
        collection: Array<{ cardId: string; quantity: number }>
        pity: PityState
        cards: string[]
        pityTriggered: string | null
      }>({ kind, universe, seed })
      applyResult(payload)
      return { ok: true, cards: payload.cards, pityTriggered: payload.pityTriggered }
    } catch {
      offline.value = true
      const result = openBoosterWithPity({ kind, universe, seed }, pity.value)
      const nextCollection = { ...collection.value }
      for (const card of result.cards) nextCollection[card.id] = (nextCollection[card.id] ?? 0) + 1
      collection.value = nextCollection
      pity.value = result.pity
      profile.value = { ...profile.value, jm: profile.value.jm - pack.cost }
      persistLocal()
      return { ok: true, cards: result.cards.map((card) => card.id), pityTriggered: result.pityTriggered }
    }
  }

  async function exportBackup(): Promise<void> {
    let content: string
    try {
      if (offline.value) throw new Error('offline')
      const response = await fetch('/api/backup')
      if (!response.ok) throw new Error('Export indisponible')
      content = await response.text()
    } catch {
      content = JSON.stringify(
        { profile: profile.value, collection: collection.value, decks: decks.value, matches: matches.value },
        null,
        2,
      )
    }
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `multiverse-tcg-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function catalogSize(): number {
    return CARDS.length
  }

  return {
    profile,
    collection,
    decks,
    matches,
    activeDeckId,
    activeDeck,
    ready,
    offline,
    saving,
    loadingError,
    level,
    progress,
    elo,
    matchesPlayed,
    ownedCount,
    uniqueCount,
    load,
    pushProfile,
    setAvatar,
    setActiveDeck,
    saveDeck,
    deleteDeck,
    recordMatch,
    quantityOf,
    openBooster,
    pity,
    daily,
    weekly,
    bumpMission,
    claimMission,
    exportBackup,
    catalogSize,
  }
})
