import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/", // /mobile-network-map
  plugins: [
    react()
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
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
    assetsInlineLimit: 0,
  },
  // Transferable ArrayBuffers do not require cross-origin isolation.
});
