import { describe, expect, it } from 'vitest'
import { osmRefOf, parseOsmRef, parseStrikeHash, strikeHash, targetFromNominatim } from './lookup.ts'

describe('shareable strikes', () => {
  it('round-trips a target and the console choices through the hash', () => {
    const t = targetFromNominatim({ osm_type: 'relation', osm_id: 1682248, lat: '47.3744489', lon: '8.5410422', category: 'boundary', type: 'administrative', name: 'Zürich', boundingbox: ['47.3202184', '47.4346650', '8.4480182', '8.6254529'], address: { city: 'Zürich', state: 'Zürich', country: 'Schweiz', country_code: 'ch' } })
    expect(t).not.toBeNull()
    expect(t!.id).toBe('R:1682248')
    expect(t!.countryCode).toBe('CH')
    expect(t!.osmKey).toBe('place')
    expect(t!.extent).toEqual([8.4480182, 47.434665, 8.6254529, 47.3202184])
    expect(osmRefOf(t!)).toBe('R1682248')
    const hash = strikeHash(t!, { adversary: 'fr', delivery: 'aircraft' })
    expect(hash).toBe('#/atlas/strike/R1682248?adversary=fr&delivery=aircraft')
    expect(parseStrikeHash(hash!)).toEqual({ ref: 'R1682248', adversary: 'fr', delivery: 'aircraft', loading: null })
    expect(strikeHash(t!, { adversary: null, delivery: 'best', loading: 'full' })).toBe('#/atlas/strike/R1682248?loading=full')
    expect(strikeHash(t!, { adversary: null, delivery: 'best' })).toBe('#/atlas/strike/R1682248')
    expect(parseStrikeHash('#/atlas/strike/n42')?.ref).toBe('N42')
    expect(parseStrikeHash('#/atlas')).toBeNull()
    expect(parseOsmRef('X1')).toBeNull()
  })
})
