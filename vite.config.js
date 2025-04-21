import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";



// https://vite.dev/config/
export default defineConfig({
  base: "/mobile-network-map/",
  plugins: [
    react(),
    wasm()
  ],
  worker: {
    plugins: [
      wasm()
      // topLevelAwait()
    ]
  },
  optimizeDeps: {
    exclude: ['parquet-wasm']
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
})
