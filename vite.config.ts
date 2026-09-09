import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // MapLibre 6 spawns its worker from a sibling module URL; the dep optimizer
  // pre-bundles the main entry without that file, so the worker never answers.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  base: './',
  build: { manifest: true, target: 'es2022' },
})
