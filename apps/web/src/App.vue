<script setup lang="ts">
import TopNavBar from "@desktop/components/TopNavBar.vue";
import EditorPane from "@desktop/components/EditorPane.vue";
import PreviewPane from "@desktop/components/PreviewPane.vue";
import { useResumeStore } from "@resume-store";

const store = useResumeStore();
void store.loadTemplates();
</script>

<template>
  <div class="bg-surface text-on-surface antialiased w-full h-screen relative flex overflow-hidden font-['Manrope']">
    <div class="flex-1 flex flex-col h-full overflow-hidden bg-surface relative transition-all duration-700">
      <TopNavBar />
      <main class="flex-1 flex overflow-hidden px-6 pb-6 pt-2 gap-4">
        <EditorPane class="w-[40%]" />
        <PreviewPane class="w-[60%]" />
      </main>
    </div>
  </div>
</template>
