<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { ElMessage } from 'element-plus'
import { useResumeStore } from '../stores/resume'
import { MANUAL_PAGE_BREAK_MARKER } from '../utils/manualPageBreak'

const editorContainer = ref<HTMLElement | null>(null)
const hasCopiedMarkdown = ref(false)
const recoveryFileName = ref('')
const store = useResumeStore()

const isMissingFile = computed(() => store.activeFileStatus === 'missing')
const hasAlternativeFiles = computed(() => store.fileList.length > 0)
const isFormattingDisabled = computed(
  () => !store.activeFilePath || store.activeFileStatus === 'missing',
)

let view: EditorView | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let isExternalUpdate = false

const editableCompartment = new Compartment()
const readOnlyCompartment = new Compartment()
const LINE_FORMAT_OPTIONS = [
  { label: '正文', value: 'paragraph', icon: 'notes' },
  { label: '标题 2', value: 'heading2', icon: 'format_h2' },
  { label: '标题 3', value: 'heading3', icon: 'format_h3' },
  { label: '标题 4', value: 'heading4', icon: 'format_h4' },
  { label: '标题 1', value: 'heading1', icon: 'format_h1' },
  { label: '列表', value: 'list', icon: 'format_list_bulleted' },
  { label: '引用', value: 'quote', icon: 'format_quote' },
] as const

type LineFormatValue = (typeof LINE_FORMAT_OPTIONS)[number]['value']

const LINE_FORMAT_PREFIXES: Record<LineFormatValue, string> = {
  paragraph: '',
  heading1: '# ',
  heading2: '## ',
  heading3: '### ',
  heading4: '#### ',
  list: '- ',
  quote: '> ',
}

const currentLineFormat = ref<LineFormatValue>('paragraph')

const getLineFormatOption = (format: LineFormatValue) =>
  LINE_FORMAT_OPTIONS.find((option) => option.value === format) ?? LINE_FORMAT_OPTIONS[0]

interface ParsedLineFormat {
  leadingWhitespace: string
  prefix: string
  content: string
  format: LineFormatValue
}

interface LineFormatChange {
  line: {
    from: number
    to: number
    length: number
    number: number
    text: string
  }
  parsedLine: ParsedLineFormat
  nextText: string
  delta: number
}

const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.heading,
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: 'var(--color-primary)',
    fontWeight: '700',
    textDecoration: 'none',
  },
  {
    tag: tags.strong,
    fontWeight: '700',
    color: 'var(--color-on-surface)',
  },
  {
    tag: tags.emphasis,
    fontStyle: 'italic',
    color: 'var(--color-on-surface)',
  },
  {
    tag: tags.quote,
    color: 'color-mix(in srgb, var(--color-primary) 74%, var(--color-on-surface-variant) 26%)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.link, tags.url],
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, var(--color-primary) 55%, transparent)',
  },
  {
    tag: tags.monospace,
    color: 'var(--color-on-surface)',
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    borderRadius: '0.4rem',
  },
  {
    tag: [tags.processingInstruction, tags.contentSeparator],
    color: 'var(--color-primary)',
    fontWeight: '600',
  },
])

const parseLineFormat = (lineText: string): ParsedLineFormat => {
  const leadingWhitespace = lineText.match(/^\s*/)?.[0] ?? ''
  const contentText = lineText.slice(leadingWhitespace.length)
  const headingMatch = contentText.match(/^(#{1,4})\s+/)

  if (headingMatch) {
    return {
      leadingWhitespace,
      prefix: headingMatch[0],
      content: contentText.slice(headingMatch[0].length),
      format: `heading${headingMatch[1].length}` as LineFormatValue,
    }
  }

  const listMatch = contentText.match(/^(?:[-*+]\s+|\d+\.\s+)/)
  if (listMatch) {
    return {
      leadingWhitespace,
      prefix: listMatch[0],
      content: contentText.slice(listMatch[0].length),
      format: 'list' as const,
    }
  }

  const quoteMatch = contentText.match(/^>\s?/)
  if (quoteMatch) {
    return {
      leadingWhitespace,
      prefix: quoteMatch[0],
      content: contentText.slice(quoteMatch[0].length),
      format: 'quote' as const,
    }
  }

  return {
    leadingWhitespace,
    prefix: '',
    content: contentText,
    format: 'paragraph' as const,
  }
}

const syncCurrentLineFormat = (state: EditorState) => {
  const activeLine = state.doc.lineAt(state.selection.main.head)
  currentLineFormat.value = parseLineFormat(activeLine.text).format
}

const scheduleAutoSave = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = setTimeout(async () => {
    if (store.activeFilePath && store.activeFileStatus === 'ready') {
      await store.saveCurrentFile(true)
    }
    autoSaveTimer = null
  }, 1000)
}

const syncEditorReadOnly = () => {
  if (!view) {
    return
  }

  const isReadOnly = isMissingFile.value
  view.dispatch({
    effects: [
      editableCompartment.reconfigure(EditorView.editable.of(!isReadOnly)),
      readOnlyCompartment.reconfigure(EditorState.readOnly.of(isReadOnly)),
    ],
  })
}

const syncRecoveryFileName = () => {
  if (!isMissingFile.value) {
    recoveryFileName.value = ''
    return
  }

  recoveryFileName.value = store.activeFileName || '恢复稿'
}

const focusEditor = () => {
  view?.focus()
}

const applyCurrentLineFormat = (nextFormat: LineFormatValue) => {
  if (!view) {
    return
  }

  const { state } = view
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to > from ? to - 1 : to)
  const rangeFrom = startLine.from
  const rangeTo = endLine.to
  const nextPrefix = LINE_FORMAT_PREFIXES[nextFormat]
  const lineChanges: LineFormatChange[] = []

  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    const parsedLine = parseLineFormat(line.text)
    const nextText = `${parsedLine.leadingWhitespace}${nextPrefix}${parsedLine.content}`

    lineChanges.push({
      line,
      parsedLine,
      nextText,
      delta: nextText.length - line.length,
    })
  }

  const mapSelectionPos = (position: number) => {
    let cumulativeDelta = 0

    for (const lineChange of lineChanges) {
      const { line, parsedLine } = lineChange
      const leadingEnd = line.from + parsedLine.leadingWhitespace.length
      const contentStart = leadingEnd + parsedLine.prefix.length
      const nextLineFrom = line.from + cumulativeDelta
      const nextContentStart = nextLineFrom + parsedLine.leadingWhitespace.length + nextPrefix.length

      if (position < line.from) {
        return position + cumulativeDelta
      }

      if (position <= line.to) {
        if (position < leadingEnd) {
          return position + cumulativeDelta
        }

        if (position <= contentStart) {
          return nextContentStart
        }

        const contentOffset = Math.min(position - contentStart, parsedLine.content.length)
        return nextContentStart + contentOffset
      }

      cumulativeDelta += lineChange.delta
    }

    return position + cumulativeDelta
  }

  view.dispatch({
    changes: {
      from: rangeFrom,
      to: rangeTo,
      insert: lineChanges.map((lineChange) => lineChange.nextText).join('\n'),
    },
    selection: {
      anchor: mapSelectionPos(state.selection.main.anchor),
      head: mapSelectionPos(state.selection.main.head),
    },
  })
  focusEditor()
}

const jumpToLine = (lineNumber: number) => {
  if (!view) {
    return
  }

  const boundedLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines))
  const targetLine = view.state.doc.line(boundedLine)

  view.dispatch({
    selection: { anchor: targetLine.from, head: targetLine.from },
    effects: EditorView.scrollIntoView(targetLine.from, { y: 'center' }),
  })
  focusEditor()
}

const insertManualPageBreak = () => {
  if (!view) return

  const { state } = view
  const { from, to } = state.selection.main
  const line = state.doc.lineAt(from)
  const isCurrentLinePageBreak =
    line.from !== line.to && line.text.trim() === MANUAL_PAGE_BREAK_MARKER

  if (isCurrentLinePageBreak) {
    const removeFrom = Math.max(0, line.from - (line.from > 0 ? 1 : 0))
    const removeTo = Math.min(state.doc.length, line.to + (line.to < state.doc.length ? 1 : 0))
    view.dispatch({
      changes: { from: removeFrom, to: removeTo, insert: '' },
      selection: { anchor: removeFrom, head: removeFrom },
    })
    focusEditor()
    return
  }

  const beforeChar = from > 0 ? state.doc.sliceString(from - 1, from) : ''
  const afterChar = to < state.doc.length ? state.doc.sliceString(to, to + 1) : ''
  const prefix = beforeChar === '\n' || from === 0 ? '' : '\n'
  const suffix = afterChar === '\n' || to === state.doc.length ? '\n' : '\n\n'
  const insertText = `${prefix}${MANUAL_PAGE_BREAK_MARKER}${suffix}`
  const cursorPosition = from + insertText.length

  view.dispatch({
    changes: { from, to, insert: insertText },
    selection: { anchor: cursorPosition, head: cursorPosition },
  })
  focusEditor()
}

const toggleInlineSyntax = (prefix: string, suffix: string = prefix) => {
  if (!view) return

  const { state } = view
  const { from, to, empty } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)
  const selectedHasWrapper =
    selectedText.length >= prefix.length + suffix.length &&
    selectedText.startsWith(prefix) &&
    selectedText.endsWith(suffix)

  if (selectedHasWrapper) {
    const unwrappedText = selectedText.slice(prefix.length, selectedText.length - suffix.length)
    view.dispatch({
      changes: { from, to, insert: unwrappedText },
      selection: { anchor: from, head: from + unwrappedText.length },
    })
    focusEditor()
    return
  }

  const beforeSelection = from >= prefix.length
    ? state.doc.sliceString(from - prefix.length, from)
    : ''
  const afterSelection = to + suffix.length <= state.doc.length
    ? state.doc.sliceString(to, to + suffix.length)
    : ''

  if (!empty && beforeSelection === prefix && afterSelection === suffix) {
    view.dispatch({
      changes: [
        { from: from - prefix.length, to: from, insert: '' },
        { from: to, to: to + suffix.length, insert: '' },
      ],
      selection: { anchor: from - prefix.length, head: to - prefix.length },
    })
    focusEditor()
    return
  }

  view.dispatch({
    changes: { from, to, insert: `${prefix}${selectedText}${suffix}` },
    selection: {
      anchor: from + prefix.length,
      head: empty ? from + prefix.length : to + prefix.length,
    },
  })
  focusEditor()
}

const toggleLinePrefix = (prefix: string) => {
  if (!view) return

  const { state } = view
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to > from ? to - 1 : to)
  const rangeFrom = startLine.from
  const rangeTo = endLine.to
  const blockText = state.doc.sliceString(rangeFrom, rangeTo)
  const lines = blockText.split('\n')

  if (lines.length === 1 && lines[0] === '') {
    view.dispatch({
      changes: { from: rangeFrom, to: rangeTo, insert: prefix },
      selection: { anchor: rangeFrom + prefix.length, head: rangeFrom + prefix.length },
    })
    focusEditor()
    return
  }

  const nonEmptyLines = lines.filter((line) => line.length > 0)
  const shouldRemove =
    nonEmptyLines.length > 0 && nonEmptyLines.every((line) => line.startsWith(prefix))
  const nextBlockText = lines
    .map((line) => {
      if (!line.length) {
        return line
      }

      if (shouldRemove && line.startsWith(prefix)) {
        return line.slice(prefix.length)
      }

      return shouldRemove ? line : `${prefix}${line}`
    })
    .join('\n')

  view.dispatch({
    changes: { from: rangeFrom, to: rangeTo, insert: nextBlockText },
    selection: { anchor: rangeFrom, head: rangeFrom + nextBlockText.length },
  })
  focusEditor()
}

const toggleLinkSyntax = () => {
  if (!view) return

  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)
  const selectedLinkMatch = selectedText.match(/^\[([\s\S]*)\]\(([^()]*)\)$/)

  if (selectedLinkMatch) {
    const label = selectedLinkMatch[1]
    view.dispatch({
      changes: { from, to, insert: label },
      selection: { anchor: from, head: from + label.length },
    })
    focusEditor()
    return
  }

  const precedingChar = from > 0 ? state.doc.sliceString(from - 1, from) : ''
  const trailingText = state.doc.sliceString(to, Math.min(state.doc.length, to + 2048))
  const surroundingLinkMatch = precedingChar === '['
    ? trailingText.match(/^\]\(([^()]*)\)/)
    : null

  if (surroundingLinkMatch) {
    const suffixLength = surroundingLinkMatch[0].length
    view.dispatch({
      changes: [
        { from: from - 1, to: from, insert: '' },
        { from: to, to: to + suffixLength, insert: '' },
      ],
      selection: { anchor: from - 1, head: to - 1 },
    })
    focusEditor()
    return
  }

  view.dispatch({
    changes: { from, to, insert: `[${selectedText}](url)` },
    selection: {
      anchor: from + 1,
      head: selectedText.length > 0 ? from + 1 + selectedText.length : from + 1,
    },
  })
  focusEditor()
}

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Clipboard unavailable')
  }
}

const showCopyFeedback = () => {
  hasCopiedMarkdown.value = true

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }

  copyFeedbackTimer = setTimeout(() => {
    hasCopiedMarkdown.value = false
    copyFeedbackTimer = null
  }, 1600)
}

const copyMarkdown = async () => {
  if (!store.activeFilePath) {
    return
  }

  try {
    await copyTextToClipboard(store.markdownContent)
    showCopyFeedback()
    ElMessage.success('Markdown 已复制')
  } catch (error) {
    console.error('Failed to copy markdown:', error)
    ElMessage.error('复制失败')
  }
}

const handleRecoverMissingFile = async () => {
  const recovered = await store.saveMissingFileAs(recoveryFileName.value)
  if (recovered) {
    recoveryFileName.value = ''
  }
}

const handleOpenOtherFile = async () => {
  await store.openFirstAvailableFile()
  if (store.activeFileStatus !== 'missing') {
    recoveryFileName.value = ''
  }
}

onMounted(() => {
  if (!editorContainer.value) return

  view = new EditorView({
    doc: store.markdownContent,
    extensions: [
      basicSetup,
      EditorView.lineWrapping,
      markdown(),
      editableCompartment.of(EditorView.editable.of(true)),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      syntaxHighlighting(markdownHighlightStyle),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          syncCurrentLineFormat(update.state)
        }

        if (!update.docChanged) {
          return
        }

        store.updateMarkdownContent(update.state.doc.toString(), !isExternalUpdate)
        if (isExternalUpdate) {
          return
        }

        scheduleAutoSave()
      }),
      EditorView.theme({
        '&': { height: '100%', backgroundColor: 'transparent' },
        '.cm-scroller': {
          overflow: 'auto',
          padding: '2rem',
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent',
          scrollbarGutter: 'stable',
        },
        '.cm-scroller::-webkit-scrollbar': {
          width: '6px',
          height: '6px',
        },
        '.cm-scroller::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
        '.cm-scroller::-webkit-scrollbar-thumb': {
          backgroundColor: 'color-mix(in srgb, var(--color-surface-variant) 18%, transparent)',
          borderRadius: '999px',
        },
        '&:hover .cm-scroller, &:focus-within .cm-scroller': {
          scrollbarColor: 'var(--color-surface-variant) transparent',
        },
        '&:hover .cm-scroller::-webkit-scrollbar-thumb, &:focus-within .cm-scroller::-webkit-scrollbar-thumb': {
          backgroundColor: 'var(--color-surface-variant)',
        },
        '.cm-content': {
          fontFamily: 'var(--font-body), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '14px',
          color: 'var(--color-on-surface-variant)',
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: 'var(--color-outline-variant)',
          borderRight: 'none',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
          color: 'var(--color-primary)',
        },
      }),
    ],
    parent: editorContainer.value,
  })

  syncEditorReadOnly()
  syncRecoveryFileName()
  syncCurrentLineFormat(view.state)
})

onBeforeUnmount(async () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = null
  }

  if (store.activeFilePath) {
    await store.saveCurrentFile(true)
  }

  if (view) {
    view.destroy()
  }
})

watch(() => store.markdownContent, (newVal) => {
  if (!view || view.state.doc.toString() === newVal) {
    return
  }

  isExternalUpdate = true
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: newVal },
  })
  isExternalUpdate = false
})

watch(
  () => store.activeFileStatus,
  () => {
    syncEditorReadOnly()
    syncRecoveryFileName()
  },
)

watch(
  () => store.editorJumpRequest?.token,
  () => {
    if (!store.editorJumpRequest) {
      return
    }

    jumpToLine(store.editorJumpRequest.line)
    store.clearEditorJumpRequest()
  },
)
</script>

<template>
  <section class="relative flex h-full flex-col overflow-hidden card-soft ghost-border shadow-ambient">
    <transition name="fade">
      <div
        v-if="!store.activeFilePath"
        class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface-container-lowest/80 backdrop-blur-sm"
      >
        <div class="mb-4 rounded-[2rem] border border-white/5 bg-surface-container-high p-8 text-on-surface-variant/40 shadow-inner ring-1 ring-outline-variant/10">
          <span class="material-symbols-outlined text-4xl">edit_note</span>
        </div>
        <p class="text-sm font-semibold tracking-wide text-on-surface">选择或创建一个文件</p>
        <p class="mt-2 text-[11px] font-medium text-on-surface-variant/60">开始你的简历编辑</p>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="store.activeFilePath && isMissingFile"
        class="absolute inset-0 z-40 flex items-center justify-center bg-surface-container-lowest/78 backdrop-blur-sm"
      >
        <div class="mx-6 w-full max-w-lg rounded-[2rem] bg-surface-container-lowest p-6 shadow-ambient">
          <div class="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-error/10 text-error">
            <span class="material-symbols-outlined text-[26px]">warning</span>
          </div>
          <h3 class="mt-4 text-lg font-semibold text-on-surface">文件已从磁盘删除</h3>
          <p class="mt-2 text-sm leading-6 text-on-surface-variant">
            当前编辑内容仍保留在内存中。你可以将它另存为新文件，或者直接打开其他文件。
          </p>

          <div class="mt-5 flex flex-col gap-3">
            <input
              v-model="recoveryFileName"
              class="w-full rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(76,73,204,0.12)]"
              placeholder="输入恢复文件名"
              @keyup.enter="handleRecoverMissingFile"
            />

            <div class="flex flex-wrap gap-2">
              <button
                class="btn-primary !rounded-2xl !px-4 !py-2.5 text-sm"
                :disabled="!recoveryFileName.trim()"
                @click="handleRecoverMissingFile"
              >
                <span class="material-symbols-outlined text-base">save</span>
                <span>另存为新文件</span>
              </button>

              <button
                class="flex items-center gap-2 rounded-2xl bg-surface-container px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!hasAlternativeFiles"
                @click="handleOpenOtherFile"
              >
                <span class="material-symbols-outlined text-base">folder_open</span>
                <span>打开其他文件</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <div
      class="flex h-14 items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest/50 px-6 backdrop-blur-sm transition-all duration-300 shrink-0"
      :class="{ 'pointer-events-none opacity-20 grayscale': !store.activeFilePath }"
    >
      <div
        class="flex items-center gap-3 transition-opacity"
        :class="{ 'pointer-events-none opacity-45': isFormattingDisabled }"
      >
        <el-select
          :model-value="currentLineFormat"
          size="small"
          placeholder="文本属性"
          class="editor-line-format-select"
          :disabled="isFormattingDisabled"
          @update:model-value="applyCurrentLineFormat"
        >
          <template #label="{ value }">
            <span class="editor-line-format-current">
              <span class="material-symbols-outlined text-[18px]">
                {{ getLineFormatOption(value as LineFormatValue).icon }}
              </span>
            </span>
          </template>
          <el-option
            v-for="option in LINE_FORMAT_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          >
            <div class="editor-line-format-option">
              <span class="material-symbols-outlined text-[18px] text-primary/90">
                {{ option.icon }}
              </span>
              <span>{{ option.label }}</span>
            </div>
          </el-option>
        </el-select>
        <button @click="toggleInlineSyntax('**')" class="rounded-lg p-2 text-on-surface-variant transition-colors group hover:bg-surface-container-low" title="加粗">
          <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">format_bold</span>
        </button>
        <button @click="toggleInlineSyntax('*')" class="rounded-lg p-2 text-on-surface-variant transition-colors group hover:bg-surface-container-low" title="斜体">
          <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">format_italic</span>
        </button>
        <button @click="toggleLinePrefix('- ')" class="rounded-lg p-2 text-on-surface-variant transition-colors group hover:bg-surface-container-low" title="列表">
          <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">format_list_bulleted</span>
        </button>
        <button @click="toggleLinkSyntax" class="rounded-lg p-2 text-on-surface-variant transition-colors group hover:bg-surface-container-low" title="链接">
          <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">link</span>
        </button>
        <button @click="insertManualPageBreak" class="rounded-lg p-2 text-on-surface-variant transition-colors group hover:bg-surface-container-low" :title="`插入分页 ${MANUAL_PAGE_BREAK_MARKER}`">
          <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">insert_page_break</span>
        </button>
        <button @click="toggleLinePrefix('> ')" class="rounded-lg p-2 text-on-surface-variant transition-colors group hover:bg-surface-container-low" title="引用">
          <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">format_quote</span>
        </button>
      </div>

      <button
        @click="copyMarkdown"
        class="rounded-lg p-2 text-on-surface-variant transition-colors group hover:bg-surface-container-low"
        :title="hasCopiedMarkdown ? '已复制 Markdown 文本' : '复制 Markdown 文本'"
      >
        <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
          {{ hasCopiedMarkdown ? 'check' : 'content_copy' }}
        </span>
      </button>
    </div>

    <div
      class="flex-1 w-full overflow-hidden bg-transparent transition-opacity duration-300"
      :class="{ 'opacity-0': !store.activeFilePath }"
    >
      <div ref="editorContainer" class="custom-scrollbar h-full w-full"></div>
    </div>
  </section>
</template>

<style scoped>
.editor-line-format-select {
  width: 3.5rem;
}

.editor-line-format-select :deep(.el-select__wrapper) {
  min-height: 2.25rem;
  border-radius: 999px;
  padding-inline: 0.625rem 0.5rem;
  background-color: color-mix(in srgb, var(--color-surface-container-lowest) 92%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline-variant) 22%, transparent);
  transition: background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.editor-line-format-select:hover :deep(.el-select__wrapper),
.editor-line-format-select.is-focus :deep(.el-select__wrapper) {
  background-color: var(--color-surface-container-high);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.editor-line-format-select :deep(.el-select__selected-item),
.editor-line-format-select :deep(.el-select__placeholder) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.editor-line-format-select :deep(.el-select__caret) {
  font-size: 1rem;
  color: color-mix(in srgb, var(--color-on-surface-variant) 72%, white);
}

.editor-line-format-current {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.editor-line-format-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}
</style>
