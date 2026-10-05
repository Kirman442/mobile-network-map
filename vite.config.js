import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm"
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  base: "/", // /mobile-network-map
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
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['parquet-wasm'],
    include: ['apache-arrow']
  },
  build: {
    target: 'esnext',
    // target: 'es2020',
    chunkSizeWarningLimit: 1800,
    copyPublicDir: true,
    modulePreload: {
      polyfill: true,
    },
    assetsInlineLimit: 0, // Не инлайнить WASM как base64
  },
  // Transferable ArrayBuffers do not require cross-origin isolation.
});
