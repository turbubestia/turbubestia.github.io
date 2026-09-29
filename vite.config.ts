import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages (repo: turbubestia.github.io)
  base: '/turbubestia.github.io/',
  plugins: [react(), tailwindcss()],
})
