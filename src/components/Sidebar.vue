<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useResumeStore } from '../stores/resume'
import type { FileItem } from '../stores/resume'

const store = useResumeStore()
const newFileName = ref('')
const isCreating = ref(false)

const editingFileStr = ref<string | null>(null)
const editingFileName = ref('')
const editInputRefs = ref<Record<string, HTMLInputElement | null>>({})

// Delete confirmation dialog
const deleteDialogVisible = ref(false)
const fileToDelete = ref<FileItem | null>(null)

const handleSelectWorkspace = async () => {
  await store.selectWorkspace()
}

const handleFileClick = async (path: string) => {
  await store.openFile(path)
}

const handleCreateFile = async () => {
  if (!newFileName.value.trim()) {
    return
  }
  await store.createFile(newFileName.value.trim())
  newFileName.value = ''
  isCreating.value = false
}

const startRename = async (file: FileItem) => {
  editingFileStr.value = file.path
  editingFileName.value = file.name.replace(/\.md$/, '')
  await nextTick()
  const inputEl = editInputRefs.value[file.path]
  if (inputEl) {
    // Vue 3 puts elements in an array if inside v-for sometimes, handle accordingly
    if (Array.isArray(inputEl)) (inputEl[0] as HTMLInputElement).focus()
    else (inputEl as HTMLInputElement).focus()
  }
}

const finishRename = async () => {
  if (!editingFileStr.value) return
  const oldPath = editingFileStr.value
  const newName = editingFileName.value.trim()
  editingFileStr.value = null
  editingFileName.value = ''
  
  if (newName) {
    await store.renameFile(oldPath, newName)
  }
}

const cancelRename = () => {
  editingFileStr.value = null
  editingFileName.value = ''
}

const handleContextMenu = (command: { action: string, file: FileItem }) => {
  if (command.action === 'duplicate') {
    store.duplicateFile(command.file.path)
  } else if (command.action === 'rename') {
    startRename(command.file)
  } else if (command.action === 'delete') {
    fileToDelete.value = command.file
    nextTick(() => { deleteDialogVisible.value = true })
  }
}

const confirmDelete = () => {
  if (fileToDelete.value) {
    store.deleteFile(fileToDelete.value.path)
  }
  deleteDialogVisible.value = false
  fileToDelete.value = null
}

// Handle deletion via el-popconfirm in the template

// Ensure proper spacing and aesthetic UI with tailwind
</script>

<template>
  <aside 
    class="h-full bg-surface-container-lowest flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden z-20 flex-shrink-0 relative"
    :class="store.isSidebarOpen ? 'w-80 shadow-[4px_0_24px_rgba(0,0,0,0.03)]' : 'w-0 opacity-0'"
  >
    <!-- Delete Confirmation Dialog -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="提示"
      width="260"
      :show-close="false"
      :append-to-body="false"
      class="delete-confirm-dialog"
    >
      <span class="text-sm text-on-surface">
        确定要删除 "{{ fileToDelete?.name.replace(/\.md$/, '') }}" 吗？
      </span>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <el-button size="small" @click="deleteDialogVisible = false">取消</el-button>
          <el-button size="small" type="danger" @click="confirmDelete">删除</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Fixed width container inside so content doesn't squeeze during animation -->
    <div class="w-80 h-full flex flex-col font-['Manrope'] antialiased absolute top-0 left-0">
      <!-- Header -->
      <div class="px-6 py-5 flex justify-between items-center bg-surface-container-lowest pb-2">
        <h2 class="text-xl font-semibold text-on-surface tracking-wide">我的简历</h2>
        <button 
          @click="store.isSidebarOpen = false"
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-variant transition-colors group cursor-pointer"
        >
          <span class="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface text-xl">close</span>
        </button>
      </div>

      <!-- Workspace selection or Creation -->
      <div class="px-6 py-4 flex flex-col gap-3">
        <div class="flex items-center gap-2 w-full">
          <button 
            class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-highest transition-all duration-200 cursor-pointer text-sm font-medium text-on-surface shadow-sm px-2"
            @click="handleSelectWorkspace"
          >
            <span class="material-symbols-outlined text-lg">folder_open</span>
            更换文件夹
          </button>

          <button 
            v-if="store.workspacePath && !isCreating"
            class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200 cursor-pointer text-sm font-medium"
            @click="isCreating = true"
          >
            <span class="material-symbols-outlined text-lg">add</span>
            新建
          </button>
        </div>
        
        <p v-if="store.workspacePath" class="text-xs text-on-surface-variant opacity-80 truncate w-full px-1" :title="store.workspacePath">
          {{ store.workspacePath }}
        </p>

        <!-- Create Input -->
        <transition name="fade">
          <div v-if="isCreating" class="flex items-center gap-2 w-full mt-1 bg-surface-container px-3 py-2 rounded-xl border border-primary/20 shadow-sm">
            <input 
              v-model="newFileName"
              @keyup.enter="handleCreateFile"
              @keyup.esc="isCreating = false"
              placeholder="文件名..."
              class="flex-1 bg-transparent border-none focus:outline-none text-sm text-on-surface w-full"
              autofocus
            />
            <button 
              @click="isCreating = false"
              class="w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface-variant transition-colors cursor-pointer shrink-0"
            >
              <span class="material-symbols-outlined text-on-surface-variant text-sm">close</span>
            </button>
          </div>
        </transition>
      </div>

      <!-- File List -->
      <div class="flex-1 overflow-y-auto px-4 pb-6 mt-2 relative">
        <div v-if="!store.workspacePath" class="flex flex-col items-center justify-center h-full text-center text-on-surface-variant gap-4 opacity-70">
          <div class="w-16 h-16 rounded-full bg-surface-container flex flex-center items-center justify-center">
            <span class="material-symbols-outlined text-3xl">inbox</span>
          </div>
          <p class="text-sm font-medium">尚未选择工作空间</p>
        </div>
        
        <div v-else-if="store.fileList.length === 0" class="flex flex-col items-center justify-center h-full text-center text-on-surface-variant gap-4 opacity-70">
          <div class="w-16 h-16 rounded-full bg-surface-container flex flex-center items-center justify-center">
            <span class="material-symbols-outlined text-3xl">description</span>
          </div>
          <p class="text-sm font-medium">该目录下暂无 .md 文件</p>
        </div>

        <ul v-else class="flex flex-col gap-0.5 pt-1">
          <li 
            v-for="file in store.fileList" 
            :key="file.path"
            class="group relative"
          >
            <el-dropdown trigger="contextmenu" @command="handleContextMenu" class="!block w-full overflow-hidden">
              <div
                class="flex items-center rounded-lg px-4 py-2 cursor-pointer transition-all duration-200 overflow-hidden"
                :class="[
                  store.activeFilePath === file.path 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'hover:bg-surface-container-highest text-on-surface'
                ]"
                @click="handleFileClick(file.path)"
                @dblclick="startRename(file)"
              >
                <div class="flex-1 min-w-0 overflow-hidden mr-2">
                  <input
                    v-if="editingFileStr === file.path"
                    :ref="(el) => { if (el) editInputRefs[file.path] = el as HTMLInputElement }"
                    v-model="editingFileName"
                    @keyup.enter="finishRename"
                    @keyup.esc="cancelRename"
                    @blur="finishRename"
                    @click.stop
                    class="bg-surface-container-highest border border-primary/30 rounded px-1.5 py-0.5 focus:outline-none text-sm text-on-surface w-full"
                  />
                  <span v-else class="text-sm truncate font-medium leading-none select-none block">
                    {{ file.name.replace(/\.md$/, '') }}
                  </span>
                </div>
                
                <!-- Actions -->
                <el-popconfirm
                  :title="`确定删除 ${file.name.replace(/\.md$/, '')} 吗？`"
                  confirm-button-text="删除"
                  cancel-button-text="取消"
                  confirm-button-type="danger"
                  @confirm="store.deleteFile(file.path)"
                >
                  <template #reference>
                    <button 
                      class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 hover:text-error transition-all duration-200 shrink-0 transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 text-on-surface-variant"
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
                    <span class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">content_copy</span>创建副本</span>
                  </el-dropdown-item>
                  <el-dropdown-item :command="{ action: 'rename', file }">
                    <span class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">edit</span>重命名</span>
                  </el-dropdown-item>
                  <el-dropdown-item :command="{ action: 'delete', file }" class="!text-error">
                    <span class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">delete</span>删除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
