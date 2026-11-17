<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import CardFace from '../components/CardFace.vue'
import { useProfileStore } from '../stores/profile'
import { validateDeck } from '../engine/deck'
import { getCard } from '../engine/catalog'

const store = useProfileStore()
const router = useRouter()

const selectedDeckId = ref(store.activeDeckId || store.decks[0]?.id || '')
const showcase = ['spx-heros-multivers', 'chr-bob', 'chr-bugs']

const selectedDeck = computed(() => store.decks.find((deck) => deck.id === selectedDeckId.value) ?? null)
const selectedValidation = computed(() =>
  selectedDeck.value ? validateDeck(selectedDeck.value.main, selectedDeck.value.extra) : null,
)
const activeDeck = computed(() => store.activeDeck ?? selectedDeck.value)
const activeValidation = computed(() =>
  activeDeck.value ? validateDeck(activeDeck.value.main, activeDeck.value.extra) : null,
)

const showcaseSummonable = computed(() => {
  const extra = activeDeck.value?.extra?.[0]
  return extra ? getCard(extra) : null
})

const recentMatches = computed(() => store.matches.slice(0, 4))

function play() {
  if (!selectedDeck.value) return
  store.setActiveDeck(selectedDeck.value.id)
  router.push('/duel')
}

const tabs = [
  { label: 'Deck', to: '/decks', icon: '▤' },
  { label: 'Règles', to: '/duel', icon: '❧' },
  { label: 'Récompenses', to: '/profil', icon: '❖' },
  { label: 'Amis', to: '/profil', icon: '☺' },
]
</script>

<template>
  <div class="home">
    <section class="home__stage">
      <nav class="home__menu" aria-label="Menu principal">
        <RouterLink to="/" class="home__menu-item">
          <span class="home__menu-icon">⌂</span>Accueil
        </RouterLink>
        <RouterLink to="/collection" class="home__menu-item">
          <span class="home__menu-icon">▦</span>Collection
        </RouterLink>
        <RouterLink to="/decks" class="home__menu-item">
          <span class="home__menu-icon">⌘</span>Decks
        </RouterLink>
        <RouterLink to="/boutique" class="home__menu-item">
          <span class="home__menu-icon">◈</span>Boutique
        </RouterLink>
        <RouterLink to="/campagne" class="home__menu-item">
          <span class="home__menu-icon">❧</span>Campagne
        </RouterLink>
        <RouterLink to="/missions" class="home__menu-item">
          <span class="home__menu-icon">✎</span>Missions
        </RouterLink>
        <RouterLink to="/duel" class="home__menu-item">
          <span class="home__menu-icon">⚔</span>Duel
        </RouterLink>
        <RouterLink to="/profil" class="home__menu-item">
          <span class="home__menu-icon">✦</span>Profil
        </RouterLink>
      </nav>

      <div class="home__center">
        <div class="home__logo" aria-label="Multiverse Cartoon TCG">
          <span class="home__logo-line">MULTIVERSE</span>
          <span class="home__logo-line home__logo-line--gold">CARTOON</span>
          <span class="home__logo-badge">TCG</span>
        </div>

        <div class="home__setup">
          <label class="field-label" for="deck-select">Deck actif</label>
          <select id="deck-select" v-model="selectedDeckId" class="select">
            <option v-for="deck in store.decks" :key="deck.id" :value="deck.id">
              {{ deck.name }} — {{ deck.main.length }} cartes
            </option>
          </select>
          <button class="home__play" type="button" :disabled="!selectedDeck || !selectedValidation?.valid" @click="play">
            <span aria-hidden="true">⚔</span> JOUER
          </button>
        </div>

        <p v-if="selectedValidation && !selectedValidation.valid" class="notice">
          <span>⚠</span>
          <span>
            Deck invalide : {{ selectedValidation.errors[0] }}
            <RouterLink to="/decks" class="notice__link">Ouvrir le Deck Builder</RouterLink>
          </span>
        </p>
        <p v-else-if="!store.decks.length" class="notice">
          <span>⚠</span>
          <span>Aucun deck disponible. Créez-en un dans le Deck Builder.</span>
        </p>

        <p class="home__welcome">Bienvenue sur MULTIVERSE CARTOON TCG !</p>
      </div>

      <div class="home__fan" aria-label="Cartes à la une">
        <CardFace
          v-for="(id, index) in showcase"
          :key="id"
          :card-id="id"
          size="md"
          :style="{ '--i': index }"
          class="home__fan-card"
        />
      </div>
    </section>

    <section class="home__dash">
      <article class="home__tile panel">
        <div class="panel__head">
          <h2>Deck actif</h2>
          <span class="chip" :class="activeValidation?.valid ? 'chip--ok' : 'chip--warn'">
            {{ activeValidation?.valid ? 'Valide' : 'Invalide' }}
          </span>
        </div>
        <div class="panel__body">
          <p class="home__deckname">{{ activeDeck?.name ?? 'Aucun deck' }}</p>
          <div class="home__stats">
            <div class="deckstat"><span>Cartes</span><b>{{ activeDeck?.main.length ?? 0 }}</b></div>
            <div class="deckstat"><span>Extra</span><b>{{ activeDeck?.extra.length ?? 0 }}</b></div>
            <div class="deckstat"><span>Uniques</span><b>{{ new Set(activeDeck?.main ?? []).size }}</b></div>
          </div>
          <RouterLink to="/decks" class="btn btn--sm" style="margin-top: 12px">Ouvrir le Deck Builder</RouterLink>
        </div>
      </article>

      <article class="home__tile panel">
        <div class="panel__head">
          <h2>Derniers duels</h2>
          <span class="chip">{{ store.matches.length }}</span>
        </div>
        <div class="panel__body">
          <p v-if="!recentMatches.length" class="hint">Aucun duel terminé. Lancez votre premier duel !</p>
          <ul v-else class="home__matches">
            <li v-for="match in recentMatches" :key="match.id" class="home__match">
              <span class="home__match-dot" :class="match.result === 'win' ? 'is-win' : 'is-loss'" />
              <span class="home__match-name">{{ match.opponent }}</span>
              <span class="home__match-turns">{{ match.turns }} tours</span>
              <b :class="match.result === 'win' ? 'is-win' : 'is-loss'">{{ match.result === 'win' ? 'V' : 'D' }}</b>
            </li>
          </ul>
          <RouterLink v-if="recentMatches.length" to="/profil" class="btn btn--sm" style="margin-top: 12px">
            Voir l'historique
          </RouterLink>
        </div>
      </article>

      <article class="home__tile panel">
        <div class="panel__head">
          <h2>Invocation à la une</h2>
          <span class="chip chip--gold">Extra Deck</span>
        </div>
        <div class="panel__body home__extra">
          <CardFace v-if="showcaseSummonable" :card-id="showcaseSummonable.id" size="sm" />
          <div v-if="showcaseSummonable" class="home__extra-copy">
            <b>{{ showcaseSummonable.name }}</b>
            <p class="hint">{{ showcaseSummonable.text }}</p>
          </div>
          <p v-else class="hint">Ajoutez une invocation spéciale à votre deck pour la voir ici.</p>
        </div>
      </article>
    </section>

    <nav class="home__tabs" aria-label="Raccourcis">
      <RouterLink v-for="tab in tabs" :key="tab.label" :to="tab.to" class="home__tab">
        <span class="home__tab-icon">{{ tab.icon }}</span>
        {{ tab.label }}
      </RouterLink>
    </nav>
  </div>
</template>
