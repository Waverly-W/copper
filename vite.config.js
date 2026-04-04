import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks (id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor'
          }

          if (id.includes('/@icon-park/react/')) {
            return 'icon-park-vendor'
          }

          if (id.includes('/pinyin-pro/')) {
            return 'search-vendor'
          }

          if (id.includes('/segmentit/') || id.includes('/linkify-it/')) {
            return 'analysis-vendor'
          }
        }
      }
    }
  }
})
