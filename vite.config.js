import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm"
import topLevelAwait from 'vite-plugin-top-level-await'
import { resolve } from 'path'

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
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 0,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
})