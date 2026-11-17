<script setup lang="ts">
import CardFace from './CardFace.vue'
import type { CardInstance } from '../engine/types'
import { CARD_INDEX } from '../engine/catalog'

const props = withDefaults(
  defineProps<{
    inst: CardInstance | null
    label: string
    kind?: 'monster' | 'spell' | 'terrain'
    flashUid?: string | null
    selectedUid?: string | null
    disabled?: boolean
  }>(),
  { kind: 'monster', flashUid: null, selectedUid: null, disabled: false },
)

const emit = defineEmits<{
  select: [uid: string]
  inspect: [cardId: string]
  empty: []
}>()

function select() {
  if (props.inst) emit('select', props.inst.uid)
  else emit('empty')
}
</script>

<template>
  <div class="slot" :class="[`slot--${kind}`, { 'slot--filled': Boolean(inst), 'slot--disabled': disabled }]">
    <CardFace
      v-if="inst"
      :card-id="inst.cardId"
      :face-down="inst.faceDown"
      :position="inst.position"
      size="xs"
      fluid
      :selected="selectedUid === inst.uid"
      :flash="flashUid === inst.uid"
      :face-down-label="inst.faceDown && CARD_INDEX.get(inst.cardId)?.category === 'trap' ? 'Piège posé' : 'Face cachée'"
      @select="select"
      @inspect="(id) => emit('inspect', id)"
    />
    <button v-else class="slot__empty" type="button" :aria-label="`${label} — zone vide`" @click="emit('empty')">
      <span class="slot__gem" aria-hidden="true">◇</span>
      <span class="slot__label">{{ label }}</span>
    </button>
    <slot name="badge" />
  </div>
</template>
