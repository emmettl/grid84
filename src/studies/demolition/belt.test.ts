import { describe, expect, it } from 'vitest'
import { beltArithmetic, demolitionBelt } from './belt.ts'

describe('the demolition belt', () => {
  const s = demolitionBelt()
  it('puts every weapon on the defender\'s own ground, as a surface burst', () => {
    const a = beltArithmetic()
    expect(a.emplacements).toBe(15)
    expect(a.totalKt).toBe(87)
    const effects = s.entities.filter((e) => e.kind === 'effect')
    expect(effects).toHaveLength(a.emplacements)
    expect(effects.every((e) => e.kind === 'effect' && e.burst === 'surface')).toBe(true)
    expect(effects.every((e) => e.kind === 'effect' && e.fallout)).toBe(true)
    expect(s.defaultBurst).toBe('surface')
  })
  it('emplaces the belt before the war and fires it from east to west as the advance arrives', () => {
    const sites = s.entities.filter((e) => e.kind === 'site')
    expect(sites).toHaveLength(15)
    expect(sites.every((e) => e.kind === 'site' && (e.appearsAt ?? 0) < 0)).toBe(true)
    // Each emplacement mark goes when its weapon fires.
    for (const site of sites) {
      if (site.kind !== 'site') continue
      const fired = s.entities.find((e) => e.kind === 'effect' && e.id === site.id.replace('emplace-', 'fire-'))
      expect(fired && fired.kind === 'effect' ? fired.time : -1).toBe(site.vanishesAt)
    }
    const effects = s.entities.filter((e) => e.kind === 'effect')
    const byTime = [...effects].sort((a, b) => (a.kind === 'effect' && b.kind === 'effect' ? a.time - b.time : 0))
    const lons = byTime.map((e) => (e.kind === 'effect' ? e.center[0] : 0))
    expect(lons[0]).toBeGreaterThan(lons[lons.length - 1])
  })
  it('says the plumes run over the country it defends, and what it does not model', () => {
    expect(s.omissions.some((o) => /not published/.test(o))).toBe(true)
    expect(s.omissions.some((o) => /Blue Peacock/.test(o))).toBe(true)
    expect(s.omissions.some((o) => /Cratering/.test(o))).toBe(true)
    expect(s.events.some((e) => /NORTH-EAST/.test(e.text))).toBe(true)
  })
})
