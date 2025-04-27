import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm"
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  base: "/mobile-network-map",
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
    // format: 'iife'
  },
  optimizeDeps: {
    exclude: ['parquet-wasm'],
    include: ['apache-arrow']
  },
  build: {
    // minify: false,
    target: 'esnext',
    // target: 'es2020',
    chunkSizeWarningLimit: 1800,
    copyPublicDir: true,
    modulePreload: {
      polyfill: true,
    },
    assetsInlineLimit: 0, // Не инлайнить WASM как base64
    rollupOptions: {
      output: {
        manualChunks: {
          'parquet-wasm': ['parquet-wasm']
        }
      }
    }
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});