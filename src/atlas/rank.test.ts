import { describe, expect, it } from 'vitest'
import { parsePhotonResponse, searchPhoton } from './photon.ts'
import { nameBonus, rankTargets, significanceOf } from './rank.ts'
import recorded from './__fixtures__/photon-responses.json'

/**
 * The fixtures are real responses from the public Photon instance, recorded on
 * 11 September 2026. They are here for two reasons: to hold the ranking
 * against the cases that motivated it, and to catch a schema change at the
 * geocoder before a release rather than after one — a field renamed upstream
 * shows up here as a parse that returns nothing.
 */
const responses = recorded as Record<string, unknown>
const targetsFor = (query: string) => parsePhotonResponse(responses[query])
const rankedFor = (query: string) => rankTargets(targetsFor(query), query)

describe('the geocoder contract', () => {
  it('parses every recorded response into targets with the fields the atlas needs', () => {
    for (const [query, json] of Object.entries(responses)) {
      const targets = parsePhotonResponse(json)
      expect(targets.length, `${query} parsed to nothing — has the schema changed?`).toBeGreaterThan(0)
      for (const t of targets) {
        expect(t.name.length, query).toBeGreaterThan(0)
        expect(t.osmKey, query).not.toBe('unknown')
        expect(Math.abs(t.position[0]), query).toBeLessThanOrEqual(180)
        expect(Math.abs(t.position[1]), query).toBeLessThanOrEqual(90)
        expect(t.countryCode, query).toMatch(/^[A-Z]{2}$/)
      }
    }
  })
})

describe('what a searcher meant', () => {
  /**
   * The case from the roadmap. Photon puts a guidepost — a signpost on a
   * pavement, carrying the name because it points at the station — above the
   * station itself, and it does so even though its name matches exactly.
   */
  it('puts Zürich Hauptbahnhof above the signpost that points at it', () => {
    const raw = targetsFor('Zürich HB')
    expect(raw[0].osmValue, 'the fixture is the case: Photon led with it').toBe('guidepost')

    const ranked = rankedFor('Zürich HB')
    expect(ranked[0].osmKey).toBe('railway')
    expect(ranked[0].osmValue).toBe('station')
    expect(ranked[0].name).toContain('Hauptbahnhof')
    // Nothing is hidden: the guidepost is still a candidate, just not the first.
    expect(ranked).toHaveLength(raw.length)
    expect(ranked.map((t) => t.osmValue)).toContain('guidepost')
  })

  it('puts the aerodrome above the unpopulated locality of the same name', () => {
    const ranked = rankedFor('Heathrow')
    expect(ranked[0].osmKey).toBe('aeroway')
    expect(ranked[0].osmValue).toBe('aerodrome')
  })

  it('puts the military complex above the zoo named after the same mountain', () => {
    const ranked = rankedFor('Cheyenne Mountain')
    const zoo = ranked.findIndex((t) => t.osmValue === 'zoo')
    const complex = ranked.findIndex((t) => t.osmKey === 'landuse' && t.osmValue === 'military')
    expect(complex).toBeGreaterThanOrEqual(0)
    expect(complex, 'the NORAD complex should outrank the zoo').toBeLessThan(zoo)
  })

  it('leaves a query with nothing to disambiguate in the order the geocoder gave it', () => {
    const raw = targetsFor('Hamburg')
    const ranked = rankTargets(raw, 'Hamburg')
    // The city is already first and stays first; the rest keep Photon's relevance.
    expect(ranked[0].name).toBe(raw[0].name)
  })

  it('classifies the families it has to get right', () => {
    expect(significanceOf({ osmKey: 'information', osmValue: 'guidepost' })).toBe('fixture')
    expect(significanceOf({ osmKey: 'amenity', osmValue: 'taxi' })).toBe('fixture')
    expect(significanceOf({ osmKey: 'place', osmValue: 'locality' })).toBe('fixture')
    expect(significanceOf({ osmKey: 'aeroway', osmValue: 'aerodrome' })).toBe('principal')
    expect(significanceOf({ osmKey: 'landuse', osmValue: 'military' })).toBe('principal')
    expect(significanceOf({ osmKey: 'military', osmValue: 'naval_base' })).toBe('principal')
    expect(significanceOf({ osmKey: 'railway', osmValue: 'station' })).toBe('substantial')
    expect(significanceOf({ osmKey: 'building', osmValue: 'yes' })).toBe('ordinary')
  })

  it('scores the name as a tie-break and not as a ranking of its own', () => {
    // An exact match is worth more than a partial one...
    expect(nameBonus({ name: 'Heathrow' }, 'Heathrow')).toBeGreaterThan(nameBonus({ name: 'Heathrow Airport' }, 'Heathrow'))
    // ...but never enough to lift a fixture over a principal feature.
    const fixture = { osmKey: 'information', osmValue: 'guidepost', name: 'Heathrow' }
    const principal = { osmKey: 'aeroway', osmValue: 'aerodrome', name: 'Heathrow Airport' }
    const ranked = rankTargets([fixture, principal].map((t, i) => ({ ...t, id: `x${i}`, osmId: i, osmType: 'N', label: '', countryCode: 'GB', position: [0, 0] as [number, number] })), 'Heathrow')
    expect(ranked[0].osmValue).toBe('aerodrome')
  })

  it('is stable, so an unranked pair keeps the order it arrived in', () => {
    const same = ['first', 'second', 'third'].map((name, i) => ({
      id: `s${i}`, osmId: i, osmType: 'N', osmKey: 'building', osmValue: 'yes',
      name, label: '', countryCode: 'GB', position: [0, 0] as [number, number],
    }))
    expect(rankTargets(same, 'nothing in common').map((t) => t.name)).toEqual(['first', 'second', 'third'])
  })
})

describe('the search itself', () => {
  it('ranks what it returns, and asks the geocoder for English', async () => {
    let asked: URL | null = null
    const fakeFetch = (async (url: URL) => {
      asked = url
      return { ok: true, json: async () => responses['Zürich HB'] } as Response
    }) as unknown as typeof fetch
    const found = await searchPhoton('Zürich HB', { fetch: fakeFetch })
    expect(found[0].osmValue).toBe('station')
    expect(asked!.searchParams.get('lang')).toBe('en')
    expect(asked!.searchParams.get('q')).toBe('Zürich HB')
  })

  it('throws with the status when the geocoder refuses', async () => {
    const fakeFetch = (async () => ({ ok: false, status: 503 }) as Response) as unknown as typeof fetch
    await expect(searchPhoton('anywhere', { fetch: fakeFetch })).rejects.toThrow('503')
  })
})
