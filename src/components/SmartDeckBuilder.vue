<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { UNIVERSES, getCard, universeOf } from '../engine/catalog'
import { DECK_MAX, DECK_MIN } from '../engine/deck'
import {
  generateSmartDeck,
  type SmartArchetype,
  type SmartDeckResult,
} from '../engine/smartDeck'
import { useProfileStore } from '../stores/profile'

const props = defineProps<{
  initialUniverse?: string
}>()

const emit = defineEmits<{
  apply: [deck: { name: string; main: string[]; extra: string[] }]
  close: []
}>()

const store = useProfileStore()

const archetype = ref<SmartArchetype>('optimal')
const chosenUniverse = ref<string>(props.initialUniverse || '')
const targetSize = ref<number>(44)
const isGenerating = ref(false)
const result = ref<SmartDeckResult | null>(null)

const ARCHETYPES: Array<{
  id: SmartArchetype
  label: string
  icon: string
  desc: string
}> = [
  { id: 'optimal', label: 'Optimale', icon: '✦', desc: 'Meilleure synergie générale' },
  { id: 'aggro', label: 'Assaut', icon: '⚔', desc: 'Attaque & pression rapide' },
  { id: 'control', label: 'Contrôle', icon: '🛡', desc: 'Défense, pièges & neutralisation' },
  { id: 'resonance', label: 'Résonance', icon: '🌀', desc: 'Tags partagés & combos' },
  { id: 'themed', label: 'Thématique', icon: '👑', desc: 'Focalisé sur un seul univers' },
]

function runGeneration() {
  isGenerating.value = true
  // Petit délai pour un retour visuel satisfaisant
  window.setTimeout(() => {
    result.value = generateSmartDeck({
      owned: store.collection,
      archetype: archetype.value,
      preferredUniverse: chosenUniverse.value || undefined,
      targetSize: targetSize.value,
      seed: Math.floor(Math.random() * 100000),
    })
    isGenerating.value = false
  }, 220)
}

function applyToEditor() {
  if (!result.value) return
  emit('apply', {
    name: result.value.deck.name,
    main: result.value.deck.main,
    extra: result.value.deck.extra,
  })
}

// Générer automatiquement une première proposition à l'ouverture
onMounted(() => {
  runGeneration()
})

const previewCards = computed(() => {
  if (!result.value) return []
  // Compter les occurrences pour un affichage synthétique
  const counts = new Map<string, number>()
  for (const id of result.value.deck.main) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()].slice(0, 8).map(([id, count]) => ({
    card: getCard(id),
    count,
  }))
})
</script>

<template>
  <div class="smart-deck-builder panel">
    <div class="panel__head smart-deck-builder__head">
      <div style="display: flex; align-items: center; gap: 8px">
        <span class="smart-deck-builder__sparkle">✨</span>
        <h2>Concepteur de Deck Intelligent</h2>
      </div>
      <span class="chip chip--gold">Synergies & Affinités IA</span>
      <button
        class="icon-btn"
        type="button"
        title="Fermer le concepteur"
        style="margin-left: auto"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div class="panel__body smart-deck-builder__body">
      <!-- Options de conception -->
      <section class="smart-deck-builder__config">
        <label class="field-label">Stratégie & Style de jeu</label>
        <div class="smart-deck-builder__archetypes">
          <button
            v-for="arch in ARCHETYPES"
            :key="arch.id"
            type="button"
            class="smart-deck-builder__archetype-btn"
            :class="{ 'is-active': archetype === arch.id }"
            @click="archetype = arch.id"
          >
            <span class="smart-deck-builder__arch-icon">{{ arch.icon }}</span>
            <b>{{ arch.label }}</b>
            <small>{{ arch.desc }}</small>
          </button>
        </div>

        <div class="filters" style="margin-top: 14px">
          <div>
            <label class="field-label" for="smart-universe">Univers préféré (affinité thématique)</label>
            <select id="smart-universe" v-model="chosenUniverse" class="select">
              <option value="">⚡ Déduction automatique par l'IA</option>
              <option v-for="u in UNIVERSES" :key="u.id" :value="u.id">
                {{ u.glyph }} {{ u.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="field-label" for="smart-size">
              Taille visée ({{ targetSize }} cartes)
            </label>
            <div style="display: flex; align-items: center; gap: 10px">
              <input
                id="smart-size"
                v-model.number="targetSize"
                type="range"
                :min="DECK_MIN"
                :max="DECK_MAX"
                step="2"
                style="flex: 1; accent-color: var(--gold)"
              />
              <span class="chip">{{ targetSize }} cartes</span>
            </div>
          </div>

          <div style="align-self: flex-end">
            <button
              class="btn btn--gold btn--block"
              type="button"
              :disabled="isGenerating"
              @click="runGeneration"
            >
              <span v-if="isGenerating">Génération…</span>
              <span v-else>↻ Concevoir le deck</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Résultat de la génération -->
      <section v-if="result" class="smart-deck-builder__result">
        <div class="smart-deck-builder__score-banner">
          <!-- Jauge circulaire du score global -->
          <div class="smart-deck-builder__gauge-wrap">
            <svg class="smart-deck-builder__gauge" viewBox="0 0 100 100">
              <circle
                class="smart-deck-builder__gauge-bg"
                cx="50"
                cy="50"
                r="40"
              />
              <circle
                class="smart-deck-builder__gauge-fill"
                cx="50"
                cy="50"
                r="40"
                :style="{
                  strokeDashoffset: 251.2 - (251.2 * result.report.synergy.overallScore) / 100,
                }"
              />
            </svg>
            <div class="smart-deck-builder__gauge-text">
              <strong>{{ result.report.synergy.overallScore }}%</strong>
              <small>Synergie</small>
            </div>
          </div>

          <!-- Description et univers dominant -->
          <div style="flex: 1; min-width: 220px">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
              <h3 style="font-size: 18px; color: var(--gold-bright)">
                {{ result.report.name }}
              </h3>
              <span class="chip chip--gold">
                {{ result.report.dominantUniverseGlyph }} {{ result.report.dominantUniverseName }}
              </span>
            </div>
            <p class="hint" style="margin: 6px 0 10px; line-height: 1.45">
              {{ result.report.strategyDescription }}
            </p>

            <!-- Tags clés -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center">
              <span class="field-label" style="margin: 0; font-size: 10px">Tags clés :</span>
              <span
                v-for="t in result.report.topTags"
                :key="t.tag"
                class="tag tag--gold"
              >
                #{{ t.tag }} ({{ t.count }})
              </span>
            </div>
          </div>

          <!-- Bouton appliquer -->
          <div style="display: flex; flex-direction: column; gap: 8px; justify-content: center">
            <button
              class="btn btn--gold btn--neon"
              type="button"
              @click="applyToEditor"
            >
              ✓ Charger ce deck dans l'éditeur
            </button>
            <span v-if="result.valid" class="chip chip--ok" style="justify-content: center">
              ✓ Conforme aux règles de duel
            </span>
            <span v-else class="chip chip--warn" style="justify-content: center">
              ⚠ Ajustements nécessaires
            </span>
          </div>
        </div>

        <!-- 4 Barres d'affinité détaillées -->
        <div class="smart-deck-builder__bars">
          <div class="smart-deck-builder__bar-card">
            <div class="smart-deck-builder__bar-head">
              <span>Affinité Univers</span>
              <b>{{ result.report.synergy.universeAffinity }}%</b>
            </div>
            <div class="xpbar">
              <div
                class="xpbar__fill"
                :style="{ width: `${result.report.synergy.universeAffinity}%` }"
              />
            </div>
            <small class="hint">Cohérence thématique {{ result.report.dominantUniverseName }}</small>
          </div>

          <div class="smart-deck-builder__bar-card">
            <div class="smart-deck-builder__bar-head">
              <span>Résonance de Tags</span>
              <b>{{ result.report.synergy.tagResonance }}%</b>
            </div>
            <div class="xpbar">
              <div
                class="xpbar__fill"
                style="background: linear-gradient(90deg, #a78bfa, #c084fc)"
                :style="{ width: `${result.report.synergy.tagResonance}%` }"
              />
            </div>
            <small class="hint">Effets partagés entre cartes</small>
          </div>

          <div class="smart-deck-builder__bar-card">
            <div class="smart-deck-builder__bar-head">
              <span>Équilibre Tactique</span>
              <b>{{ result.report.synergy.tacticalBalance }}%</b>
            </div>
            <div class="xpbar">
              <div
                class="xpbar__fill"
                style="background: linear-gradient(90deg, #5ee0a0, #22c55e)"
                :style="{ width: `${result.report.synergy.tacticalBalance}%` }"
              />
            </div>
            <small class="hint">Courbe d'invocation T1 & protection</small>
          </div>

          <div class="smart-deck-builder__bar-card">
            <div class="smart-deck-builder__bar-head">
              <span>Puissance Offensive</span>
              <b>{{ result.report.synergy.combatPower }}%</b>
            </div>
            <div class="xpbar">
              <div
                class="xpbar__fill"
                style="background: linear-gradient(90deg, #ff7ab6, #ff4d6d)"
                :style="{ width: `${result.report.synergy.combatPower}%` }"
              />
            </div>
            <small class="hint">Moyenne d'ATK et capacités de combat</small>
          </div>
        </div>

        <!-- Répartition et points forts -->
        <div class="smart-deck-builder__details-grid">
          <div class="panel" style="background: rgba(10, 14, 32, 0.6)">
            <div class="panel__head"><h3>Composition du deck</h3></div>
            <div class="panel__body">
              <div class="smart-deck-builder__counts">
                <div class="deckstat">
                  <span>Monstres T1 (0 sac.)</span>
                  <b>{{ result.report.mainCounts.zeroTributeCharacters }}</b>
                </div>
                <div class="deckstat">
                  <span>Boss (sacrifices)</span>
                  <b>{{ result.report.mainCounts.tributeCharacters }}</b>
                </div>
                <div class="deckstat">
                  <span>Sorts / Tech.</span>
                  <b>{{ result.report.mainCounts.spells }}</b>
                </div>
                <div class="deckstat">
                  <span>Pièges</span>
                  <b>{{ result.report.mainCounts.traps }}</b>
                </div>
                <div class="deckstat">
                  <span>Terrain</span>
                  <b>{{ result.report.mainCounts.terrains }}</b>
                </div>
                <div class="deckstat">
                  <span>Extra Deck</span>
                  <b>{{ result.report.extraCount }}</b>
                </div>
              </div>
            </div>
          </div>

          <div class="panel" style="background: rgba(10, 14, 32, 0.6)">
            <div class="panel__head"><h3>Points forts & Synergies</h3></div>
            <div class="panel__body">
              <ul class="checklist">
                <li v-for="str in result.report.strengths" :key="str">{{ str }}</li>
              </ul>
              <div v-if="result.report.warnings.length" style="margin-top: 10px">
                <div
                  v-for="w in result.report.warnings"
                  :key="w"
                  class="notice notice--error"
                  style="margin-bottom: 6px"
                >
                  <span>⚠</span><span>{{ w }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Aperçu rapide des cartes clés -->
        <div class="smart-deck-builder__preview-wrap">
          <span class="field-label">Aperçu d'extraits de cartes clés :</span>
          <div class="smart-deck-builder__cards-pill-list">
            <span
              v-for="item in previewCards"
              :key="item.card.id"
              class="smart-deck-builder__card-pill"
              :class="`rarity-${item.card.rarity}`"
            >
              <b>×{{ item.count }}</b>
              <span>{{ item.card.name }}</span>
              <small>{{ item.card.category === 'character' ? `${item.card.atk}/${item.card.def}` : item.card.category }}</small>
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.smart-deck-builder {
  margin-bottom: 20px;
  border: 1px solid rgba(230, 195, 119, 0.45);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 0 30px rgba(230, 195, 119, 0.12);
  animation: screenIn 0.35s ease both;
}

.smart-deck-builder__sparkle {
  font-size: 20px;
  animation: sparkle 2s ease-in-out infinite;
}

.smart-deck-builder__archetypes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 6px;
}

.smart-deck-builder__archetype-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  cursor: pointer;
  transition: transform 0.2s var(--ease-spring), border-color 0.2s ease, background 0.2s ease;
}

.smart-deck-builder__archetype-btn:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  background: rgba(230, 195, 119, 0.08);
}

.smart-deck-builder__archetype-btn.is-active {
  border-color: var(--gold-bright);
  background: linear-gradient(160deg, rgba(230, 195, 119, 0.22), rgba(20, 25, 52, 0.8));
  box-shadow: 0 0 18px rgba(230, 195, 119, 0.25);
  transform: translateY(-2px);
}

.smart-deck-builder__arch-icon {
  font-size: 20px;
  color: var(--gold-bright);
}

.smart-deck-builder__archetype-btn b {
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 0.02em;
}

.smart-deck-builder__archetype-btn small {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.25;
}

.smart-deck-builder__result {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px dashed rgba(150, 170, 255, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.smart-deck-builder__score-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid rgba(230, 195, 119, 0.35);
  background: linear-gradient(135deg, rgba(30, 36, 75, 0.7), rgba(12, 16, 36, 0.95));
  flex-wrap: wrap;
}

.smart-deck-builder__gauge-wrap {
  position: relative;
  width: 82px;
  height: 82px;
  flex: 0 0 auto;
}

.smart-deck-builder__gauge {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.smart-deck-builder__gauge-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 8;
}

.smart-deck-builder__gauge-fill {
  fill: none;
  stroke: var(--gold);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 251.2;
  transition: stroke-dashoffset 0.8s var(--ease-out-expo);
  filter: drop-shadow(0 0 6px rgba(230, 195, 119, 0.6));
}

.smart-deck-builder__gauge-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.smart-deck-builder__gauge-text strong {
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1;
  color: var(--gold-bright);
}

.smart-deck-builder__gauge-text small {
  font-size: 8.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 2px;
}

.smart-deck-builder__bars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.smart-deck-builder__bar-card {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.025);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.smart-deck-builder__bar-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.smart-deck-builder__bar-head b {
  color: var(--gold-bright);
  font-family: var(--font-display);
  font-size: 13px;
}

.smart-deck-builder__details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.smart-deck-builder__counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.smart-deck-builder__cards-pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.smart-deck-builder__card-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.035);
  font-size: 12px;
}

.smart-deck-builder__card-pill b {
  color: var(--gold-bright);
}

.smart-deck-builder__card-pill small {
  font-size: 10px;
  color: var(--muted);
}
</style>
