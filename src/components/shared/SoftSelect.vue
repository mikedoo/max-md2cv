<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'SoftSelect',
})

const props = withDefaults(defineProps<{
  centered?: boolean
  disabled?: boolean
  modelValue?: string | number | boolean
  placeholder?: string
  popperClass?: string
  width?: string
}>(), {
  centered: false,
  disabled: false,
  modelValue: undefined,
  placeholder: '',
  popperClass: '',
  width: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | number | boolean | undefined): void
}>()

const mergedPopperClass = computed(() =>
  ['soft-select-dropdown', props.popperClass].filter(Boolean).join(' '),
)

const selectStyle = computed(() => (props.width ? { width: props.width } : undefined))
</script>

<template>
  <el-select
    :model-value="modelValue"
    size="small"
    :placeholder="placeholder"
    :disabled="disabled"
    :popper-class="mergedPopperClass"
    class="soft-select"
    :class="{ 'soft-select--centered': centered }"
    :style="selectStyle"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="$slots.label" #label="slotProps">
      <slot name="label" v-bind="slotProps" />
    </template>

    <slot />
  </el-select>
</template>

<style scoped>
.soft-select :deep(.el-select__wrapper) {
  min-height: 2.25rem;
  border-radius: 999px;
  padding-inline: 0.75rem 0.625rem;
  background-color: color-mix(in srgb, var(--color-surface-container-lowest) 92%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline-variant) 22%, transparent);
  transition: background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.soft-select:hover :deep(.el-select__wrapper),
.soft-select.is-focus :deep(.el-select__wrapper) {
  background-color: var(--color-surface-container-high);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.soft-select :deep(.el-select__selected-item),
.soft-select :deep(.el-select__placeholder) {
  min-width: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.soft-select--centered :deep(.el-select__selected-item),
.soft-select--centered :deep(.el-select__placeholder) {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  text-overflow: clip;
}

.soft-select--centered :deep(.el-select__wrapper) {
  padding-inline: 0.625rem 0.4rem;
}

.soft-select--centered :deep(.el-select__selection) {
  min-width: 0;
}

.soft-select--centered :deep(.el-select__selected-item) {
  padding-inline-end: 0;
}

.soft-select :deep(.el-select__caret) {
  font-size: 1rem;
  color: color-mix(in srgb, var(--color-on-surface-variant) 72%, white);
}
</style>
