import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9873',
        changeOrigin: true
      },
      '/offers': {
        target: 'http://localhost:9873',
        changeOrigin: true
      }
    }
  }
})
