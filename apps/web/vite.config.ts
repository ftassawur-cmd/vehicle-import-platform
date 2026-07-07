import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Monorepo wiring, no publish step required:
//  @jsl/calc-engine/browser → the pure TS engine (Vite compiles it in-graph)
//  @config                  → the ten v1 rule-set seeds shared with the API
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": r("./src"),
      "@config": r("../../config"),
      "@jsl/calc-engine/browser": r("../../packages/calc-engine/src/browser.ts"),
    },
  },
  server: {
    fs: { allow: [r("../..")] }, // serve engine + config from the workspace root
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
        },
      },
    },
  },
})
