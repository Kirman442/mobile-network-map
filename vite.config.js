import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  base: "/mobile-network-map/",
  plugins: [
    react(),
    wasm(),
    topLevelAwait({
      // Явное указание для воркеров
      promiseExportName: '__tla',
      promiseImportName: i => `__tla_${i}`
    })
  ],
  worker: {
    plugins: [
      wasm(),
      topLevelAwait()
    ],
    format: 'es' // Явно указываем ES модули
  },
  optimizeDeps: {
    exclude: ['parquet-wasm']
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 0, // Не инлайнить WASM как base64
    rollupOptions: {
      output: {
        manualChunks: {
          'parquet-wasm': ['parquet-wasm']
        }
      }
    }
  }
});