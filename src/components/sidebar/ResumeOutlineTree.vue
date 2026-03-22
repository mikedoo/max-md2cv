<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import type { ResumeOutlineNode } from '../../utils/markdownOutline'

defineOptions({
  name: 'ResumeOutlineTree',
})

const props = defineProps<{
  nodes: ResumeOutlineNode[]
  parentId: string | null
  depth: number
}>()

const emit = defineEmits<{
  jump: [nodeId: string]
  reorder: [payload: { nodeId: string; targetIndex: number; parentId: string | null }]
}>()

const localNodes = ref<ResumeOutlineNode[]>([])
const containerRef = ref<HTMLElement | null>(null)

watch(
  () => props.nodes,
  (nodes) => {
    localNodes.value = [...nodes]
  },
  { immediate: true },
)

const handleEnd = (event: { oldIndex?: number; newIndex?: number }) => {
  if (
    event.oldIndex === undefined ||
    event.newIndex === undefined ||
    event.oldIndex === event.newIndex
  ) {
    return
  }

  const movedNode = localNodes.value[event.newIndex]
  if (!movedNode) {
    return
  }

  emit('reorder', {
    nodeId: movedNode.id,
    targetIndex: event.newIndex,
    parentId: props.parentId,
  })
}

const handleJump = (nodeId: string) => {
  emit('jump', nodeId)
}

useDraggable(containerRef, localNodes, {
  animation: 180,
  handle: '.outline-drag-handle',
  group: {
    name: `outline-${props.parentId ?? 'root'}`,
    pull: false,
    put: false,
  },
  ghostClass: 'outline-sortable-ghost',
  dragClass: 'outline-sortable-drag',
  chosenClass: 'outline-sortable-chosen',
  onEnd(event) {
    handleEnd(event)
  },
})
</script>

<template>
  <ul ref="containerRef" class="space-y-2">
    <li v-for="node in localNodes" :key="node.id" class="outline-sortable-item list-none space-y-2">
      <div
        class="flex items-center gap-2"
        :style="{ paddingLeft: `${props.depth * 14}px` }"
      >
        <button
          type="button"
          class="outline-drag-handle"
          :title="`拖动排序 ${node.title}`"
          @click.stop
        >
          <span class="material-symbols-outlined text-[18px]">drag_indicator</span>
        </button>

        <button
          type="button"
          class="outline-row min-w-0 flex-1"
          :class="{
            'outline-row--level2': node.level === 2,
            'text-[15px] font-semibold text-on-surface': node.level === 2,
            'font-medium text-on-surface': node.level === 3,
            'text-on-surface-variant': node.level === 4,
          }"
          @click="handleJump(node.id)"
        >
          <span class="truncate">{{ node.title }}</span>
        </button>
      </div>

      <ResumeOutlineTree
        v-if="node.children.length > 0"
        :nodes="node.children"
        :parent-id="node.id"
        :depth="props.depth + 1"
        @jump="emit('jump', $event)"
        @reorder="emit('reorder', $event)"
      />
    </li>
  </ul>
</template>
