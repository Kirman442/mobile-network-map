import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from 'vite-plugin-top-level-await';



export default defineConfig({
  base: "/mobile-network-map/",
  assetsInclude: [
    '**/*.wasm', // Включаем все .wasm файлы по умолчанию (возможно, уже есть)
    // Явно включаем конкретный wasm файл из parquet-wasm, если он не включается автоматически
    '**/node_modules/parquet-wasm/esm/parquet_wasm_bg.wasm'
  ],
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
  ],
  worker: {
    plugins: () => [
      wasm(),
      topLevelAwait()
    ]
  },
  optimizeDeps: {
    exclude: ['parquet-wasm', 'apache-arrow']
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});