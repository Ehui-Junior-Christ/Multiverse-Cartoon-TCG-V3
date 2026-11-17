<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import CardFace from '../components/CardFace.vue'
import { CARD_INDEX, RARITY_LABEL, UNIVERSES } from '../engine/catalog'
import { PITY_THRESHOLDS, PACKS, type PackKind } from '../engine/economy'
import { useProfileStore } from '../stores/profile'

const store = useProfileStore()

const universe = ref<string>(UNIVERSES[0]?.id ?? '')
const opening = ref<{ cards: string[]; pityTriggered: string | null } | null>(null)
const revealed = ref(0)
const busy = ref(false)
const message = ref<{ text: string; tone: 'ok' | 'warn' } | null>(null)
let revealTimer: number | undefined

const packKind = ref<PackKind>('classic')

const pityInfo = computed(() => [
  { label: 'Epic+', current: store.pity.epic, max: PITY_THRESHOLDS.epic + 1 },
  { label: 'Legendary+', current: store.pity.legendary, max: PITY_THRESHOLDS.legendary + 1 },
  { label: 'Ultra', current: store.pity.ultra, max: PITY_THRESHOLDS.ultra + 1 },
])

const revealedCards = computed(() => (opening.value ? opening.value.cards.slice(0, revealed.value) : []))
const allRevealed = computed(() => (opening.value ? revealed.value >= opening.value.cards.length : true))

function stopReveal() {
  if (revealTimer) {
    window.clearInterval(revealTimer)
    revealTimer = undefined
  }
}

function startReveal() {
  stopReveal()
  revealTimer = window.setInterval(() => {
    if (!opening.value || revealed.value >= opening.value.cards.length) {
      stopReveal()
      return
    }
    revealed.value += 1
  }, 320)
}

async function buy(kind: PackKind, count = 1) {
  if (busy.value) return
  packKind.value = kind
  busy.value = true
  message.value = null
  try {
    const allCards: string[] = []
    let trigger: string | null = null
    for (let index = 0; index < count; index++) {
      const result = await store.openBooster(kind, kind === 'thematic' ? universe.value : undefined)
      if (!result.ok) {
        message.value = { text: index === 0 ? result.error : `${result.error} — ${index} booster(s) ouvert(s).`, tone: 'warn' }
        break
      }
      allCards.push(...result.cards)
      if (result.pityTriggered) trigger = result.pityTriggered
    }
    if (!allCards.length) return
    opening.value = { cards: allCards, pityTriggered: trigger }
    revealed.value = count > 1 ? allCards.length : 0
    if (count === 1) startReveal()
  } finally {
    busy.value = false
  }
}

function revealAll() {
  if (!opening.value) return
  stopReveal()
  revealed.value = opening.value.cards.length
}

function closeOpening() {
  stopReveal()
  opening.value = null
  revealed.value = 0
}

onBeforeUnmount(stopReveal)
</script>

<template>
  <div class="shop">
    <div class="section-title">
      <h1>Boutique</h1>
      <span>Boosters de 10 cartes · doublons possibles · aucune protection contre les doublons</span>
    </div>

    <section class="shop__top panel">
      <div class="panel__body shop__wallet">
        <div class="shop__jm">
          <span class="shop__jm-icon" aria-hidden="true">◆</span>
          <b>{{ store.profile.jm.toLocaleString('fr-FR') }}</b>
          <span class="hint">Jetons Multivers</span>
        </div>
        <div class="shop__pity">
          <span class="field-label" style="margin: 0">Compteurs de pity</span>
          <div class="shop__pity-row">
            <span v-for="entry in pityInfo" :key="entry.label" class="shop__pity-item" :title="`${entry.current} / ${entry.max}`">
              {{ entry.label }} <b>{{ entry.current }}</b><i>/{{ entry.max }}</i>
            </span>
          </div>
        </div>
      </div>
    </section>

    <p v-if="message" class="notice" :class="{ 'notice--error': message.tone === 'warn' }">
      <span>⚠</span><span>{{ message.text }}</span>
    </p>

    <section class="shop__packs">
      <article v-for="pack in PACKS" :key="pack.id" class="shop__pack panel">
        <div class="panel__head">
          <h2>{{ pack.name }}</h2>
          <span class="chip chip--gold">{{ pack.cost }} JM</span>
        </div>
        <div class="panel__body">
          <p class="hint">{{ pack.description }}</p>
          <label v-if="pack.id === 'thematic'" class="field-label" for="shop-universe">Univers</label>
          <select v-if="pack.id === 'thematic'" id="shop-universe" v-model="universe" class="select">
            <option v-for="u in UNIVERSES" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
          <button
            class="btn btn--gold shop__buy"
            type="button"
            :disabled="busy || store.profile.jm < pack.cost"
            @click="buy(pack.id)"
          >
            Ouvrir — {{ pack.cost }} JM
          </button>
          <button
            class="btn shop__buy"
            type="button"
            :disabled="busy || store.profile.jm < pack.cost * 10"
            @click="buy(pack.id, 10)"
          >
            ×10 — {{ pack.cost * 10 }} JM
          </button>
        </div>
      </article>
    </section>

    <section class="panel">
      <div class="panel__head">
        <h2>Comment obtenir des Jetons Multivers</h2>
      </div>
      <div class="panel__body">
        <ul class="checklist">
          <li>Victoire contre l'IA : <b>+60 JM</b> et +30 XP</li>
          <li>Défaite : <b>+20 JM</b> et +10 XP</li>
          <li>Aucun transfert de JM entre joueurs, aucun achat réel dans ce prototype.</li>
        </ul>
      </div>
    </section>

    <!-- Ouverture du booster -->
    <div v-if="opening" class="modal" @click.self="closeOpening">
      <div class="panel shop__opening">
        <div class="panel__head">
          <h2>Ouverture du booster</h2>
          <span class="chip">{{ revealedCards.length }} / {{ opening.cards.length }}</span>
          <button class="btn btn--sm" type="button" style="margin-left: auto" @click="closeOpening">Fermer</button>
        </div>
        <div class="panel__body">
          <p v-if="opening.pityTriggered" class="notice notice--ok" style="margin-bottom: 12px">
            <span>★</span>
            <span>Pity déclenchée : carte {{ opening.pityTriggered }} garantie.</span>
          </p>
          <div class="shop__reveal">
            <div v-for="(id, index) in revealedCards" :key="`${id}-${index}`" class="shop__reveal-card">
              <CardFace :card-id="id" size="sm" />
              <span class="shop__rarity">{{ RARITY_LABEL[CARD_INDEX.get(id)?.rarity ?? 'common'] }}</span>
            </div>
          </div>
          <p v-if="!revealedCards.length" class="hint">Révélation en cours…</p>
          <div class="shop__actions">
            <button class="btn btn--sm" type="button" :disabled="allRevealed" @click="revealAll">Tout révéler</button>
            <button class="btn btn--sm btn--gold" type="button" :disabled="busy" @click="closeOpening(); buy(packKind)">
              Ouvrir à nouveau
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
