import { describe, expect, it } from 'vitest'
import { seventyTwoMinutes } from './scenario.ts'

describe('seventy-two minutes', () => {
  it('runs the film act with one missile on a nineteen-minute clock and the interceptors as the variant says', () => {
    const film = seventyTwoMinutes('film')
    const tracks = film.entities.filter((e) => e.kind === 'track')
    const effects = film.entities.filter((e) => e.kind === 'effect')
    expect(tracks.map((t) => t.id)).toContain('film-icbm')
    // As filmed: the first interceptor never leaves the silo, the second misses, the warhead arrives.
    expect(tracks.find((t) => t.id === 'film-gbi-1')?.designation).toMatch(/FAILED TO LEAVE/)
    expect(tracks.find((t) => t.id === 'film-gbi-2')?.designation).toMatch(/MISS/)
    expect(effects).toHaveLength(1)
    expect(effects[0].kind === 'effect' && effects[0].time).toBeCloseTo(19 * 60, 0)
    // The claim: a hit, and nothing arrives.
    const claim = seventyTwoMinutes('claim')
    expect(claim.entities.filter((e) => e.kind === 'effect')).toHaveLength(0)
    const icbm = claim.entities.find((e) => e.id === 'film-icbm')
    expect(icbm?.designation).toMatch(/INTERCEPTED/)
    expect(icbm?.kind === 'track' && icbm.track.end).toBeLessThan(19 * 60)
  })

  it('enacts the book with three strikes, the Far East overflight, and the plant as a surface burst', () => {
    const book = seventyTwoMinutes('book')
    const ids = book.entities.map((e) => e.id)
    expect(ids).toContain('book-hwasong-e')
    expect(ids).toContain('book-slbm-e')
    const plant = book.entities.find((e) => e.id === 'book-slbm-e')
    expect(plant?.kind === 'effect' && plant.burst).toBe('surface')
    const overflight = book.entities.find((e) => e.id === 'overflight')
    expect(overflight).toBeDefined()
    expect(overflight?.designation).toMatch(/CROSS RUSSIAN TERRITORY/)
    const prefixes = { 'us-nk': 0, ru: 0, 'us-ru': 0 }
    for (const e of book.entities) {
      if (e.kind !== 'effect') continue
      if (e.id.startsWith('us-nk-')) prefixes['us-nk'] += 1
      else if (e.id.startsWith('ru-')) prefixes.ru += 1
      else if (e.id.startsWith('us-ru-')) prefixes['us-ru'] += 1
    }
    expect(prefixes['us-nk']).toBeGreaterThan(10)
    expect(prefixes.ru).toBeGreaterThan(200)
    expect(prefixes['us-ru']).toBeGreaterThan(200)
    // Four misses in the book: the events say how rare that is at the test record.
    expect(book.events.some((ev) => /FOUR INTERCEPTORS MISS/.test(ev.text))).toBe(true)
    expect(book.populationGrid).toBe('ghsl/popc_2025')
  })
})
