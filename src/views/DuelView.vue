<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CardFace from '../components/CardFace.vue'
import CardDetail from '../components/CardDetail.vue'
import ZoneSlot from '../components/ZoneSlot.vue'
import { useDuelStore } from '../stores/duel'
import { useProfileStore } from '../stores/profile'
import { DIFFICULTY_LABEL, type Difficulty } from '../engine/ai'
import { playSfx } from '../lib/audio'
import { CARD_INDEX, getCard } from '../engine/catalog'
import { PHASE_LABEL, PHASE_ORDER, isOpeningTurnFor, specialOptions, statsFor } from '../engine/duel'
import { INACTIVITY_SECONDS } from '../stores/duel'
import { TURN_SECONDS, validateDeck } from '../engine/deck'
import type { Action, CardInstance, LegalMove, Side } from '../engine/types'

const profile = useProfileStore()
const duel = useDuelStore()

const stage = ref<'intro' | 'duel'>('intro')
const detail = ref<string | null>(null)
const selectedHand = ref<number | null>(null)
const selectedUid = ref<string | null>(null)
const pileView = ref<{ title: string; cards: string[] } | null>(null)
const difficulty = ref<Difficulty>('beginner')
const ranked = ref(true)

// Game Juice & Effets 2D
const isShaking = ref(false)
interface DamagePopup {
  id: number
  side: 'player' | 'ai'
  amount: number
}
const damagePopups = ref<DamagePopup[]>([])

const rpsChoice = ref<'pierre' | 'feuille' | 'ciseaux' | null>(null)
const rpsAi = ref<'pierre' | 'feuille' | 'ciseaux' | null>(null)
const tossOutcome = ref<'win' | 'lose' | 'tie' | null>(null)
const aiStartChoice = ref<Side>('ai')

const state = computed(() => duel.state)
const player = computed(() => duel.state?.players.player ?? null)
const aiPlayer = computed(() => duel.state?.players.ai ?? null)

const activeDeck = computed(() => profile.activeDeck)
const deckCheck = computed(() => (activeDeck.value ? validateDeck(activeDeck.value.main, activeDeck.value.extra) : null))

const RPS_LABEL = { pierre: 'Pierre', feuille: 'Feuille', ciseaux: 'Ciseaux' } as const
const RPS_BEATS: Record<string, string> = { pierre: 'ciseaux', feuille: 'pierre', ciseaux: 'feuille' }
const RPS_ICON = { pierre: '✊', feuille: '✋', ciseaux: '✌' } as const
const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: 'beginner', label: DIFFICULTY_LABEL.beginner },
  { id: 'normal', label: DIFFICULTY_LABEL.normal },
  { id: 'advanced', label: DIFFICULTY_LABEL.advanced },
  { id: 'expert', label: DIFFICULTY_LABEL.expert },
]

const selectedMoves = computed<LegalMove[]>(() => {
  if (selectedHand.value != null) return duel.playerMoves.filter((move) => move.handIndex === selectedHand.value)
  if (selectedUid.value) return duel.playerMoves.filter((move) => move.uid === selectedUid.value)
  return []
})

const chainMoves = computed(() => duel.playerMoves.filter((move) => move.kind === 'chain' || move.kind === 'pass'))

/** Invocations spéciales réellement disponibles (Extra Deck) : à vous, en Main Phase. */
const extraOptions = computed(() => {
  const s = state.value
  if (!s || s.over || s.suspended || s.pending || s.active !== 'player') return []
  if (s.phase !== 'main1' && s.phase !== 'main2') return []
  return specialOptions(s, 'player').filter((option) => option.ok)
})

/** Les invocations spéciales ne se font qu'en Main Phase, hors action en cours. */
const canSpecialNow = computed(() => {
  const s = state.value
  return extraOptions.value.length > 0 && !duel.busy
})

/** Le joueur qui ouvre le duel ne peut pas attaquer au tour 1. */
const openingTurnBlocked = computed(() => {
  const s = state.value
  return !!s && !s.over && s.phase === 'battle' && isOpeningTurnFor(s, 'player')
})

/** Secondes d'inactivité restantes avant la défaite (brief §8). */
const inactivityLeft = computed(() => Math.max(0, INACTIVITY_SECONDS - duel.idleSeconds))

/* --- Replay : rejoue le journal d'événements du duel en cours --- */

const replayView = ref<{ index: number; playing: boolean } | null>(null)
let replayTimer: number | undefined

function openReplay() {
  replayView.value = { index: 0, playing: true }
}

function closeReplay() {
  replayView.value = null
  if (replayTimer) {
    window.clearInterval(replayTimer)
    replayTimer = undefined
  }
}

function replayTick() {
  const r = replayView.value
  if (!r || !r.playing) return
  if (r.index >= duel.events.length) {
    r.playing = false
    return
  }
  r.index += 1
}

function replayStep(delta: number) {
  if (!replayView.value) return
  replayView.value.playing = false
  replayView.value.index = Math.min(duel.events.length, Math.max(0, replayView.value.index + delta))
}

/* --- Tutoriel court au premier duel --- */

const TUTORIAL_KEY = 'mv-tutorial-seen'
const tutorialStep = ref(-1)
const TUTORIAL_STEPS = [
  {
    title: 'Bienvenue dans le duel',
    text: "Chaque joueur commence à 10 000 LP. Le premier joueur ne pioche pas et ne peut pas attaquer au tour 1. Le tour se découpe en 6 phases.",
  },
  {
    title: 'Votre main',
    text: 'Cliquez une carte de votre main pour voir ses actions légales. Les cartes non jouables restent désactivées ou affichent la raison.',
  },
  {
    title: 'Votre plateau',
    text: '5 zones Personnage, 5 zones Magie/Piège et 1 zone Terrain. Le Terrain donne un effet continu à vos personnages tant qu’il reste actif.',
  },
  {
    title: 'Jouer une carte',
    text: 'En Main Phase, vous pouvez invoquer, poser face cachée, activer un effet ou lancer une invocation spéciale depuis l’Extra Deck.',
  },
  {
    title: 'Attaquer',
    text: 'En Battle Phase, un personnage en position d’attaque peut attaquer une fois par tour. Une attaque directe est possible si l’adversaire n’a aucun personnage.',
  },
]

function nextTutorial() {
  if (tutorialStep.value >= TUTORIAL_STEPS.length - 1) {
    localStorage.setItem(TUTORIAL_KEY, '1')
    tutorialStep.value = -1
    return
  }
  tutorialStep.value += 1
}

const selectedLabel = computed(() => {
  if (selectedHand.value != null && player.value) {
    const inst = player.value.hand[selectedHand.value]
    return inst ? getCard(inst.cardId).name : ''
  }
  if (selectedUid.value) {
    const inst = findOwnMonster(selectedUid.value)
    return inst ? getCard(inst.cardId).name : ''
  }
  return ''
})

const phaseIndex = computed(() => (state.value ? PHASE_ORDER.indexOf(state.value.phase) : 0))
const timerLabel = computed(() => {
  const total = duel.turnRemaining
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

const resultTitle = computed(() => {
  if (!state.value?.over) return ''
  if (state.value.winner === null) return 'Duel suspendu'
  return state.value.winner === 'player' ? 'Victoire' : 'Défaite'
})

const eventIcon: Record<string, string> = {
  draw: '🂠',
  summon: '⬆',
  set: '▪',
  special: '✧',
  activate: '◆',
  chain: '🔗',
  resolve: '↳',
  attack: '⚔',
  battle: '⚔',
  damage: '✹',
  heal: '✚',
  destroy: '✖',
  banish: '⊘',
  discard: '↘',
  position: '↻',
  phase: '›',
  turn: '◷',
  win: '★',
  suspend: '⚠',
  info: '·',
}

function findOwnMonster(uid: string): CardInstance | null {
  return player.value?.monsters.find((m) => m?.uid === uid) ?? null
}

function effectiveBadge(inst: CardInstance, side: Side): string | null {
  const base = CARD_INDEX.get(inst.cardId)
  if (!state.value || !base || base.category !== 'character') return null
  const stats = statsFor(state.value, side, inst)
  if (stats.atk === base.atk && stats.def === base.def) return null
  return `${stats.atk} / ${stats.def}`
}

function pickRps(choice: 'pierre' | 'feuille' | 'ciseaux') {
  rpsChoice.value = choice
  const options = ['pierre', 'feuille', 'ciseaux'] as const
  rpsAi.value = options[Math.floor(Math.random() * options.length)]
  if (rpsAi.value === choice) {
    tossOutcome.value = 'tie'
    return
  }
  if (RPS_BEATS[choice] === rpsAi.value) {
    tossOutcome.value = 'win'
    return
  }
  tossOutcome.value = 'lose'
  aiStartChoice.value = Math.random() < 0.5 ? 'ai' : 'player'
}

function beginDuel(firstSide: Side) {
  if (duel.start(firstSide, difficulty.value, undefined, ranked.value ? 'ranked' : 'friendly')) {
    stage.value = 'duel'
    selectedHand.value = null
    selectedUid.value = null
    // Si l'IA commence (ou doit répondre), elle joue immédiatement.
    void duel.runAi()
  }
}

function selectHand(index: number) {
  selectedUid.value = null
  selectedHand.value = selectedHand.value === index ? null : index
}

function selectZone(uid: string) {
  selectedHand.value = null
  selectedUid.value = selectedUid.value === uid ? null : uid
}

async function run(action: Action) {
  selectedHand.value = null
  selectedUid.value = null
  await duel.act(action)
}

function openPile(side: Side, key: 'gy' | 'banished' | 'extra') {
  const p = state.value?.players[side]
  if (!p) return
  const source = key === 'gy' ? p.gy : key === 'banished' ? p.banished : p.extra
  const label = key === 'gy' ? 'Cimetière' : key === 'banished' ? 'Zone bannie' : 'Extra Deck'
  pileView.value = { title: `${label} — ${p.name}`, cards: source.map((card) => card.cardId) }
}

function abandon() {
  if (!state.value || state.value.over) return
  if (!window.confirm('Abandonner le duel ? La défaite sera enregistrée.')) return
  void run({ type: 'concede' })
}

function replay() {
  duel.reset()
  stage.value = 'intro'
  rpsChoice.value = null
  rpsAi.value = null
  tossOutcome.value = null
}

let interval: number | undefined
onMounted(() => {
  interval = window.setInterval(() => duel.tick(), 1000)
  replayTimer = window.setInterval(() => replayTick(), 750)
  if (duel.state && !duel.state.over) stage.value = 'duel'
  if (localStorage.getItem(TUTORIAL_KEY) !== '1') tutorialStep.value = 0
})
onBeforeUnmount(() => {
  if (interval) window.clearInterval(interval)
  if (replayTimer) window.clearInterval(replayTimer)
})

watch(
  () => duel.events.length,
  () => {
    const last = duel.events[duel.events.length - 1]
    if (!last) return
    if (last.kind === 'draw') playSfx('draw')
    else if (last.kind === 'summon' || last.kind === 'special') playSfx('summon')
    else if (last.kind === 'battle' && /Battle Start/.test(last.text)) playSfx('attack')
    else if (last.kind === 'damage') {
      playSfx('damage')
      // Déclencher le Screen Shake
      isShaking.value = true
      window.setTimeout(() => (isShaking.value = false), 420)
      // Déclencher le popup de dégâts flottant
      if (last.amount && last.amount > 0) {
        const sideTarget = last.side === 'player' ? 'player' : 'ai'
        const pid = Date.now() + Math.random()
        damagePopups.value.push({ id: pid, side: sideTarget, amount: last.amount })
        window.setTimeout(() => {
          damagePopups.value = damagePopups.value.filter((p) => p.id !== pid)
        }, 1400)
      }
    } else if (last.kind === 'destroy') {
      playSfx('destroy')
      isShaking.value = true
      window.setTimeout(() => (isShaking.value = false), 250)
    }
  },
)

watch(
  () => state.value?.over,
  (over) => {
    if (!over) return
    playSfx(state.value?.winner === 'player' ? 'win' : 'lose')
  },
)

watch(
  () => `${state.value?.turn ?? 0}:${state.value?.active ?? ''}`,
  () => {
    if (state.value?.active === 'player' && !state.value.over) duel.turnRemaining = TURN_SECONDS
  },
)
</script>

<template>
  <div v-if="stage === 'intro' || !state || !player || !aiPlayer" class="duel-intro">
    <div class="section-title">
      <h1>Duel contre l'IA</h1>
      <span>10 000 LP · main de 6 sans mulligan · 3 min 30 par tour · le premier joueur ne peut pas attaquer au tour 1</span>
    </div>

    <div class="duel-intro__grid">
      <section class="panel">
        <div class="panel__head"><h2>Préparation</h2></div>
        <div class="panel__body">
          <div style="margin-bottom: 14px">
            <span class="field-label">Deck actif</span>
            <p v-if="activeDeck" style="margin: 0 0 6px; font-family: var(--font-display); font-size: 20px">{{ activeDeck.name }}</p>
            <p v-else class="hint">Aucun deck sélectionné.</p>
            <p v-if="activeDeck" class="hint">
              {{ activeDeck.main.length }} cartes · {{ activeDeck.extra.length }} invocations spéciales ·
              <span v-if="deckCheck?.valid" style="color: var(--ok)">valide</span>
              <span v-else style="color: var(--warn)">invalide</span>
            </p>
            <RouterLink v-if="!deckCheck?.valid" to="/decks" class="btn btn--sm" style="margin-top: 8px">
              Corriger le deck
            </RouterLink>
          </div>

          <div>
            <span class="field-label">Difficulté de l'IA</span>
            <div class="chip-row">
              <button
                v-for="option in DIFFICULTIES"
                :key="option.id"
                class="chip"
                type="button"
                :class="{ 'chip--gold': difficulty === option.id }"
                @click="difficulty = option.id"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div style="margin-top: 14px">
            <span class="field-label">Type de duel</span>
            <div class="chip-row">
              <button class="chip" type="button" :class="{ 'chip--gold': ranked }" @click="ranked = true">
                Classé (ELO)
              </button>
              <button class="chip" type="button" :class="{ 'chip--gold': !ranked }" @click="ranked = false">
                Amical (sans ELO)
              </button>
            </div>
          </div>

          <p class="hint" style="margin-top: 16px">
            L'IA utilise le même moteur et ne voit jamais votre main ni vos cartes face cachée.
            Les LP, zones et règles de combat sont identiques pour les deux camps.
          </p>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h2>Premier joueur — pierre-feuille-ciseaux</h2></div>
        <div class="panel__body">
          <p class="hint">
            Le gagnant choisit qui commence. En cas d'égalité, on recommence. Le premier joueur ne pioche pas à son premier tour.
          </p>

          <div class="rps">
            <button
              v-for="(icon, choice) in RPS_ICON"
              :key="choice"
              class="rps__btn"
              type="button"
              :class="{ 'rps__btn--active': rpsChoice === choice }"
              @click="pickRps(choice)"
            >
              <span>{{ icon }}</span>
              {{ RPS_LABEL[choice] }}
            </button>
          </div>

          <div v-if="tossOutcome" class="rps__result">
            <p>
              Vous : <b>{{ rpsChoice ? RPS_LABEL[rpsChoice] : '—' }}</b> · IA : <b>{{ rpsAi ? RPS_LABEL[rpsAi] : '—' }}</b>
            </p>
            <p v-if="tossOutcome === 'tie'" class="notice"><span>↻</span><span>Égalité — relancez le tirage.</span></p>
            <template v-else-if="tossOutcome === 'win'">
              <p class="notice notice--ok"><span>★</span><span>Vous gagnez le tirage : choisissez qui commence.</span></p>
              <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px">
                <button class="btn btn--gold" type="button" :disabled="!deckCheck?.valid" @click="beginDuel('player')">
                  Je commence
                </button>
                <button class="btn" type="button" :disabled="!deckCheck?.valid" @click="beginDuel('ai')">
                  L'IA commence
                </button>
              </div>
            </template>
            <template v-else>
              <p class="notice"><span>✧</span><span>L'IA gagne le tirage et choisit : {{ aiStartChoice === 'ai' ? 'elle commence' : 'vous commencez' }}.</span></p>
              <button class="btn btn--gold" type="button" :disabled="!deckCheck?.valid" @click="beginDuel(aiStartChoice)">
                Commencer le duel
              </button>
            </template>
          </div>

          <p v-if="!deckCheck?.valid" class="notice notice--error" style="margin-top: 12px">
            <span>⚠</span>
            <span>Un deck valide est requis pour dueller.</span>
          </p>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="duel" :class="{ 'is-shaking': isShaking }">
    <!-- Indicateur d'action / réflexion IA avec spinner de latence -->
    <div v-if="duel.busy" class="duel__latency-banner">
      <div class="duel__latency-spinner"></div>
      <span>L'adversaire réfléchit à son prochain coup...</span>
    </div>

    <div class="duel__arena">
      <!-- Adversaire -->
      <section class="hud hud--ai">
        <div class="avatar avatar--ai">{{ aiPlayer.name.slice(0, 1) }}</div>
        <div class="hud__id">
          <strong>{{ aiPlayer.name }}</strong>
          <span class="hint">{{ aiPlayer.deckName }}</span>
        </div>
        <!-- Compteurs visuels Adversaire (Main & Deck) -->
        <div class="hud__counts">
          <div class="hud__count-badge" title="Nombre de cartes dans la main adverse">
            <span class="hud__count-icon">🎴</span>
            <span class="hud__count-label">Main</span>
            <b class="hud__count-val">{{ aiPlayer.hand.length }}</b>
          </div>
          <div class="hud__count-badge" title="Cartes restantes dans le deck adverse">
            <span class="hud__count-icon">📚</span>
            <span class="hud__count-label">Deck</span>
            <b class="hud__count-val">{{ aiPlayer.deck.length }}</b>
          </div>
        </div>
        <div
          v-if="aiPlayer.terrain"
          class="hud__terrain"
          :title="getCard(aiPlayer.terrain.cardId).text"
        >
          <i aria-hidden="true">⛰</i>
          <b>{{ getCard(aiPlayer.terrain.cardId).name }}</b>
        </div>
        <div class="hud__lp">
          <span>LP</span>
          <b>{{ aiPlayer.lp.toLocaleString('fr-FR') }}</b>
          <div class="lpbar"><div class="lpbar__fill lpbar__fill--ai" :style="{ width: `${(aiPlayer.lp / 10000) * 100}%` }" /></div>
          <!-- Chiffres de dégâts flottants (AI) -->
          <div class="damage-popups-container">
            <transition-group name="damage-pop">
              <div
                v-for="pop in damagePopups.filter((p) => p.side === 'ai')"
                :key="pop.id"
                class="damage-popup"
              >
                -{{ pop.amount.toLocaleString('fr-FR') }}
              </div>
            </transition-group>
          </div>
        </div>
      </section>

      <!-- Éventail visuel des cartes face cachée dans la main de l'adversaire -->
      <div v-if="aiPlayer.hand.length > 0" class="ai-hand-display" :title="`L'adversaire a ${aiPlayer.hand.length} carte(s) en main`">
        <div
          v-for="n in Math.min(10, aiPlayer.hand.length)"
          :key="n"
          class="ai-hand-card"
          :style="{
            '--rot': `${(n - (Math.min(10, aiPlayer.hand.length) + 1) / 2) * 5}deg`,
            '--x': `${(n - (Math.min(10, aiPlayer.hand.length) + 1) / 2) * 18}px`
          }"
        >
          <img src="/assets/ui/card-back.svg" alt="" aria-hidden="true" />
        </div>
        <span v-if="aiPlayer.hand.length > 10" class="ai-hand-more">+{{ aiPlayer.hand.length - 10 }}</span>
      </div>

      <!-- Plateau Master Duel 3D (Perspective & Tapis de jeu) -->
      <div class="duel__board">
        <div class="duel__mat">
          <section class="field field--ai">
            <div class="field__piles">
              <button class="pile" type="button" @click="openPile('ai', 'extra')">Extra<b>{{ aiPlayer.extra.length }}</b></button>
              <div class="pile pile--static">Deck<b>{{ aiPlayer.deck.length }}</b></div>
            </div>
            <div class="field__grid">
              <ZoneSlot
                kind="terrain"
                label="Terrain"
                :inst="aiPlayer.terrain"
                :flash-uid="duel.flashUid"
                @select="selectZone"
                @inspect="(id) => (detail = id)"
              />
              <div class="field__row">
                <ZoneSlot
                  v-for="(slot, index) in aiPlayer.spells"
                  :key="`ai-spell-${index}`"
                  kind="spell"
                  label="Magie / Piège"
                  :inst="slot"
                  :flash-uid="duel.flashUid"
                  @select="selectZone"
                  @inspect="(id) => (detail = id)"
                />
              </div>
              <div class="field__row">
                <ZoneSlot
                  v-for="(slot, index) in aiPlayer.monsters"
                  :key="`ai-monster-${index}`"
                  kind="monster"
                  label="Personnage"
                  :inst="slot"
                  :flash-uid="duel.flashUid"
                  :selected-uid="selectedUid"
                  @select="selectZone"
                  @inspect="(id) => (detail = id)"
                >
                  <template #badge>
                    <span v-if="slot && effectiveBadge(slot, 'ai')" class="slot__badge">{{ effectiveBadge(slot, 'ai') }}</span>
                  </template>
                </ZoneSlot>
              </div>
            </div>
            <div class="field__piles">
              <button class="pile" type="button" @click="openPile('ai', 'gy')">Cimetière<b>{{ aiPlayer.gy.length }}</b></button>
              <button class="pile" type="button" @click="openPile('ai', 'banished')">Banni<b>{{ aiPlayer.banished.length }}</b></button>
            </div>
          </section>

          <!-- Centre : Nexus d'énergie Master Duel -->
          <div class="turnline">
            <div class="turnline__pill">
              <span>Tour {{ state.turn }}</span>
              <b>{{ state.active === 'player' ? 'Vous' : 'IA' }}</b>
            </div>
            <div class="phaserail">
              <span
                v-for="(phase, index) in PHASE_ORDER"
                :key="phase"
                class="phaserail__step"
                :class="{ 'phaserail__step--active': index === phaseIndex, 'phaserail__step--done': index < phaseIndex }"
              >
                {{ PHASE_LABEL[phase] }}
              </span>
            </div>
            <div class="turnline__timer" :class="{ 'turnline__timer--low': duel.turnRemaining <= 30 && state.active === 'player' }">
              ⏱ {{ timerLabel }}
            </div>
            <div v-if="state.active === 'player' && !state.over && inactivityLeft <= 30" class="turnline__idle">
              ⏳ Inactivité {{ inactivityLeft }} s
            </div>
          </div>

          <!-- Joueur -->
          <section class="field field--player">
            <div class="field__piles">
              <button
                class="pile pile--extra"
                :class="{ 'pile--glow': extraOptions.length > 0 }"
                type="button"
                :title="extraOptions.length ? 'Invocation spéciale disponible' : 'Extra Deck'"
                @click="openPile('player', 'extra')"
              >
                Extra<b>{{ player.extra.length }}</b>
                <span v-if="extraOptions.length" class="pile__pip">{{ extraOptions.length }}</span>
              </button>
              <div class="pile pile--static">Deck<b>{{ player.deck.length }}</b></div>
            </div>
            <div class="field__grid">
              <ZoneSlot
                kind="terrain"
                label="Terrain"
                :inst="player.terrain"
                :flash-uid="duel.flashUid"
                @select="selectZone"
                @inspect="(id) => (detail = id)"
              />
              <div class="field__row">
                <ZoneSlot
                  v-for="(slot, index) in player.monsters"
                  :key="`p-monster-${index}`"
                  kind="monster"
                  label="Personnage"
                  :inst="slot"
                  :flash-uid="duel.flashUid"
                  :selected-uid="selectedUid"
                  @select="selectZone"
                  @inspect="(id) => (detail = id)"
                >
                  <template #badge>
                    <span v-if="slot && effectiveBadge(slot, 'player')" class="slot__badge">{{ effectiveBadge(slot, 'player') }}</span>
                  </template>
                </ZoneSlot>
              </div>
              <div class="field__row">
                <ZoneSlot
                  v-for="(slot, index) in player.spells"
                  :key="`p-spell-${index}`"
                  kind="spell"
                  label="Magie / Piège"
                  :inst="slot"
                  :flash-uid="duel.flashUid"
                  @select="selectZone"
                  @inspect="(id) => (detail = id)"
                />
              </div>
            </div>
            <div class="field__piles">
              <button class="pile" type="button" @click="openPile('player', 'gy')">Cimetière<b>{{ player.gy.length }}</b></button>
              <button class="pile" type="button" @click="openPile('player', 'banished')">Banni<b>{{ player.banished.length }}</b></button>
            </div>
          </section>
        </div>
      </div>

      <section class="hud hud--player">
        <div class="avatar" :class="{ 'avatar--has-img': Boolean(profile.profile.avatar) }">
          <img
            v-if="profile.profile.avatar"
            :src="profile.profile.avatar"
            alt=""
            class="avatar__img"
          />
          <span v-else>{{ player.name.slice(0, 1) }}</span>
        </div>
        <div class="hud__id">
          <strong>{{ player.name }}</strong>
          <span class="hint">{{ player.deckName }} · main {{ player.hand.length }} · deck {{ player.deck.length }}</span>
        </div>
        <div
          v-if="player.terrain"
          class="hud__terrain"
          :title="getCard(player.terrain.cardId).text"
        >
          <i aria-hidden="true">⛰</i>
          <b>{{ getCard(player.terrain.cardId).name }}</b>
        </div>
        <div class="hud__lp">
          <span>LP</span>
          <b>{{ player.lp.toLocaleString('fr-FR') }}</b>
          <div class="lpbar"><div class="lpbar__fill" :style="{ width: `${(player.lp / 10000) * 100}%` }" /></div>
          <!-- Chiffres de dégâts flottants (Joueur) -->
          <div class="damage-popups-container">
            <transition-group name="damage-pop">
              <div
                v-for="pop in damagePopups.filter((p) => p.side === 'player')"
                :key="pop.id"
                class="damage-popup damage-popup--player"
              >
                -{{ pop.amount.toLocaleString('fr-FR') }}
              </div>
            </transition-group>
          </div>
        </div>
      </section>

      <!-- Tray actions -->
      <section class="tray">
        <div v-if="duel.waitingForPlayerChain" class="tray__block">
          <span class="tray__title">Chaîne — Vitesse {{ state.chain[state.chain.length - 1]?.speed ?? 1 }}</span>
          <p class="hint" style="margin: 0 0 8px">
            {{ state.chain[state.chain.length - 1]?.sourceName }} est en chaîne. Vous pouvez répondre avec une carte de vitesse égale ou supérieure.
          </p>
          <div class="tray__actions">
            <button
              v-for="move in chainMoves"
              :key="move.key"
              class="btn btn--sm"
              :class="{ 'btn--gold': move.kind === 'chain' }"
              type="button"
              :disabled="duel.busy"
              :title="move.hint"
              @click="run(move.action)"
            >
              {{ move.label }}
            </button>
          </div>
        </div>

        <div v-else-if="selectedMoves.length" class="tray__block">
          <span class="tray__title">{{ selectedLabel }}</span>
          <div class="tray__actions">
            <button
              v-for="move in selectedMoves"
              :key="move.key"
              class="btn btn--sm"
              type="button"
              :disabled="duel.busy"
              :title="move.hint"
              @click="run(move.action)"
            >
              {{ move.label }}
              <span v-if="move.hint" class="tray__hint">{{ move.hint }}</span>
            </button>
            <button class="btn btn--sm btn--ghost" type="button" @click="selectedHand = null; selectedUid = null">Annuler</button>
          </div>
        </div>

        <div v-else class="tray__block tray__block--row">
          <span class="hint">
            <template v-if="state.over">Duel terminé.</template>
            <template v-else-if="duel.busy">L'IA réfléchit…</template>
            <template v-else-if="state.active !== 'player'">Tour de l'IA — vos actions sont en attente.</template>
            <template v-else-if="(selectedHand != null || selectedUid) && !selectedMoves.length">
              Aucune action disponible pour cette carte dans la phase {{ PHASE_LABEL[state.phase] }}.
            </template>
            <template v-else-if="openingTurnBlocked">
              Le premier joueur ne peut pas attaquer lors de son premier tour — passez à la phase suivante.
            </template>
            <template v-else>Sélectionnez une carte en main ou sur le terrain pour voir ses actions.</template>
          </span>
          <div class="tray__phases">
            <button
              v-for="move in duel.playerMoves.filter((m) => m.kind === 'phase')"
              :key="move.key"
              class="btn btn--sm"
              :class="{ 'btn--gold': move.key === 'advance' }"
              type="button"
              :disabled="duel.busy || state.over"
              @click="run(move.action)"
            >
              {{ move.label }}
            </button>
            <button class="btn btn--sm btn--danger" type="button" :disabled="duel.busy || state.over" @click="abandon">Abandonner</button>
          </div>
        </div>
      </section>

      <!-- Extra Deck : invocations spéciales disponibles -->
      <section v-if="extraOptions.length" class="extra-rail" :class="{ 'extra-rail--ready': canSpecialNow }">
        <div class="extra-rail__head">
          <span class="extra-rail__dot" aria-hidden="true" />
          <strong>Invocation spéciale disponible</strong>
          <span class="hint">Choisissez la carte à invoquer depuis l'Extra Deck.</span>
        </div>
        <div class="extra-rail__cards">
          <article v-for="option in extraOptions" :key="option.extraIndex" class="extra-rail__card">
            <CardFace
              :card-id="option.cardId"
              size="sm"
              @select="detail = option.cardId"
              @inspect="(id) => (detail = id)"
            />
            <button
              class="btn btn--sm btn--gold extra-rail__btn"
              type="button"
              :disabled="!canSpecialNow || duel.busy"
              :title="option.kindLabel"
              @click="run({ type: 'special', extraIndex: option.extraIndex })"
            >
              Invoquer
            </button>
          </article>
        </div>
      </section>

      <!-- Main -->
      <section class="handrail">
        <div class="handrail__label">
          <span>Main · {{ player.hand.length }}</span>
          <span class="hint">Sans limite de main</span>
        </div>
        <div class="handrail__cards">
          <CardFace
            v-for="(inst, index) in player.hand"
            :key="inst.uid"
            :card-id="inst.cardId"
            size="sm"
            :selected="selectedHand === index"
            :disabled="!duel.isPlayerTurn"
            @select="selectHand(index)"
            @inspect="(id) => (detail = id)"
          />
          <p v-if="!player.hand.length" class="hint">Main vide — une main vide ne provoque pas de défaite.</p>
        </div>
      </section>
    </div>

    <!-- Journal -->
    <aside class="logpanel panel">
      <div class="panel__head">
        <h2>Journal</h2>
        <span class="chip">{{ state.turn }} tours</span>
        <button class="btn btn--sm" type="button" style="margin-left: auto" @click="openReplay">⟲ Replay</button>
      </div>
      <div class="panel__body logpanel__body">
        <ol class="log">
          <li v-for="event in duel.recentEvents" :key="event.n" class="log__item" :class="`log__item--${event.kind}`">
            <span class="log__icon" aria-hidden="true">{{ eventIcon[event.kind] ?? '·' }}</span>
            <span class="log__text">{{ event.text }}</span>
          </li>
        </ol>
      </div>
    </aside>

    <p v-if="duel.error" class="toast" role="alert" @click="duel.error = null">{{ duel.error }}</p>

    <!-- Résultat -->
    <div v-if="state.over" class="modal">
      <div class="result panel">
        <span class="chip" :class="state.winner === 'player' ? 'chip--ok' : 'chip--warn'">Duel terminé</span>
        <h2 class="result__title">{{ resultTitle }}</h2>
        <p class="hint">{{ state.endReason }}</p>
        <p class="hint">Tour {{ state.turn }} · {{ player.name }} {{ player.lp }} LP · {{ aiPlayer.name }} {{ aiPlayer.lp }} LP</p>
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 16px; flex-wrap: wrap">
          <button class="btn btn--gold" type="button" @click="replay">Revanche</button>
          <RouterLink to="/" class="btn">Menu</RouterLink>
          <RouterLink to="/profil" class="btn">Voir l'historique</RouterLink>
        </div>
      </div>
    </div>

    <!-- Piles -->
    <div v-if="pileView" class="modal" @click.self="pileView = null">
      <div class="panel" style="width: min(520px, 100%); max-height: 80vh; overflow: auto">
        <div class="panel__head">
          <h2>{{ pileView.title }}</h2>
          <button class="btn btn--sm" type="button" @click="pileView = null">Fermer</button>
        </div>
        <div class="panel__body">
          <p v-if="!pileView.cards.length" class="hint">Vide.</p>
          <ul class="entrylist">
            <li v-for="(cardId, index) in pileView.cards" :key="`${cardId}-${index}`" class="entry">
              <span class="entry__name">{{ getCard(cardId).name }}</span>
              <span class="entry__meta">{{ getCard(cardId).universe }}</span>
              <button class="entry__btn" type="button" @click="detail = cardId">i</button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <CardDetail v-if="detail" :card-id="detail" @close="detail = null" />

    <!-- Replay du journal d'événements -->
    <div v-if="replayView" class="modal" @click.self="closeReplay">
      <div class="panel replay">
        <div class="panel__head">
          <h2>Replay du duel</h2>
          <button class="btn btn--sm" type="button" style="margin-left: auto" @click="closeReplay">Fermer</button>
        </div>
        <div class="panel__body">
          <div class="replay__controls">
            <button class="btn btn--sm" type="button" @click="replayStep(-1)">◀</button>
            <button class="btn btn--sm btn--gold" type="button" @click="replayView.playing = !replayView.playing">
              {{ replayView.playing ? '⏸ Pause' : '▶ Lecture' }}
            </button>
            <button class="btn btn--sm" type="button" @click="replayStep(1)">▶</button>
            <button class="btn btn--sm" type="button" @click="replayView.index = 0; replayView.playing = false">⟲ Début</button>
            <span class="hint">{{ replayView.index }} / {{ duel.events.length }} événements</span>
          </div>
          <ol class="log replay__log">
            <li
              v-for="(event, index) in duel.events.slice(0, replayView.index)"
              :key="`${event.n}-${index}`"
              class="log__item"
              :class="`log__item--${event.kind}`"
            >
              <span class="log__icon" aria-hidden="true">{{ eventIcon[event.kind] ?? '·' }}</span>
              <span class="log__text">{{ event.text }}</span>
            </li>
          </ol>
          <p v-if="!replayView.index" class="hint">Appuyez sur Lecture pour rejouer le duel depuis le début.</p>
        </div>
      </div>
    </div>

    <!-- Tutoriel court -->
    <div v-if="tutorialStep >= 0" class="modal">
      <div class="panel tutorial">
        <div class="panel__head">
          <h2>Tutoriel · {{ tutorialStep + 1 }} / {{ TUTORIAL_STEPS.length }}</h2>
          <button class="btn btn--sm" type="button" style="margin-left: auto" @click="nextTutorial">
            {{ tutorialStep === TUTORIAL_STEPS.length - 1 ? 'Terminer' : 'Suivant' }}
          </button>
        </div>
        <div class="panel__body">
          <h3 class="tutorial__title">{{ TUTORIAL_STEPS[tutorialStep].title }}</h3>
          <p class="tutorial__text">{{ TUTORIAL_STEPS[tutorialStep].text }}</p>
          <div class="tutorial__dots">
            <span
              v-for="(_, index) in TUTORIAL_STEPS"
              :key="index"
              class="tutorial__dot"
              :class="{ 'tutorial__dot--on': index <= tutorialStep }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
