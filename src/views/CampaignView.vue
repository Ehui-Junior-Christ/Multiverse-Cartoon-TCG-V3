<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CAMPAIGN } from '../data/campaign'
import { useDuelStore } from '../stores/duel'
import { DIFFICULTY_LABEL } from '../engine/ai'

const router = useRouter()
const duel = useDuelStore()

const DONE_KEY = 'mv-campaign-done'
const done = ref<string[]>(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[])

const progress = computed(() => `${done.value.length} / ${CAMPAIGN.length}`)

function isDone(id: string): boolean {
  return done.value.includes(id)
}

function play(id: string): void {
  const mission = CAMPAIGN.find((entry) => entry.id === id)
  if (!mission) return
  localStorage.setItem('mv-campaign-pending', mission.id)
  localStorage.setItem('mv-campaign-reward', String(mission.reward))
  const started = duel.start('player', mission.difficulty, {
    name: mission.deck.name,
    main: mission.deck.main,
    extra: mission.deck.extra,
  }, 'friendly')
  if (!started) {
    localStorage.removeItem('mv-campaign-pending')
    localStorage.removeItem('mv-campaign-reward')
    return
  }
  router.push('/duel')
}
</script>

<template>
  <div class="campaign">
    <div class="section-title">
      <h1>Campagne</h1>
      <span>{{ progress }} missions terminées · récompenses en Jetons Multivers</span>
    </div>

    <p class="hint">
      Chaque mission lance un duel contre un deck thématique. La difficulté augmente à chaque
      chapitre. Terminer une mission crédite les Jetons Multivers annoncés.
    </p>

    <section class="campaign__list">
      <article v-for="mission in CAMPAIGN" :key="mission.id" class="campaign__mission panel" :class="{ 'campaign__mission--done': isDone(mission.id) }">
        <div class="panel__head">
          <h2>Chapitre {{ mission.chapter }} · {{ mission.title }}</h2>
          <span class="chip" :class="isDone(mission.id) ? 'chip--ok' : 'chip--gold'">
            {{ isDone(mission.id) ? 'Terminée' : '+ ' + mission.reward + ' JM' }}
          </span>
        </div>
        <div class="panel__body">
          <p class="campaign__subtitle">{{ mission.subtitle }}</p>
          <p class="hint">{{ mission.briefing }}</p>
          <div class="campaign__meta">
            <span class="chip">Difficulté : {{ DIFFICULTY_LABEL[mission.difficulty] }}</span>
            <span class="chip">{{ mission.deck.name }} · {{ mission.deck.main.length }} cartes</span>
          </div>
          <button class="btn btn--gold" type="button" @click="play(mission.id)">
            ⚔ Combattre
          </button>
        </div>
      </article>
    </section>

    <p class="hint">
      Le résultat du duel est enregistré dans l'historique comme un duel classique. La progression
      de campagne est locale à ce navigateur.
    </p>
  </div>
</template>
