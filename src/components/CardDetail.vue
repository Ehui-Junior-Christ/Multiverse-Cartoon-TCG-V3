<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import CardFace from './CardFace.vue'
import { CATEGORY_LABEL, RARITY_LABEL, SPECIAL_LABEL, getCard, universeOf } from '../engine/catalog'
import { KEYWORD_LABEL } from '../engine/duel'

const props = defineProps<{ cardId: string }>()
const emit = defineEmits<{ close: [] }>()

const card = computed(() => getCard(props.cardId))
const universe = computed(() => universeOf(card.value.universe))
const typeLabel = computed(() =>
  card.value.category === 'special'
    ? `Invocation spéciale — ${SPECIAL_LABEL[card.value.special?.kind ?? 'crossover']}`
    : CATEGORY_LABEL[card.value.category],
)
const keywords = computed(() => card.value.keywords ?? [])

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="modal" role="dialog" aria-modal="true" :aria-label="card.name" @click.self="emit('close')">
    <div class="modal__panel">
      <button class="modal__close" type="button" aria-label="Fermer" @click="emit('close')">✕</button>

      <CardFace :card-id="card.id" size="lg" />

      <div class="modal__info">
        <div>
          <span class="chip chip--gold">{{ RARITY_LABEL[card.rarity] }}</span>
          <h2>{{ card.name }}</h2>
          <p class="hint">
            {{ universe.glyph }} {{ universe.name }} · {{ typeLabel }}
          </p>
        </div>

        <div>
          <div v-if="card.category === 'character'" class="kv">
            <span>Popularité</span><strong>{{ card.popularity }} / 12</strong>
          </div>
          <div v-if="card.category === 'character'" class="kv">
            <span>ATK</span><strong style="color: var(--atk)">{{ card.atk }}</strong>
          </div>
          <div v-if="card.category === 'character'" class="kv">
            <span>DEF</span><strong style="color: var(--def)">{{ card.def }}</strong>
          </div>
          <div v-if="card.tributes" class="kv">
            <span>Sacrifices requis</span><strong>{{ card.tributes }}</strong>
          </div>
          <div v-if="card.speed" class="kv">
            <span>Vitesse de chaîne</span><strong>{{ card.speed }}</strong>
          </div>
          <div v-if="card.lpCost" class="kv">
            <span>Coût</span><strong>{{ card.lpCost }} LP</strong>
          </div>
          <div v-if="card.persistent" class="kv">
            <span>Placement</span><strong>{{ card.category === 'terrain' ? 'Zone Terrain' : 'Zone Magie/Piège' }}</strong>
          </div>
          <div v-if="card.special" class="kv">
            <span>Mécanique</span><strong>{{ SPECIAL_LABEL[card.special.kind] }}</strong>
          </div>
          <div v-if="card.special" class="kv">
            <span>Conditions</span><strong>{{ card.special.requires.count }} matériau(x)</strong>
          </div>
        </div>

        <div>
          <span class="field-label">Texte de règles</span>
          <p class="hint" style="font-size: 13px; color: #e4e9ff">{{ card.text }}</p>
        </div>

        <div v-if="card.signature">
          <span class="field-label">Phrase signature</span>
          <p class="hint" style="font-style: italic">« {{ card.signature }} »</p>
        </div>

        <div v-if="keywords.length">
          <span class="field-label">Capacités</span>
          <div class="taglist">
            <span v-for="keyword in keywords" :key="keyword" class="tag tag--gold">
              {{ KEYWORD_LABEL[keyword] }}
            </span>
          </div>
        </div>

        <div v-if="card.tags.length">
          <span class="field-label">Tags (compatibilité Résonance)</span>
          <div class="taglist">
            <span v-for="tag in card.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>

        <p class="hint" style="margin-top: auto">
          Popularité = reconnaissance culturelle. Elle n'indique pas la force au combat et n'est pas un « niveau ».
        </p>
      </div>
    </div>
  </div>
</template>
