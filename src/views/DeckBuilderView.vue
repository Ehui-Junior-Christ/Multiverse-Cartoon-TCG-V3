<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CardDetail from '../components/CardDetail.vue'
import SmartDeckBuilder from '../components/SmartDeckBuilder.vue'
import { CARDS, CATEGORY_LABEL, RARITY_ORDER, getCard } from '../engine/catalog'
import { DECK_MAX, DECK_MIN, EXTRA_MAX, MAX_COPIES, validateDeck } from '../engine/deck'
import { useProfileStore } from '../stores/profile'
import type { Deck } from '../engine/deck'
import type { Category } from '../engine/types'

const store = useProfileStore()

interface Draft {
  id: string
  name: string
  main: string[]
  extra: string[]
}

const selectedId = ref(store.activeDeckId || store.decks[0]?.id || '')
const draft = ref<Draft | null>(null)
const search = ref('')
const category = ref<'all' | Category>('all')
const detail = ref<string | null>(null)
const justSaved = ref(false)
const saveError = ref<string | null>(null)
const showSmartBuilder = ref(false)

function applySmartDeck(deckData: { name: string; main: string[]; extra: string[] }) {
  const id = `deck-${crypto.randomUUID().slice(0, 8)}`
  draft.value = {
    id,
    name: deckData.name,
    main: [...deckData.main],
    extra: [...deckData.extra],
  }
  selectedId.value = ''
  justSaved.value = false
  saveError.value = null
  showSmartBuilder.value = false
}

function loadDraft(deck: Deck | null): void {
  draft.value = deck ? { id: deck.id, name: deck.name, main: [...deck.main], extra: [...deck.extra] } : null
  justSaved.value = false
  saveError.value = null
}

watch(
  () => store.decks.find((deck) => deck.id === selectedId.value) ?? null,
  (deck) => {
    if (!draft.value || draft.value.id !== deck?.id) loadDraft(deck)
  },
  { immediate: true },
)

const validation = computed(() =>
  draft.value ? validateDeck(draft.value.main, draft.value.extra) : null,
)
const mainCounts = computed(() => countCards(draft.value?.main ?? []))
const extraCounts = computed(() => countCards(draft.value?.extra ?? []))
const deckSignature = computed(() => (draft.value?.main ?? []).filter((id) => getCard(id).category === 'character').length)

function countCards(ids: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const id of ids) map.set(id, (map.get(id) ?? 0) + 1)
  return map
}

const deckEntries = computed(() => {
  if (!validation.value) return []
  const groups = new Map<string, { cardId: string; count: number }>()
  for (const id of draft.value?.main ?? []) {
    groups.set(id, { cardId: id, count: (groups.get(id)?.count ?? 0) + 1 })
  }
  return [...groups.values()].sort((a, b) => {
    const ca = getCard(a.cardId)
    const cb = getCard(b.cardId)
    return RARITY_ORDER[cb.rarity] - RARITY_ORDER[ca.rarity] || ca.name.localeCompare(cb.name)
  })
})

const extraEntries = computed(() =>
  [...extraCounts.value.entries()].map(([cardId, count]) => ({ cardId, count })),
)

const catalog = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return CARDS.filter((card) => {
    if (category.value !== 'all' && card.category !== category.value) return false
    if (needle && !`${card.name} ${card.text}`.toLowerCase().includes(needle)) return false
    return true
  }).sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || a.name.localeCompare(b.name))
})

const owned = (cardId: string) => store.quantityOf(cardId)

function add(card: { id: string; category: string }) {
  if (!draft.value) return
  const counts = card.category === 'special' ? extraCounts.value : mainCounts.value
  const current = counts.get(card.id) ?? 0
  if (current >= MAX_COPIES || owned(card.id) <= current) return
  if (card.category === 'special') {
    if (draft.value.extra.length >= EXTRA_MAX) return
    draft.value.extra.push(card.id)
  } else {
    if (draft.value.main.length >= DECK_MAX) return
    draft.value.main.push(card.id)
  }
  justSaved.value = false
}

function remove(cardId: string, fromExtra = false) {
  if (!draft.value) return
  const list = fromExtra ? draft.value.extra : draft.value.main
  const index = list.indexOf(cardId)
  if (index >= 0) list.splice(index, 1)
  justSaved.value = false
}

function newDeck() {
  const id = `deck-${crypto.randomUUID().slice(0, 8)}`
  draft.value = { id, name: 'Nouveau deck', main: [], extra: [] }
  selectedId.value = ''
  justSaved.value = false
}

function duplicate() {
  if (!draft.value) return
  draft.value = {
    id: `deck-${crypto.randomUUID().slice(0, 8)}`,
    name: `${draft.value.name} (copie)`,
    main: [...draft.value.main],
    extra: [...draft.value.extra],
  }
  selectedId.value = ''
  justSaved.value = false
}

async function save() {
  if (!draft.value || !validation.value?.valid) return
  saveError.value = null
  const response = await store.saveDeck({ ...draft.value })
  if (!response.ok) {
    saveError.value = response.error ?? 'Enregistrement impossible'
    return
  }
  selectedId.value = draft.value.id
  store.setActiveDeck(draft.value.id)
  justSaved.value = true
}

async function removeDeck() {
  if (!draft.value) return
  if (!window.confirm(`Supprimer le deck « ${draft.value.name} » ?`)) return
  await store.deleteDeck(draft.value.id)
  draft.value = null
  selectedId.value = store.decks[0]?.id ?? ''
}
</script>

<template>
  <div class="deckbuilder">
    <div class="section-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px">
      <div>
        <h1>Deck Builder</h1>
        <span>{{ DECK_MIN }}–{{ DECK_MAX }} cartes · {{ MAX_COPIES }} exemplaires max · Extra Deck ≤ {{ EXTRA_MAX }}</span>
      </div>
      <button
        class="btn btn--gold"
        type="button"
        @click="showSmartBuilder = !showSmartBuilder"
      >
        <span>✨</span>
        <span>{{ showSmartBuilder ? 'Masquer le Concepteur IA' : 'Concepteur de Deck IA' }}</span>
      </button>
    </div>

    <!-- Concepteur de deck intelligent avec synergies & affinités -->
    <SmartDeckBuilder
      v-if="showSmartBuilder"
      @apply="applySmartDeck"
      @close="showSmartBuilder = false"
    />

    <div class="deckbuilder__grid">
      <aside class="panel decklist">
        <div class="panel__head">
          <h2>Mes decks</h2>
          <button class="btn btn--sm" type="button" @click="newDeck">+</button>
        </div>
        <div class="panel__body decklist__items">
          <button
            v-for="deck in store.decks"
            :key="deck.id"
            class="decklist__item"
            type="button"
            :class="{ 'decklist__item--active': deck.id === selectedId }"
            @click="selectedId = deck.id"
          >
            <strong>{{ deck.name }}</strong>
            <span>{{ deck.main.length }} cartes · {{ deck.extra.length }} extra</span>
          </button>
          <p v-if="!store.decks.length" class="hint">Aucun deck enregistré.</p>
        </div>
      </aside>

      <section class="panel editor">
        <div class="panel__head">
          <h2>{{ draft ? 'Édition' : 'Aucun deck sélectionné' }}</h2>
          <span v-if="draft" class="chip">{{ draft.main.length }} / {{ DECK_MAX }}</span>
          <span v-if="draft" class="chip">{{ draft.extra.length }} / {{ EXTRA_MAX }} extra</span>
        </div>

        <div v-if="draft" class="panel__body">
          <div class="filters" style="margin-bottom: 14px">
            <div style="flex: 2 1 220px">
              <label class="field-label" for="deck-name">Nom du deck</label>
              <input id="deck-name" v-model="draft.name" class="input" maxlength="40" />
            </div>
            <button class="btn" type="button" @click="duplicate">Dupliquer</button>
            <button class="btn btn--danger" type="button" @click="removeDeck">Supprimer</button>
          </div>

          <div v-if="validation" :class="['notice', validation.valid ? 'notice--ok' : '']" style="margin-bottom: 14px">
            <span>{{ validation.valid ? '✓' : '⚠' }}</span>
            <div>
              <strong v-if="validation.valid">Deck valide — utilisable en duel.</strong>
              <strong v-else>Deck invalide — enregistrement bloqué.</strong>
              <ul v-if="!validation.valid" class="validation">
                <li v-for="error in validation.errors" :key="error">{{ error }}</li>
              </ul>
              <p v-else class="hint">
                {{ validation.characterCount }} personnages · {{ validation.uniqueMain }} cartes différentes ·
                {{ validation.extraCount }} invocations spéciales
              </p>
            </div>
          </div>

          <div class="deckstats">
            <div class="deckstat">
              <span>Principal</span><b>{{ draft.main.length }}</b>
            </div>
            <div class="deckstat">
              <span>Personnages</span><b>{{ deckSignature }}</b>
            </div>
            <div class="deckstat">
              <span>Extra</span><b>{{ draft.extra.length }}</b>
            </div>
          </div>

          <h3 class="subhead">Deck principal</h3>
          <p v-if="!deckEntries.length" class="hint">Ajoutez des cartes depuis le catalogue de droite.</p>
          <ul class="entrylist">
            <li v-for="entry in deckEntries" :key="entry.cardId" class="entry">
              <span class="entry__count">×{{ entry.count }}</span>
              <span class="entry__name">{{ getCard(entry.cardId).name }}</span>
              <span class="entry__meta">{{ CATEGORY_LABEL[getCard(entry.cardId).category] }}</span>
              <button class="entry__btn" type="button" @click="detail = entry.cardId">i</button>
              <button class="entry__btn entry__btn--minus" type="button" @click="remove(entry.cardId)">−</button>
            </li>
          </ul>

          <h3 class="subhead">Extra Deck</h3>
          <p v-if="!extraEntries.length" class="hint">Les Invocations spéciales vont dans l'Extra Deck.</p>
          <ul class="entrylist">
            <li v-for="entry in extraEntries" :key="entry.cardId" class="entry">
              <span class="entry__count">×{{ entry.count }}</span>
              <span class="entry__name">{{ getCard(entry.cardId).name }}</span>
              <span class="entry__meta">{{ getCard(entry.cardId).subcategory }}</span>
              <button class="entry__btn" type="button" @click="detail = entry.cardId">i</button>
              <button class="entry__btn entry__btn--minus" type="button" @click="remove(entry.cardId, true)">−</button>
            </li>
          </ul>

          <div style="display: flex; gap: 10px; margin-top: 16px; align-items: center; flex-wrap: wrap">
            <button class="btn btn--gold" type="button" :disabled="!validation?.valid || store.saving" @click="save">
              {{ store.saving ? 'Enregistrement…' : 'Enregistrer et utiliser' }}
            </button>
            <span v-if="justSaved" class="chip chip--ok">Enregistré</span>
            <span v-if="saveError" class="chip chip--warn">{{ saveError }}</span>
          </div>
        </div>

        <div v-else class="panel__body" style="text-align: center; padding: 32px 18px">
          <p class="hint" style="margin-bottom: 16px">Sélectionnez un deck à gauche, créez-en un nouveau ou utilisez l'IA pour concevoir un deck synergique.</p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap">
            <button class="btn btn--gold" type="button" @click="showSmartBuilder = true">
              ✨ Concevoir un deck avec l'IA
            </button>
            <button class="btn" type="button" @click="newDeck">
              + Créer un deck vierge
            </button>
          </div>
        </div>
      </section>

      <aside class="panel catalog-panel">
        <div class="panel__head"><h2>Catalogue</h2><span class="chip">{{ catalog.length }}</span></div>
        <div class="panel__body">
          <div class="filters" style="margin-bottom: 10px">
            <div style="flex: 2 1 150px">
              <label class="field-label" for="catalog-search">Recherche</label>
              <input id="catalog-search" v-model="search" class="input" type="search" />
            </div>
            <div>
              <label class="field-label" for="catalog-cat">Catégorie</label>
              <select id="catalog-cat" v-model="category" class="select">
                <option value="all">Toutes</option>
                <option v-for="(label, key) in CATEGORY_LABEL" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
          </div>

          <ul class="catalog-list">
            <li v-for="card in catalog" :key="card.id" class="catalog-item">
              <div class="catalog-item__info">
                <strong>{{ card.name }}</strong>
                <span>
                  {{ CATEGORY_LABEL[card.category] }}
                  <template v-if="card.category === 'character'"> · Pop. {{ card.popularity }} · {{ card.atk }}/{{ card.def }}</template>
                </span>
              </div>
              <span class="catalog-item__owned" :title="`${owned(card.id)} en collection`">{{ owned(card.id) }}</span>
              <button class="entry__btn" type="button" @click="detail = card.id">i</button>
              <button
                class="btn btn--sm"
                type="button"
                :disabled="!draft || (card.category === 'special' ? (extraCounts.get(card.id) ?? 0) : (mainCounts.get(card.id) ?? 0)) >= MAX_COPIES || owned(card.id) <= ((card.category === 'special' ? extraCounts.get(card.id) : mainCounts.get(card.id)) ?? 0)"
                @click="add(card)"
              >
                +
              </button>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <CardDetail v-if="detail" :card-id="detail" @close="detail = null" />
  </div>
</template>
