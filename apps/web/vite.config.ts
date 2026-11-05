import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = process.env.HIJACK_BACKEND ?? 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': { target: backend },
      '/health': { target: backend },
      '/ws': { target: backend.replace(/^http/, 'ws'), ws: true },
    },
  },
})
