<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import LoadingScreen from './components/LoadingScreen.vue'
import { useProfileStore } from './stores/profile'
import { useAuthStore } from './stores/auth'
import { useDuelStore } from './stores/duel'
import { isMuted, setMuted } from './lib/audio'

const route = useRoute()
const store = useProfileStore()
const auth = useAuthStore()
const duel = useDuelStore()
const reduceMotion = ref(localStorage.getItem('mv-reduce-motion') === '1')
const soundOn = ref(!isMuted())

// Détecte si un duel est activement en cours pour passer en mode immersif
const isImmersiveDuel = computed(() => {
  return route.path === '/duel' && duel.state !== null && !duel.state.over
})

function toggleSound(): void {
  soundOn.value = !soundOn.value
  setMuted(!soundOn.value)
}

watchEffect(() => {
  document.documentElement.classList.toggle('reduce-motion', reduceMotion.value)
  localStorage.setItem('mv-reduce-motion', reduceMotion.value ? '1' : '0')
})

onMounted(() => {
  void auth.init()
  if (!store.ready) void store.load()
})
</script>

<template>
  <div class="app" :class="{ 'app--duel-mode': isImmersiveDuel }">
    <div class="app__bg" aria-hidden="true" />
    <div class="app__vignette" aria-hidden="true" />

    <header v-if="!isImmersiveDuel" class="hud">
      <RouterLink to="/" class="hud__logo" aria-label="Multiverse Cartoon TCG — accueil">
        <span class="hud__logo-top">MULTIVERSE</span>
        <span class="hud__logo-bottom">CARTOON</span>
        <span class="hud__logo-tcg">TCG</span>
      </RouterLink>

      <div class="hud__player">
        <div class="hud__avatar" aria-hidden="true">
          <img v-if="store.profile.avatar" :src="store.profile.avatar" alt="" class="hud__avatar-img" />
          <span v-else>{{ (auth.isAuthenticated ? auth.username : store.profile.name).slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="hud__ident">
          <div style="display: flex; align-items: center; gap: 8px">
            <b class="hud__name">{{ auth.isAuthenticated ? auth.username : store.profile.name }}</b>
            <span v-if="auth.isAuthenticated" class="badge-online" title="Connecté en ligne">● En ligne</span>
          </div>
          <div class="hud__xp" :title="`${store.profile.xp} XP au total`">
            <span>Niv. {{ store.level }}</span>
            <div class="hud__xpbar"><i :style="{ width: `${store.progress.ratio * 100}%` }" /></div>
            <span>{{ store.progress.into }} / {{ store.progress.needed }}</span>
          </div>
        </div>
      </div>

      <div class="hud__res">
        <span class="hud__res-item hud__res-item--jm" title="Jetons Multivers">
          <i aria-hidden="true">◆</i>{{ store.profile.jm }}
        </span>
        <span class="hud__res-item hud__res-item--cards" title="Cartes possédées">
          <i aria-hidden="true">▦</i>{{ store.ownedCount }}
        </span>
        <span v-if="store.offline" class="hud__res-item hud__res-item--warn" title="API locale indisponible : sauvegarde navigateur">
          Hors ligne
        </span>
      </div>

      <nav class="hud__nav" aria-label="Navigation principale">
        <RouterLink to="/" class="hud__tab" title="Accueil"><i aria-hidden="true">⌂</i><span>Accueil</span></RouterLink>
        <RouterLink to="/collection" class="hud__tab" title="Collection"><i aria-hidden="true">▦</i><span>Collection</span></RouterLink>
        <RouterLink to="/decks" class="hud__tab" title="Deck Builder"><i aria-hidden="true">⌘</i><span>Decks</span></RouterLink>
        <RouterLink to="/boutique" class="hud__tab" title="Boutique"><i aria-hidden="true">◈</i><span>Boutique</span></RouterLink>
        <RouterLink to="/campagne" class="hud__tab" title="Campagne"><i aria-hidden="true">❧</i><span>Campagne</span></RouterLink>
        <RouterLink to="/missions" class="hud__tab" title="Missions"><i aria-hidden="true">✎</i><span>Missions</span></RouterLink>
        <RouterLink to="/duel" class="hud__tab hud__tab--play" title="Duel"><i aria-hidden="true">⚔</i><span>Duel</span></RouterLink>
        <RouterLink to="/profil" class="hud__tab" title="Profil"><i aria-hidden="true">✦</i><span>Profil</span></RouterLink>
        <RouterLink v-if="!auth.isAuthenticated" to="/connexion" class="hud__tab hud__tab--auth" title="Connexion"><i aria-hidden="true">🔑</i><span>Connexion</span></RouterLink>
        <button v-else class="hud__tab hud__tab--logout" type="button" title="Se déconnecter" @click="auth.logout"><i aria-hidden="true">🚪</i><span>Quitter</span></button>
      </nav>

      <button
        class="hud__icon"
        type="button"
        :aria-pressed="soundOn"
        :title="soundOn ? 'Couper les effets sonores' : 'Activer les effets sonores'"
        @click="toggleSound"
      >
        {{ soundOn ? '♪' : '♪̸' }}
      </button>

      <button
        class="hud__icon"
        type="button"
        :aria-pressed="reduceMotion"
        :title="reduceMotion ? 'Réactiver les animations' : 'Réduire les animations'"
        @click="reduceMotion = !reduceMotion"
      >
        {{ reduceMotion ? '▷' : '⏸' }}
      </button>
    </header>

    <!-- Mini-barre de contrôle immersif pendant le duel -->
    <div v-else class="duel-mini-controls" aria-label="Contrôles du duel">
      <div class="duel-mini-brand">
        <span class="brand-spark">⚡</span>
        <span class="brand-title">MULTIVERSE CARTOON TCG</span>
        <span class="brand-pill">COMBAT ACTIF</span>
      </div>
      <div class="duel-mini-actions">
        <button
          class="hud__icon hud__icon--duel"
          type="button"
          :aria-pressed="soundOn"
          :title="soundOn ? 'Couper le son' : 'Activer le son'"
          @click="toggleSound"
        >
          {{ soundOn ? '♪' : '♪̸' }}
        </button>
        <button
          class="hud__icon hud__icon--duel"
          type="button"
          :aria-pressed="reduceMotion"
          :title="reduceMotion ? 'Réactiver les effets cartoon' : 'Réduire les effets'"
          @click="reduceMotion = !reduceMotion"
        >
          {{ reduceMotion ? '▷' : '⏸' }}
        </button>
      </div>
    </div>

    <main class="stage" :class="{ 'stage--duel': isImmersiveDuel }">
      <LoadingScreen v-if="!store.ready" />
      <RouterView v-else />
    </main>
  </div>
</template>
