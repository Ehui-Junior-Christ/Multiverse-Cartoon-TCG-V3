<script setup lang="ts">
import { onMounted, ref } from 'vue'

defineProps<{ label?: string }>()

const tips = [
  "Utilise les 5 systèmes d'invocation pour surprendre ton adversaire !",
  'Un deck valide contient entre 44 et 64 cartes, avec 3 exemplaires maximum par carte.',
  'Le duel commence à 10 000 LP : aucune énergie, aucune mana.',
  'La Popularité mesure la reconnaissance culturelle, pas la puissance au combat.',
  'Les pièges posés face cachée peuvent être activés pendant le tour adverse.',
]

const tip = tips[Math.floor(Math.random() * tips.length)]
const progress = ref(0)
const ready = ref(false)

onMounted(() => {
  const timer = window.setInterval(() => {
    progress.value = Math.min(96, progress.value + 6)
  }, 90)
  window.setTimeout(() => {
    window.clearInterval(timer)
    progress.value = 100
    ready.value = true
  }, 1500)
})
</script>

<template>
  <div class="loader" role="status" aria-live="polite">
    <div class="loader__sky" aria-hidden="true">
      <span class="loader__star" v-for="n in 18" :key="n" :style="{ '--n': n }" />
      <span class="loader__ring" />
    </div>

    <div class="loader__content">
      <div class="loader__logo">
        <span class="loader__logo-line">MULTIVERSE</span>
        <span class="loader__logo-line loader__logo-line--gold">CARTOON</span>
        <span class="loader__logo-badge">TCG</span>
      </div>

      <p class="loader__label">{{ label ?? 'Chargement…' }}</p>

      <div class="loader__bar">
        <span class="loader__star-icon" aria-hidden="true">★</span>
        <div class="loader__track">
          <div class="loader__fill" :style="{ width: `${progress}%` }" />
        </div>
        <b class="loader__pct">{{ progress }}%</b>
      </div>

      <div class="loader__tip">
        <span class="loader__bulb" aria-hidden="true">💡</span>
        <p><b>Astuce :</b> {{ tip }}</p>
      </div>
    </div>
  </div>
</template>
