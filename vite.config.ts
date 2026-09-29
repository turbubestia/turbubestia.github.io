import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // User site (turbubestia.github.io) is served at the domain root.
  base: '/',
  plugins: [react(), tailwindcss()],
})
