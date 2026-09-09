import { describe, expect, it } from 'vitest'
import { parsePhotonResponse, searchPhoton } from './photon.ts'

const migros = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [8.5442, 47.4108] },
  properties: {
    osm_id: 3_450_447,
    osm_type: 'N',
    osm_key: 'shop',
    osm_value: 'supermarket',
    name: 'Migros',
    street: 'Schaffhauserstrasse',
    housenumber: '361',
    postcode: '8050',
    city: 'Zürich',
    state: 'Zürich',
    country: 'Switzerland',
    countrycode: 'CH',
  },
}

const zurich = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [8.5417, 47.3769] },
  properties: {
    osm_id: 1_682_248,
    osm_type: 'R',
    osm_key: 'place',
    osm_value: 'city',
    name: 'Zürich',
    state: 'Zürich',
    country: 'Switzerland',
    countrycode: 'ch',
    extent: [8.448, 47.4348, 8.6255, 47.3203],
  },
}

describe('parsePhotonResponse', () => {
  it('maps a shop feature with a full address', () => {
    const [target] = parsePhotonResponse({ type: 'FeatureCollection', features: [migros] })
    expect(target).toMatchObject({
      id: 'N:3450447',
      osmKey: 'shop',
      osmValue: 'supermarket',
      name: 'Migros',
      label: 'Schaffhauserstrasse 361, 8050 Zürich, Switzerland',
      countryCode: 'CH',
      position: [8.5442, 47.4108],
    })
    expect(target.extent).toBeUndefined()
  })

  it('keeps extents, upper-cases country codes and drops duplicate state names', () => {
    const [target] = parsePhotonResponse({ features: [zurich] })
    expect(target.countryCode).toBe('CH')
    expect(target.extent).toEqual([8.448, 47.4348, 8.6255, 47.3203])
    expect(target.label).toBe('Switzerland')
  })

  it('falls back to the address when a feature has no name', () => {
    const feature = { ...migros, properties: { ...migros.properties, name: undefined } }
    const [target] = parsePhotonResponse({ features: [feature] })
    expect(target.name).toBe('Schaffhauserstrasse 361')
    expect(target.label).toBe('8050 Zürich, Switzerland')
  })

  it('rejects malformed features rather than inventing positions', () => {
    const broken = [
      { geometry: { coordinates: ['8.5', 47] }, properties: {} },
      { geometry: { coordinates: [200, 47] }, properties: {} },
      { properties: { name: 'nowhere' } },
      null,
    ]
    expect(parsePhotonResponse({ features: broken })).toEqual([])
    expect(parsePhotonResponse(null)).toEqual([])
    expect(parsePhotonResponse({ features: 'nope' })).toEqual([])
  })
})

describe('searchPhoton', () => {
  it('builds the request and parses the response', async () => {
    const calls: string[] = []
    const fakeFetch = (async (input: URL | RequestInfo) => {
      calls.push(String(input))
      return new Response(JSON.stringify({ features: [migros] }), { status: 200 })
    }) as typeof fetch
    const targets = await searchPhoton('  migros oerlikon ', { fetch: fakeFetch, limit: 3 })
    expect(targets).toHaveLength(1)
    expect(calls[0]).toBe('https://photon.komoot.io/api/?q=migros+oerlikon&limit=3&lang=en')
  })

  it('short-circuits blank queries without a request', async () => {
    const fakeFetch = (async () => {
      throw new Error('should not be called')
    }) as typeof fetch
    expect(await searchPhoton('   ', { fetch: fakeFetch })).toEqual([])
  })

  it('surfaces HTTP failures', async () => {
    const fakeFetch = (async () => new Response('', { status: 503 })) as typeof fetch
    await expect(searchPhoton('bern', { fetch: fakeFetch })).rejects.toThrow('503')
  })
})
