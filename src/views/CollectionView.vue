<script setup lang="ts">
import { computed, ref } from 'vue'
import CardFace from '../components/CardFace.vue'
import CardDetail from '../components/CardDetail.vue'
import { CARDS, CATEGORY_LABEL, RARITY_LABEL, RARITY_ORDER, UNIVERSES } from '../engine/catalog'
import { useProfileStore } from '../stores/profile'
import type { Category, Rarity } from '../engine/types'

const store = useProfileStore()

const search = ref('')
const universe = ref('all')
const category = ref<'all' | Category>('all')
const rarity = ref<'all' | Rarity>('all')
const sort = ref<'rarity' | 'name' | 'atk' | 'popularity'>('rarity')
const onlyOwned = ref(true)
const detail = ref<string | null>(null)

const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const list = CARDS.filter((card) => {
    if (onlyOwned.value && store.quantityOf(card.id) <= 0) return false
    if (universe.value !== 'all' && card.universe !== universe.value) return false
    if (category.value !== 'all' && card.category !== category.value) return false
    if (rarity.value !== 'all' && card.rarity !== rarity.value) return false
    if (needle && !`${card.name} ${card.text} ${card.tags.join(' ')}`.toLowerCase().includes(needle)) return false
    return true
  })

  return list.sort((a, b) => {
    if (sort.value === 'name') return a.name.localeCompare(b.name)
    if (sort.value === 'atk') return (b.atk ?? 0) - (a.atk ?? 0)
    if (sort.value === 'popularity') return (b.popularity ?? 0) - (a.popularity ?? 0)
    const rarityDiff = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]
    return rarityDiff !== 0 ? rarityDiff : a.name.localeCompare(b.name)
  })
})

const byCategory = computed(() => {
  const counts = new Map<Category, number>()
  for (const card of CARDS) {
    if (store.quantityOf(card.id) > 0) counts.set(card.category, (counts.get(card.category) ?? 0) + 1)
  }
  return counts
})

const detailCard = computed(() => (detail.value ? CARDS.find((c) => c.id === detail.value) ?? null : null))
</script>

<template>
  <div class="collection">
    <div class="section-title">
      <h1>Collection</h1>
      <span>{{ filtered.length }} cartes affichées · {{ store.uniqueCount }} uniques possédées</span>
    </div>

    <div class="panel" style="margin-bottom: 18px">
      <div class="panel__body filters">
        <div style="flex: 2 1 240px">
          <label class="field-label" for="search">Recherche</label>
          <input id="search" v-model="search" class="input" type="search" placeholder="Nom, texte, tag…" />
        </div>
        <div>
          <label class="field-label" for="universe">Univers</label>
          <select id="universe" v-model="universe" class="select">
            <option value="all">Tous les univers</option>
            <option v-for="u in UNIVERSES" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="category">Catégorie</label>
          <select id="category" v-model="category" class="select">
            <option value="all">Toutes</option>
            <option v-for="(label, key) in CATEGORY_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="rarity">Rareté</label>
          <select id="rarity" v-model="rarity" class="select">
            <option value="all">Toutes</option>
            <option v-for="(label, key) in RARITY_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="sort">Tri</label>
          <select id="sort" v-model="sort" class="select">
            <option value="rarity">Rareté</option>
            <option value="name">Nom</option>
            <option value="atk">ATK</option>
            <option value="popularity">Popularité</option>
          </select>
        </div>
        <label class="toggle">
          <input v-model="onlyOwned" type="checkbox" />
          <span>Possédées uniquement</span>
        </label>
      </div>
    </div>

    <div class="chip-row" style="margin-bottom: 14px">
      <button class="chip" type="button" :class="{ 'chip--gold': category === 'all' }" @click="category = 'all'">
        Toutes
      </button>
      <button
        v-for="(label, key) in CATEGORY_LABEL"
        :key="key"
        class="chip"
        type="button"
        :class="{ 'chip--gold': category === key }"
        @click="category = key"
      >
        {{ label }} · {{ byCategory.get(key) ?? 0 }}
      </button>
    </div>

    <p v-if="!filtered.length" class="panel panel__body hint">
      Aucune carte ne correspond à ces filtres.
    </p>

    <div class="card-grid">
      <CardFace
        v-for="card in filtered"
        :key="card.id"
        :card-id="card.id"
        size="md"
        fluid
        :count="store.quantityOf(card.id)"
        :disabled="store.quantityOf(card.id) <= 0"
        @inspect="(id) => (detail = id)"
        @select="detail = card.id"
      />
    </div>

    <footer class="hint" style="margin-top: 18px">
      {{ store.ownedCount }} exemplaires au total. Collection de démonstration : 3 exemplaires de chaque carte,
      aucune économie active. Les doublons sont conservés, sans crafting ni échange.
    </footer>

    <CardDetail v-if="detailCard" :card-id="detailCard.id" @close="detail = null" />
  </div>
</template>
