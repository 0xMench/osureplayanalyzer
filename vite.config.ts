import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static SPA. base: './' keeps asset paths relative so the build can be
// served from any subdirectory of a static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2020' },
})
