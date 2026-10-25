/**
 * Where a study's grid lives. A bare name is a HYDE grid under data/hyde; an
 * absolute URL is used as given; a path such as ghsl/popc_1985 is looked up
 * in the grids index, which is where `scripts/point-grids-at.py` records
 * whether the tiles are local or in the bucket.
 */
export async function resolveGridBase(grid: string): Promise<string> {
  if (/^https?:/.test(grid)) return grid
  const local = (path: string) => new URL(`${import.meta.env.BASE_URL}data/${path}`, document.baseURI).href
  if (!grid.includes('/')) return local(`hyde/${grid}`)
  const name = grid.split('/').pop() ?? grid
  try {
    const index = (await fetch(local('hyde/index.json')).then((r) => (r.ok ? r.json() : null))) as { grids: Array<{ name: string; path?: string; fallback?: string }> } | null
    const entry = index?.grids.find((g) => g.name === name)
    if (entry?.path) {
      const primary = /^https?:/.test(entry.path) ? entry.path : local(entry.path)
      if (!entry.fallback) return primary
      // A bucket behind a young domain may not resolve everywhere yet; if its summary does not answer, the bucket's own URL does.
      try {
        const head = await fetch(`${primary}.json`, { method: 'HEAD' })
        if (head.ok) return primary
      } catch {
        // fall through to the fallback
      }
      console.warn(`grid ${name}: ${primary} did not answer; using ${entry.fallback}`)
      return entry.fallback
    }
  } catch {
    // fall through to the local path
  }
  return local(grid)
}
