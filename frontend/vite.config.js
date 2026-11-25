import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  logLevel: "error",
  define: {
    global: "globalThis",
  },
  build: {
    target: ["chrome109", "edge109", "firefox115", "safari15"],
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (
            normalized.includes("/node_modules/gsap/") ||
            normalized.includes("/node_modules/lenis/")
          ) {
            return "motion-vendor";
          }
        },
      },
    },
  },
  optimizeDeps: {
    rolldownOptions: {
      transform: { define: { global: "globalThis" } },
    },
  },
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
});
