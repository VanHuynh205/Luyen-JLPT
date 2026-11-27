import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const require = createRequire(import.meta.url);
const pwaRequire = createRequire(require.resolve("vite-plugin-pwa/package.json"));
const workboxWindowDir = path.dirname(
  pwaRequire.resolve("workbox-window/package.json"),
);
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
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        name: "Ôn JLPT N4",
        short_name: "Ôn JLPT",
        lang: "vi",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F9F6F1",
        theme_color: "#F9F6F1",
        icons: [
          {
            src: "/icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,woff2,ico,png,svg}",
          "packs/index.json",
          "packs/n4/1.1.0/*.json",
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/packs\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\//i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: "workbox-window",
        replacement: workboxWindowDir,
      },
    ],
  },
});
