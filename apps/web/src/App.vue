<script setup lang="ts">
import Sidebar from "@desktop/components/Sidebar.vue";
import EditorPane from "@desktop/components/EditorPane.vue";
import PreviewPane from "@desktop/components/PreviewPane.vue";
import { useResumeStore } from "@resume-store";
import WebTopNavBar from "./components/WebTopNavBar.vue";

const store = useResumeStore();

void store.loadTemplates();
</script>

<template>
  <div class="bg-surface text-on-surface antialiased font-['Manrope'] w-full h-screen relative flex overflow-hidden">
    <Sidebar mode="outline-only" />

    <div class="flex-1 flex flex-col h-full overflow-hidden bg-surface relative transition-all duration-700">
      <WebTopNavBar />

      <main class="flex-1 flex min-w-0 overflow-hidden px-6 pb-6 pt-2 gap-4">
        <EditorPane class="web-editor-pane w-[40%] min-w-0" />
        <PreviewPane class="web-preview-shell w-[60%] min-w-0" />
      </main>
    </div>
  </div>
</template>
