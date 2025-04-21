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
  optimizeDeps: {
    exclude: ['parquet-wasm'] // Добавьте эту строку
  },
  chunkSizeWarningLimit: 1000,
})
