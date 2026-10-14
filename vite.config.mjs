import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration — Seereon HRMS web (React SPA).
// `npm run dev` serves on :3000 with HMR; `npm run build` emits a static bundle in dist/
// that any web server can host (SPA fallback to index.html required — see README).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 3000 },
  preview: { port: 3000 },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
});
