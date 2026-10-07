import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // amazon-chime-sdk-js expects the Node global `global`, which browsers don't have.
  define: { global: 'globalThis' },
  server: { port: 5178 },
})
