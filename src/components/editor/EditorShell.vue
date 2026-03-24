<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  hasActiveFile: boolean
  hasAlternativeFiles: boolean
  isMissingFile: boolean
  recoveryFileName: string
}>()

const emit = defineEmits<{
  (event: 'open-other-file'): void
  (event: 'recover-missing-file'): void
  (event: 'update:recoveryFileName', value: string): void
}>()

const recoveryFileNameModel = computed({
  get: () => props.recoveryFileName,
  set: (value: string) => emit('update:recoveryFileName', value),
})
</script>

<template>
  <section class="relative flex h-full flex-col overflow-hidden card-soft ghost-border shadow-ambient">
    <transition name="fade">
      <div
        v-if="!hasActiveFile"
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
        v-if="hasActiveFile && isMissingFile"
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
              v-model="recoveryFileNameModel"
              class="w-full rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(76,73,204,0.12)]"
              placeholder="输入恢复文件名"
              @keyup.enter="emit('recover-missing-file')"
            />

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="btn-primary !rounded-2xl !px-4 !py-2.5 text-sm"
                :disabled="!recoveryFileName.trim()"
                @click="emit('recover-missing-file')"
              >
                <span class="material-symbols-outlined text-base">save</span>
                <span>另存为新文件</span>
              </button>

              <button
                type="button"
                class="flex items-center gap-2 rounded-2xl bg-surface-container px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!hasAlternativeFiles"
                @click="emit('open-other-file')"
              >
                <span class="material-symbols-outlined text-base">folder_open</span>
                <span>打开其他文件</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <slot name="toolbar" />

    <div
      class="flex-1 w-full overflow-hidden bg-transparent transition-opacity duration-300"
      :class="{ 'opacity-0': !hasActiveFile }"
    >
      <slot />
    </div>
  </section>
</template>
