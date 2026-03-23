<script setup lang="ts">
import { ref, watch } from 'vue'
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
const draggingNodeId = ref<string | null>(null)
const dropTarget = ref<{ nodeId: string; insertAfter: boolean } | null>(null)

const LEVEL2_SECTION_ICON_RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /(教育(?:经历|背景)?|学习经历|学历背景|学历)/, emoji: '🎓' },
  { pattern: /(个人(?:评价|优势|亮点|总结|简介)|自我(?:评价|介绍)|个人画像)/, emoji: '✨' },
  { pattern: /((?:工作|实习|实践|职业|任职)(?:经历|经验)?)/, emoji: '💼' },
  { pattern: /(项目(?:经历|经验|实践)?|项目案例)/, emoji: '🚀' },
  { pattern: /(校园(?:经历|实践|活动)?|校内(?:经历|实践|活动)?|学生工作|社团经历)/, emoji: '🏫' },
  { pattern: /(其他(?:经历|经验|信息)?|补充(?:经历|信息)?|附加(?:经历|信息)?)/, emoji: '🗂️' },
  { pattern: /(技能(?:特长|清单|概览)?|专业技能|核心技能|技术栈|能力清单)/, emoji: '🛠️' },
  { pattern: /(爱好|兴趣爱好|兴趣特长)/, emoji: '🎨' },
  { pattern: /(经历|经验)/, emoji: '🧭' },
]

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

  // localNodes is still in the pre-drop order here, so oldIndex points at the dragged node.
  const movedNode = localNodes.value[event.oldIndex]
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

const clearDragState = () => {
  draggingNodeId.value = null
  dropTarget.value = null
}

const handleDragStart = (nodeId: string, event: DragEvent) => {
  draggingNodeId.value = nodeId
  dropTarget.value = null

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', nodeId)
  }
}

const markAsDropTarget = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDragEnter = (targetNodeId: string, event: DragEvent) => {
  if (!draggingNodeId.value || draggingNodeId.value === targetNodeId) {
    return
  }

  markAsDropTarget(event)
}

const handleDragOver = (targetNodeId: string, event: DragEvent) => {
  if (!draggingNodeId.value || draggingNodeId.value === targetNodeId) {
    return
  }

  markAsDropTarget(event)

  const currentTarget = event.currentTarget as HTMLElement | null
  if (!currentTarget) {
    return
  }

  const rect = currentTarget.getBoundingClientRect()
  const insertAfter = event.clientY > rect.top + rect.height / 2

  dropTarget.value = {
    nodeId: targetNodeId,
    insertAfter,
  }
}

const handleDrop = (targetNodeId: string, event: DragEvent) => {
  if (!draggingNodeId.value || draggingNodeId.value === targetNodeId) {
    clearDragState()
    return
  }

  markAsDropTarget(event)

  const currentIndex = localNodes.value.findIndex((node) => node.id === draggingNodeId.value)
  const targetIndex = localNodes.value.findIndex((node) => node.id === targetNodeId)
  if (currentIndex === -1 || targetIndex === -1) {
    clearDragState()
    return
  }

  const insertAfter = dropTarget.value?.nodeId === targetNodeId
    ? dropTarget.value.insertAfter
    : false

  let nextIndex = targetIndex + (insertAfter ? 1 : 0)
  if (currentIndex < nextIndex) {
    nextIndex -= 1
  }

  handleEnd({
    oldIndex: currentIndex,
    newIndex: nextIndex,
  })
  clearDragState()
}

const handleListDragOver = (event: DragEvent) => {
  if (!draggingNodeId.value || localNodes.value.length === 0) {
    return
  }

  markAsDropTarget(event)

  const lastNode = localNodes.value[localNodes.value.length - 1]
  if (!lastNode) {
    return
  }

  dropTarget.value = {
    nodeId: lastNode.id,
    insertAfter: true,
  }
}

const handleListDrop = (event: DragEvent) => {
  if (!draggingNodeId.value || localNodes.value.length === 0) {
    clearDragState()
    return
  }

  const lastNode = localNodes.value[localNodes.value.length - 1]
  if (!lastNode) {
    clearDragState()
    return
  }

  handleDrop(lastNode.id, event)
}

const normalizeOutlineTitle = (title: string) => title.replace(/\s+/g, '')

const resolveLevel2SectionEmoji = (title: string) => {
  const normalizedTitle = normalizeOutlineTitle(title)
  return LEVEL2_SECTION_ICON_RULES.find(({ pattern }) => pattern.test(normalizedTitle))?.emoji ?? '📌'
}
</script>

<template>
  <ul
    class="space-y-2"
    @dragover="handleListDragOver"
    @drop="handleListDrop"
  >
    <li v-for="node in localNodes" :key="node.id" class="outline-sortable-item list-none space-y-2">
      <div
        class="flex items-center gap-2"
        :class="{
          'outline-drop-before': dropTarget?.nodeId === node.id && !dropTarget.insertAfter,
          'outline-drop-after': dropTarget?.nodeId === node.id && dropTarget.insertAfter,
        }"
        :style="{ paddingLeft: `${props.depth * 14}px` }"
        @dragenter="handleDragEnter(node.id, $event)"
        @dragover="handleDragOver(node.id, $event)"
        @drop="handleDrop(node.id, $event)"
      >
        <button
          type="button"
          class="outline-drag-handle"
          draggable="true"
          :title="`拖动排序 ${node.title}`"
          @click.stop
          @dragstart="handleDragStart(node.id, $event)"
          @dragend="clearDragState"
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
            'opacity-60': draggingNodeId === node.id,
          }"
          @click="handleJump(node.id)"
        >
          <span
            v-if="node.level === 2"
            class="outline-row-emoji"
            aria-hidden="true"
          >
            {{ resolveLevel2SectionEmoji(node.title) }}
          </span>
          <span class="outline-row-title truncate">{{ node.title }}</span>
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
