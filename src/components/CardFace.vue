<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORY_LABEL, RARITY_LABEL, SPECIAL_LABEL, artUrl, getCard, universeOf } from '../engine/catalog'

const props = withDefaults(
  defineProps<{
    cardId: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
    fluid?: boolean
    faceDown?: boolean
    position?: 'attack' | 'defense'
    count?: number
    disabled?: boolean
    selected?: boolean
    flash?: boolean
    faceDownLabel?: string
  }>(),
  {
    size: 'md',
    fluid: false,
    faceDown: false,
    position: 'attack',
    count: 0,
    disabled: false,
    selected: false,
    flash: false,
    faceDownLabel: 'Face cachée',
  },
)

const emit = defineEmits<{
  inspect: [cardId: string]
  select: []
}>()

const card = computed(() => getCard(props.cardId))
const universe = computed(() => universeOf(card.value.universe))
const shortRarity = computed(
  () => ({ common: 'C', rare: 'R', epic: 'E', legendary: 'L', ultra: 'UR' })[card.value.rarity],
)
const typeLabel = computed(() =>
  card.value.category === 'special'
    ? SPECIAL_LABEL[card.value.special?.kind ?? 'crossover']
    : CATEGORY_LABEL[card.value.category],
)
const typeLine = computed(() => {
  const tags = card.value.tags.slice(0, 2)
  return tags.length ? `${typeLabel.value} • ${tags.join(' / ')}` : typeLabel.value
})
const isCharacter = computed(() => card.value.category === 'character')

const tiltX = ref(0)
const tiltY = ref(0)
const glareX = ref(50)
const glareY = ref(50)
const isHovered = ref(false)

function handleMouseMove(e: MouseEvent) {
  // Désactiver le tilt sur les cartes face cachée ou en défense
  if (props.faceDown || props.position === 'defense') return
  const el = e.currentTarget as HTMLElement
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const relX = (x / rect.width) - 0.5
  const relY = (y / rect.height) - 0.5

  tiltX.value = Math.max(-18, Math.min(18, -relY * 32))
  tiltY.value = Math.max(-18, Math.min(18, relX * 32))
  glareX.value = (x / rect.width) * 100
  glareY.value = (y / rect.height) * 100
  isHovered.value = true
}

function handleMouseLeave() {
  tiltX.value = 0
  tiltY.value = 0
  isHovered.value = false
}
</script>

<template>
  <article
    class="card"
    :class="[
      `size-${size}`,
      `rarity-${card.rarity}`,
      `cat-${card.category}`,
      {
        'card--fluid': fluid,
        'card--terrain': card.category === 'terrain',
        'card--facedown': faceDown,
        'card--defense': !faceDown && position === 'defense',
        'card--disabled': disabled,
        'card--selected': selected,
        'card--flash': flash,
        'card--tilted': isHovered,
      },
    ]"
    :style="{
      '--rx': `${tiltX}deg`,
      '--ry': `${tiltY}deg`,
      '--gx': `${glareX}%`,
      '--gy': `${glareY}%`,
    }"
    tabindex="0"
    role="button"
    :aria-label="faceDown ? `${faceDownLabel} — ${typeLabel}` : `${card.name}, ${typeLabel}, rareté ${RARITY_LABEL[card.rarity]}`"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <div v-if="faceDown" class="card__frame">
      <img class="card__back" src="/assets/ui/card-back.svg" alt="" aria-hidden="true" />
      <span class="card__back-label">{{ faceDownLabel }}</span>
    </div>

    <div v-else class="card__frame">
      <!-- Calque de brillance spéculaire dynamique (Glare) -->
      <div class="card__glare" aria-hidden="true" />

      <!-- Calque Holographique Foil pour raretés supérieures -->
      <div
        v-if="card.rarity === 'epic' || card.rarity === 'legendary' || card.rarity === 'ultra'"
        class="card__foil"
        aria-hidden="true"
      />

      <div class="card__top">
        <span
          v-if="isCharacter"
          class="card__cost"
          :title="card.tributes ? `${card.tributes} sacrifice(s) requis` : 'Invocation directe'"
        >
          {{ card.tributes ?? 0 }}
        </span>
        <span class="card__rarity" :title="RARITY_LABEL[card.rarity]">{{ shortRarity }}</span>
      </div>

      <header class="card__head">
        <span class="card__name">{{ card.name }}</span>
        <span class="card__sub">{{ universe.name }}</span>
      </header>

      <div class="card__artwrap">
        <img class="card__art" :src="artUrl(card)" :alt="`Illustration de ${card.name}`" loading="lazy" />
        <div v-if="isCharacter" class="card__pop" title="Popularité (reconnaissance culturelle, pas la puissance)">
          <span>POP.</span>
          <strong>{{ card.popularity }}</strong>
        </div>
        <div v-if="isCharacter && card.tributes" class="card__tribute">⛨ {{ card.tributes }}</div>
      </div>

      <div class="card__type">{{ typeLine }}</div>

      <div class="card__text">{{ card.text }}</div>

      <footer v-if="isCharacter" class="card__stats">
        <span class="pill pill--atk"><i>ATK</i><b>{{ card.atk }}</b></span>
        <span class="pill pill--def"><i>DEF</i><b>{{ card.def }}</b></span>
      </footer>
      <footer v-else class="card__stats card__stats--single">
        <span class="pill pill--neutral">
          <i>{{ card.speed ? 'VITESSE' : card.persistent ? 'CONTINUE' : 'NORMALE' }}</i>
          <b v-if="card.speed">{{ card.speed }}</b>
        </span>
        <span v-if="card.lpCost" class="pill pill--neutral"><i>COÛT</i><b>{{ card.lpCost }} LP</b></span>
      </footer>

      <p v-if="card.signature" class="card__signature">« {{ card.signature }} »</p>
    </div>

    <span v-if="count > 1" class="card__count">×{{ count }}</span>
    <button
      v-if="!faceDown"
      class="card__inspect"
      type="button"
      title="Inspecter la carte"
      aria-label="Inspecter la carte"
      @click.stop="emit('inspect', card.id)"
    >
      i
    </button>
  </article>
</template>
