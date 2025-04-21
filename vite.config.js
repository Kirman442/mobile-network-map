import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm"
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  base: "/mobile-network-map/",
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
  ],
  worker: {
    plugins: () => [
      wasm(),
      topLevelAwait()
    ],
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['parquet-wasm', 'apache-arrow']
  },
  build: {
    chunkSizeWarningLimit: 1500,
    target: 'esnext',
    sourcemap: true
  }
})