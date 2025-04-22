import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  base: "/mobile-network-map",
  plugins: [
    react(),
    wasm()
  ],
  optimizeDeps: {
    exclude: ['parquet-wasm'] // Добавьте эту строку
  },
})