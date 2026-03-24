<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke } from '@tauri-apps/api/core'
import { useResumeStore } from '../../stores/resume'
import type { FileItem } from '../../stores/resume'

const store = useResumeStore()
const RENAME_IME_GUARD_MS = 180

const activeTab = ref<'resume' | 'pdf' | 'photo'>('resume')
const editingFilePath = ref<string | null>(null)
const editingFileName = ref('')
const isRenameComposing = ref(false)
const renameImeGuardUntil = ref(0)
const editInputRefs = ref<Record<string, HTMLInputElement | null>>({})
const deleteDialogVisible = ref(false)
const fileToDelete = ref<FileItem | null>(null)

const currentPhotoName = computed(() => {
  const current = store.photoFileList.find((file) => file.path === store.currentPhotoPath)
  return current?.name ?? ''
})

const handleFileClick = async (path: string) => {
  await store.openFile(path)
}

const handlePdfClick = async (path: string) => {
  try {
    await invoke('open_pdf', { path })
  } catch (error) {
    console.error('Failed to open pdf:', error)
    ElMessage.error('打开 PDF 失败')
  }
}

const handlePhotoImport = async () => {
  await store.importIdPhoto()
}

const handlePhotoDelete = async () => {
  if (!store.currentPhotoPath) {
    return
  }

  await store.deletePhoto(store.currentPhotoPath)
}

const startRename = async (file: FileItem) => {
  editingFilePath.value = file.path
  editingFileName.value = file.name.replace(/\.md$/, '')
  isRenameComposing.value = false
  renameImeGuardUntil.value = 0
  await nextTick()
  editInputRefs.value[file.path]?.focus()
}

const finishRename = async (options: { force?: boolean } = {}) => {
  if (!editingFilePath.value) {
    return
  }

  if (isRenameComposing.value && !options.force) {
    return
  }

  const oldPath = editingFilePath.value
  const newName = editingFileName.value.trim()

  editingFilePath.value = null
  editingFileName.value = ''
  isRenameComposing.value = false
  renameImeGuardUntil.value = 0

  if (newName) {
    await store.renameFile(oldPath, newName)
  }
}

const cancelRename = () => {
  editingFilePath.value = null
  editingFileName.value = ''
  isRenameComposing.value = false
  renameImeGuardUntil.value = 0
}

const markRenameImeGuard = () => {
  renameImeGuardUntil.value = Date.now() + RENAME_IME_GUARD_MS
}

const isRenameImeActive = () => isRenameComposing.value || Date.now() < renameImeGuardUntil.value

const handleRenameInput = (event: Event) => {
  editingFileName.value = (event.target as HTMLInputElement).value
}

const handleRenameCompositionStart = () => {
  isRenameComposing.value = true
  markRenameImeGuard()
}

const handleRenameCompositionUpdate = () => {
  markRenameImeGuard()
}

const handleRenameCompositionEnd = (event: CompositionEvent) => {
  isRenameComposing.value = false
  markRenameImeGuard()
  editingFileName.value = (event.target as HTMLInputElement).value
}

const handleRenameEnter = async (event: KeyboardEvent) => {
  if (event.isComposing || event.keyCode === 229 || isRenameImeActive()) {
    return
  }

  await finishRename({ force: true })
}

const handleRenamePointerDown = (event: PointerEvent) => {
  const currentEditingPath = editingFilePath.value
  if (!currentEditingPath) {
    return
  }

  const input = editInputRefs.value[currentEditingPath]
  if (input?.contains(event.target as Node)) {
    return
  }

  if (isRenameImeActive()) {
    return
  }

  void finishRename({ force: true })
}

watch(editingFilePath, (path) => {
  if (typeof document === 'undefined') {
    return
  }

  if (path) {
    document.addEventListener('pointerdown', handleRenamePointerDown, true)
    return
  }

  document.removeEventListener('pointerdown', handleRenamePointerDown, true)
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', handleRenamePointerDown, true)
  }
})

const openDeleteDialog = (file: FileItem) => {
  fileToDelete.value = file
  deleteDialogVisible.value = true
}

const handleContextMenu = (command: { action: string; file: FileItem }) => {
  if (command.action === 'duplicate') {
    void store.duplicateFile(command.file.path)
    return
  }

  if (command.action === 'rename') {
    void startRename(command.file)
    return
  }

  openDeleteDialog(command.file)
}

const confirmDelete = async () => {
  if (fileToDelete.value) {
    await store.deleteFile(fileToDelete.value.path)
  }

  deleteDialogVisible.value = false
  fileToDelete.value = null
}
</script>

<template>
  <div class="h-full min-h-0">
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除文件"
      width="260"
      :show-close="false"
      :append-to-body="false"
      class="delete-confirm-dialog"
    >
      <span class="text-sm text-on-surface">
        确认删除“{{ fileToDelete?.name.replace(/\.md$/, '') }}”吗？
      </span>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button size="small" @click="deleteDialogVisible = false">取消</el-button>
          <el-button size="small" type="danger" @click="confirmDelete">删除</el-button>
        </div>
      </template>
    </el-dialog>

    <el-tabs v-model="activeTab" class="library-tabs h-full">
      <el-tab-pane label="简历" name="resume">
        <div class="h-full px-1 pb-2 pt-3">
          <div
            v-if="!store.workspacePath"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹</p>
          </div>

          <div
            v-else-if="store.fileList.length === 0"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">description</span>
            </div>
            <p class="text-sm font-medium">当前目录还没有 Markdown 简历</p>
          </div>

          <ul v-else class="sidebar-panel-scroll space-y-1">
            <li v-for="file in store.fileList" :key="file.path" class="group relative">
              <el-dropdown trigger="contextmenu" @command="handleContextMenu" class="!block w-full overflow-hidden">
                <div
                  class="flex cursor-pointer items-center overflow-hidden rounded-2xl px-4 py-2.5 transition-all duration-200"
                  :class="store.activeFilePath === file.path ? 'font-medium' : 'text-on-surface hover:bg-surface-container-highest'"
                  :style="
                    store.activeFilePath === file.path
                      ? {
                          backgroundColor: `color-mix(in srgb, ${store.resumeStyle.themeColor} 12%, white)`,
                          color: store.resumeStyle.themeColor,
                        }
                      : undefined
                  "
                  @click="handleFileClick(file.path)"
                  @dblclick="startRename(file)"
                >
                  <span
                    class="mr-2 flex h-8 w-8 shrink-0 items-center justify-center"
                    :style="{
                      color: '#2563eb',
                    }"
                  >
                    <span class="material-symbols-outlined text-[20px]">description</span>
                  </span>

                  <div class="mr-2 min-w-0 flex-1 overflow-hidden">
                    <input
                      v-if="editingFilePath === file.path"
                      :ref="(el) => { editInputRefs[file.path] = el as HTMLInputElement | null }"
                      :value="editingFileName"
                      class="w-full rounded-lg border border-primary/30 bg-surface-container-highest px-2 py-1 text-sm text-on-surface focus:outline-none"
                      @input="handleRenameInput"
                      @compositionstart="handleRenameCompositionStart"
                      @compositionupdate="handleRenameCompositionUpdate"
                      @compositionend="handleRenameCompositionEnd"
                      @keydown.stop
                      @keydown.enter.prevent="handleRenameEnter"
                      @keyup.stop
                      @keyup.esc.prevent="cancelRename"
                      @click.stop
                    />
                    <span
                      v-else
                      class="block truncate text-sm font-medium leading-none select-none"
                      :title="file.name.replace(/\.md$/, '')"
                    >
                      {{ file.name.replace(/\.md$/, '') }}
                    </span>
                  </div>

                  <el-popconfirm
                    :title="`确认删除 ${file.name.replace(/\.md$/, '')} 吗？`"
                    confirm-button-text="删除"
                    cancel-button-text="取消"
                    confirm-button-type="danger"
                    @confirm="store.deleteFile(file.path)"
                  >
                    <template #reference>
                      <button
                        class="flex h-8 w-8 shrink-0 scale-90 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-error/10 hover:text-error"
                        @click.stop
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </template>
                  </el-popconfirm>
                </div>

                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="{ action: 'duplicate', file }">
                      <span class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">content_copy</span>
                        复制
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'rename', file }">
                      <span class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                        重命名
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'delete', file }" class="!text-error">
                      <span class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                        删除
                      </span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </li>
          </ul>
        </div>
      </el-tab-pane>

      <el-tab-pane label="PDF" name="pdf">
        <div class="h-full px-1 pb-2 pt-3">
          <div
            v-if="!store.workspacePath"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">picture_as_pdf</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹以查看 PDF</p>
          </div>

          <div
            v-else-if="store.pdfFileList.length === 0"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">picture_as_pdf</span>
            </div>
            <p class="text-sm font-medium">当前目录还没有 PDF 文件</p>
          </div>

          <ul v-else class="sidebar-panel-scroll space-y-1">
            <li v-for="file in store.pdfFileList" :key="file.path" class="group relative">
              <div
                class="flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface transition-colors duration-200 hover:bg-surface-container-highest/60"
              >
                <button
                  class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition-colors duration-200 hover:text-primary"
                  @click="handlePdfClick(file.path)"
                >
                  <span class="material-symbols-outlined shrink-0 text-[20px] text-[#dc2626]">picture_as_pdf</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium" :title="file.name">{{ file.name }}</p>
                  </div>
                </button>

                <el-popconfirm
                  :title="`确认删除 ${file.name} 吗？`"
                  confirm-button-text="删除"
                  cancel-button-text="取消"
                  confirm-button-type="danger"
                  @confirm="store.deletePdf(file.path)"
                >
                  <template #reference>
                    <button
                      class="flex h-8 w-8 shrink-0 scale-90 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-error/10 hover:text-error"
                      @click.stop
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </template>
                </el-popconfirm>
              </div>
            </li>
          </ul>
        </div>
      </el-tab-pane>

      <el-tab-pane label="证件照" name="photo">
        <div class="h-full px-1 pb-2 pt-3">
          <div
            v-if="!store.workspacePath"
            class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <span class="material-symbols-outlined text-3xl">add_a_photo</span>
            </div>
            <p class="text-sm font-medium">请选择工作文件夹以上传证件照</p>
          </div>

          <div v-else class="flex h-full flex-col gap-4">
            <button
              class="w-full cursor-pointer rounded-2xl py-2.5 text-sm font-medium shadow-sm transition-all duration-200"
              :style="{
                backgroundColor: `color-mix(in srgb, ${store.resumeStyle.themeColor} 14%, white)`,
                color: store.resumeStyle.themeColor,
              }"
              @click="handlePhotoImport"
            >
              <span class="flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-lg">upload</span>
                <span>上传证件照</span>
              </span>
            </button>

            <div class="sidebar-section-card flex-1">
              <div class="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[20px] bg-surface-container-lowest">
                <img
                  v-if="store.photoBase64"
                  :src="store.photoBase64"
                  alt="当前证件照"
                  class="h-full w-full object-cover"
                />
                <div v-else class="px-5 text-center text-on-surface-variant">
                  <span class="material-symbols-outlined mb-2 block text-3xl">gallery_thumbnail</span>
                  <p class="text-sm font-medium">当前目录还没有证件照</p>
                </div>
              </div>

              <div v-if="store.currentPhotoPath" class="mt-3 flex items-center gap-2">
                <p class="min-w-0 flex-1 truncate text-sm font-medium text-on-surface" :title="currentPhotoName">
                  {{ currentPhotoName }}
                </p>

                <el-popconfirm
                  :title="`确认删除 ${currentPhotoName} 吗？`"
                  confirm-button-text="删除"
                  cancel-button-text="取消"
                  confirm-button-type="danger"
                  @confirm="handlePhotoDelete"
                >
                  <template #reference>
                    <button
                      class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant transition-all duration-200 hover:bg-error/10 hover:text-error"
                      @click.stop
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </template>
                </el-popconfirm>
              </div>

              <p v-else class="mt-3 text-xs leading-5 text-on-surface-variant">
                导入后会保存在当前工作文件夹，并按 <code>IDphoto</code>、<code>IDphoto-2</code> 这类名称自动管理。
              </p>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.library-tabs {
  display: flex;
  flex-direction: column;
}

.library-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 0.25rem;
  flex-shrink: 0;
}

.library-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0 0.25rem;
}

.library-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: color-mix(in srgb, var(--sidebar-accent) 18%, var(--color-surface-variant));
}

.library-tabs :deep(.el-tabs__nav-scroll) {
  overflow: visible;
}

.library-tabs :deep(.el-tabs__nav) {
  display: flex;
  width: 100%;
}

.library-tabs :deep(.el-tabs__item) {
  flex: 1 1 0;
  min-width: 0;
  justify-content: center;
  padding: 0 0.5rem 0.85rem;
  height: auto;
  font-size: 0.95rem;
  color: var(--color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-tabs :deep(.el-tabs__item:hover),
.library-tabs :deep(.el-tabs__item.is-active) {
  color: var(--sidebar-accent);
}

.library-tabs :deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 999px;
  background-color: var(--sidebar-accent);
}

.library-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.library-tabs :deep(.el-tab-pane) {
  height: 100%;
}

</style>
