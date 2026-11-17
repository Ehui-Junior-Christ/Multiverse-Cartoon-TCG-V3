<script setup lang="ts">
import { computed, ref } from 'vue'
import { canClaim, missionValue, missionsFor, periodKey } from '../engine/missions'
import { useProfileStore } from '../stores/profile'

const store = useProfileStore()
const message = ref<string | null>(null)

const dailyMissions = computed(() => missionsFor('daily'))
const weeklyMissions = computed(() => missionsFor('weekly'))
const dailyKey = computed(() => periodKey('daily'))
const weeklyKey = computed(() => periodKey('weekly'))

function progressOf(scope: 'daily' | 'weekly', missionId: string) {
  const defs = scope === 'daily' ? dailyMissions.value : weeklyMissions.value
  const mission = defs.find((entry) => entry.id === missionId)
  if (!mission) return { value: 0, goal: 1, ratio: 0 }
  const progress = scope === 'daily' ? store.daily : store.weekly
  const value = missionValue(progress, mission)
  return { value, goal: mission.goal, ratio: mission.goal === 0 ? 1 : value / mission.goal }
}

function claimable(scope: 'daily' | 'weekly', missionId: string): boolean {
  const defs = scope === 'daily' ? dailyMissions.value : weeklyMissions.value
  const mission = defs.find((entry) => entry.id === missionId)
  if (!mission) return false
  return canClaim(scope === 'daily' ? store.daily : store.weekly, mission)
}

function claimed(scope: 'daily' | 'weekly', missionId: string): boolean {
  const progress = scope === 'daily' ? store.daily : store.weekly
  return progress.claimed.includes(missionId)
}

function claim(scope: 'daily' | 'weekly', missionId: string) {
  const reward = store.claimMission(missionId)
  message.value = reward > 0 ? `+${reward} JM récupérés !` : 'Mission non réclamable.'
  window.setTimeout(() => (message.value = null), 2400)
}
</script>

<template>
  <div class="missions">
    <div class="section-title">
      <h1>Missions</h1>
      <span>Quotidiennes et hebdomadaires · récompenses en Jetons Multivers</span>
    </div>

    <p v-if="message" class="notice notice--ok"><span>✔</span><span>{{ message }}</span></p>

    <section class="missions__block panel">
      <div class="panel__head">
        <h2>Quotidiennes</h2>
        <span class="chip">Renouvellement : {{ dailyKey }}</span>
      </div>
      <div class="panel__body missions__list">
        <article v-for="mission in dailyMissions" :key="mission.id" class="mission">
          <div class="mission__head">
            <strong>{{ mission.title }}</strong>
            <span class="chip chip--gold">+{{ mission.reward }} JM</span>
          </div>
          <p class="hint">{{ mission.description }}</p>
          <div class="mission__bar">
            <div class="mission__fill" :style="{ width: `${progressOf('daily', mission.id).ratio * 100}%` }" />
          </div>
          <div class="mission__foot">
            <span class="hint">
              {{ progressOf('daily', mission.id).value }} / {{ mission.goal }}
            </span>
            <button
              class="btn btn--sm"
              :class="{ 'btn--gold': claimable('daily', mission.id) }"
              type="button"
              :disabled="!claimable('daily', mission.id)"
              @click="claim('daily', mission.id)"
            >
              {{ claimed('daily', mission.id) ? 'Réclamée' : claimable('daily', mission.id) ? 'Réclamer' : 'En cours' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="missions__block panel">
      <div class="panel__head">
        <h2>Hebdomadaires</h2>
        <span class="chip">Semaine : {{ weeklyKey }}</span>
      </div>
      <div class="panel__body missions__list">
        <article v-for="mission in weeklyMissions" :key="mission.id" class="mission">
          <div class="mission__head">
            <strong>{{ mission.title }}</strong>
            <span class="chip chip--gold">+{{ mission.reward }} JM</span>
          </div>
          <p class="hint">{{ mission.description }}</p>
          <div class="mission__bar">
            <div class="mission__fill" :style="{ width: `${progressOf('weekly', mission.id).ratio * 100}%` }" />
          </div>
          <div class="mission__foot">
            <span class="hint">
              {{ progressOf('weekly', mission.id).value }} / {{ mission.goal }}
            </span>
            <button
              class="btn btn--sm"
              :class="{ 'btn--gold': claimable('weekly', mission.id) }"
              type="button"
              :disabled="!claimable('weekly', mission.id)"
              @click="claim('weekly', mission.id)"
            >
              {{ claimed('weekly', mission.id) ? 'Réclamée' : claimable('weekly', mission.id) ? 'Réclamer' : 'En cours' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <p class="hint">
      La progression se met à jour en terminant des duels, en gagnant, en ouvrant des boosters et
      en réalisant des invocations spéciales. Les compteurs repartent à zéro chaque jour / semaine.
    </p>
  </div>
</template>
