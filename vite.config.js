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
  resolve: {
    alias: {
      // Если есть проблемы с путями к WASM файлам
      'parquet-wasm': 'parquet-wasm'
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 0, // Важно для WASM
    target: 'esnext', // Для поддержки top-level await
    sourcemap: true, // Для отладки
    emptyOutDir: true, // Очищаем директорию сборки
    rollupOptions: {
      output: {
        manualChunks: {
          // Выделяем библиотеки в отдельные чанки
          'parquet-wasm': ['parquet-wasm'],
          'apache-arrow': ['apache-arrow']
        }
      }
    }
  }
})