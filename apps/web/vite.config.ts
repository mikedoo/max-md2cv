import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      "@web": resolve(currentDir, "./src"),
      "@desktop": resolve(currentDir, "../../src"),
      "@resume-core": resolve(currentDir, "../../packages/resume-core/src"),
      "@resume-store": resolve(currentDir, "./src/stores/resume.ts"),
    },
  },
  server: {
    port: 4173,
    strictPort: true,
    fs: {
      allow: [resolve(currentDir, "../..")],
    },
  },
});
