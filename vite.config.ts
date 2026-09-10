import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * What the published site carries from public/data, and what it does not.
 *
 * The GHSL tiles under public/data/ghsl are a local working copy for the
 * tiling scripts and offline development; the site fetches them from the R2
 * bucket the grids index names, so the build drops them (half a gigabyte and
 * a thousand files). The synthetic HYDE specimen is a development stand-in
 * and never ships. HYDE years that are prepared locally but not committed
 * are absent from a CI checkout, so the shipped index lists only the grids
 * whose files are in the build: the lab then offers what is there rather
 * than a year that would fail to load.
 */
function publishedData(): Plugin {
  return {
    name: 'grid84-published-data',
    apply: 'build',
    closeBundle() {
      rmSync('dist/data/ghsl', { recursive: true, force: true })
      rmSync('dist/data/hyde/specimen.json', { force: true })
      rmSync('dist/data/hyde/specimen.bin.gz', { force: true })
      const indexPath = 'dist/data/hyde/index.json'
      if (!existsSync(indexPath)) return
      const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { grids: Array<{ name: string; path?: string }> }
      const shipped = index.grids.filter((g) => (g.path ? /^https?:/.test(g.path) : existsSync(`dist/data/hyde/${g.name}.bin.gz`)))
      writeFileSync(indexPath, JSON.stringify({ ...index, grids: shipped }, null, 2) + '\n')
      const dropped = index.grids.length - shipped.length
      if (dropped > 0) console.log(`grids index: ${dropped} local-only grid(s) left out of the published index`)
    },
  }
}

export default defineConfig({
  plugins: [react(), publishedData()],
  // MapLibre 6 spawns its worker from a sibling module URL; the dep optimizer
  // pre-bundles the main entry without that file, so the worker never answers.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  base: './',
  // MapLibre alone is most of the bundle; the warning threshold sits above it.
  build: { manifest: true, target: 'es2022', chunkSizeWarningLimit: 2600 },
})
