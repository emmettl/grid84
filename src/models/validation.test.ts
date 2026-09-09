import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { thirdDegreeBurnRadiusMetres } from './blast.ts'
import { applyBands, bandPopulations, OTA_BANDS, outcome, overpressureRadiusForPsi } from './casualties.ts'
import { exposure, type PopulationGrid } from './exposure.ts'
import { HIROSHIMA, NAGASAKI } from './validation-cases.ts'
import { areaWeightedFraction, otaFatalFractionAt, planarEstimate, radiusComparisons, recordedFractionAt } from './validation.ts'

describe('Hiroshima: planar radii against the recorded damage', () => {
  it('puts the 5 psi and fire radii within 15 percent of the survey distances', () => {
    const rows = radiusComparisons(HIROSHIMA, 15)
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]))
    expect(byLabel['5 psi against complete destruction'].ratio).toBeGreaterThan(0.95)
    expect(byLabel['5 psi against complete destruction'].ratio).toBeLessThan(1.15)
    expect(byLabel['5 psi against steel-frame severe damage'].ratio).toBeGreaterThan(0.9)
    expect(byLabel['5 psi against steel-frame severe damage'].ratio).toBeLessThan(1.1)
    expect(byLabel['Third-degree burn radius against burned-area equivalent radius'].ratio).toBeGreaterThan(0.95)
    expect(byLabel['Third-degree burn radius against burned-area equivalent radius'].ratio).toBeLessThan(1.15)
  })
})

describe('Hiroshima: OTA fatality fractions against the mortality-by-distance table', () => {
  it('agrees on the area-weighted fraction inside the 5 psi radius within a tenth', () => {
    const r5 = overpressureRadiusForPsi(15, 5)
    const model = areaWeightedFraction((m) => otaFatalFractionAt(15, m), r5)
    const recorded = areaWeightedFraction((m) => recordedFractionAt(HIROSHIMA.mortalityByDistance!.zones, m), r5)
    expect(Math.abs(model - recorded)).toBeLessThan(0.1)
    expect(recorded).toBeGreaterThan(0.5)
  })
  it('is a step function crossing the recorded slope: over near the centre, under at about 1 km, over again at 1.5 to 1.75 km, under just beyond', () => {
    const recorded = (m: number) => recordedFractionAt(HIROSHIMA.mortalityByDistance!.zones, m)
    expect(otaFatalFractionAt(15, 200)).toBeGreaterThan(recorded(200))
    expect(otaFatalFractionAt(15, 1_100)).toBeLessThan(recorded(1_100))
    expect(otaFatalFractionAt(15, 1_700)).toBeGreaterThan(recorded(1_700))
    expect(otaFatalFractionAt(15, 1_900)).toBeLessThan(recorded(1_900))
  })

  it('prints the comparison table for the validation document', () => {
    const lines: string[] = []
    for (const r of radiusComparisons(HIROSHIMA, 15)) lines.push(`H radius | ${r.label} | model ${(r.modelMetres / 1000).toFixed(2)} km | recorded ${(r.recordedMetres / 1000).toFixed(2)} km | ratio ${r.ratio.toFixed(2)}`)
    for (const r of radiusComparisons(NAGASAKI, 21)) lines.push(`N radius | ${r.label} | model ${(r.modelMetres / 1000).toFixed(2)} km | recorded ${(r.recordedMetres / 1000).toFixed(2)} km | ratio ${r.ratio.toFixed(2)}`)
    for (const z of HIROSHIMA.mortalityByDistance!.zones) {
      const mid = (z.from + z.to) / 2
      lines.push(`H fraction | ${Math.round(z.from)}–${Math.round(z.to)} m | recorded ${(z.fraction * 100).toFixed(1)}% | OTA ${(otaFatalFractionAt(15, mid) * 100).toFixed(0)}%`)
    }
    const r5 = overpressureRadiusForPsi(15, 5)
    lines.push(`H weighted inside 5 psi (${(r5 / 1000).toFixed(2)} km) | model ${(areaWeightedFraction((m) => otaFatalFractionAt(15, m), r5) * 100).toFixed(1)}% | recorded ${(areaWeightedFraction((m) => recordedFractionAt(HIROSHIMA.mortalityByDistance!.zones, m), r5) * 100).toFixed(1)}%`)
    for (const [pop, label] of [[245_000, 'USSBS 245,000'], [255_000, 'MED 255,000'], [345_000, 'RERF 340,000–350,000']] as const) {
      const e = planarEstimate(HIROSHIMA, pop, 15)!
      lines.push(`H planar | ${label} | density ${Math.round(e.densityPerKm2)}/km² | blast dead ${Math.round(e.blastDead)} | injured ${Math.round(e.blastInjured)} | fire dead ${Math.round(e.fireDead)}`)
    }
    const n = planarEstimate(NAGASAKI, 195_000, 21)!
    lines.push(`N planar | MED 195,000 | density ${Math.round(n.densityPerKm2)}/km² | blast dead ${Math.round(n.blastDead)} | injured ${Math.round(n.blastInjured)} | fire dead ${Math.round(n.fireDead)}`)
    console.log('\nVALIDATION TABLE\n' + lines.join('\n'))
    expect(lines.length).toBeGreaterThan(10)
  })
})

describe('Hiroshima: the planners’ method with the survey’s own density', () => {
  it('reproduces the immediate death and injury counts and Postol’s bound reproduces the end-of-1945 count', () => {
    const estimate = planarEstimate(HIROSHIMA, 255_000, 15)!
    // MED: 66,000 dead and 69,000 injured; USSBS: 70,000 to 80,000 dead.
    expect(estimate.blastDead).toBeGreaterThan(60_000)
    expect(estimate.blastDead).toBeLessThan(85_000)
    expect(estimate.blastInjured).toBeGreaterThan(55_000)
    expect(estimate.blastInjured).toBeLessThan(85_000)
    // City of Hiroshima: roughly 140,000 by 31 December 1945; RERF 90,000 to 166,000.
    expect(estimate.fireDead).toBeGreaterThan(110_000)
    expect(estimate.fireDead).toBeLessThan(166_000)
  })
})

describe('Nagasaki: the disc assumption fails where the record says terrain mattered', () => {
  it('overstates the dead by more than double when the built-up density is spread as a disc about the hypocentre', () => {
    const estimate = planarEstimate(NAGASAKI, 195_000, 21)!
    expect(estimate.blastDead).toBeGreaterThan(2 * 39_000)
  })
})

const GRID = 'public/data/hyde/popc_1940'
const gridPresent = existsSync(`${GRID}.bin.gz`)

describe.skipIf(!gridPresent)('HYDE 1940 at the scale of a 15 kt weapon', () => {
  const meta = gridPresent ? JSON.parse(readFileSync(`${GRID}.json`, 'utf8')) : null
  const grid: PopulationGrid | null = gridPresent
    ? {
        width: meta.width,
        height: meta.height,
        cellSize: meta.cellSize,
        west: meta.west,
        south: meta.south,
        counts: new Float32Array(gunzipSync(readFileSync(`${GRID}.bin.gz`)).buffer),
        source: { name: meta.dataset, year: meta.year, licence: meta.licence },
      }
    : null

  it('cannot resolve the city: fewer than half the recorded population lies within 5 km of the hypocentre', () => {
    const result = exposure(grid!, { center: HIROSHIMA.hypocentre, rings: [{ key: 'r5', radius: 5_000 }] })
    expect(result.within.r5).toBeLessThan(0.5 * 255_000)
    expect(result.within.r5).toBeGreaterThan(50_000)
  })

  it('therefore understates the dead by several times when the grid stands in for the survey density', () => {
    for (const c of [HIROSHIMA, NAGASAKI]) {
      const y = c.id === 'hiroshima' ? 15 : 21
      const rings = [...OTA_BANDS.map((b) => ({ key: b.key, radius: overpressureRadiusForPsi(y, b.minPsi) })), { key: 'fire', radius: thirdDegreeBurnRadiusMetres(y) }]
      const result = exposure(grid!, { center: c.hypocentre, rings })
      const within5 = exposure(grid!, { center: c.hypocentre, rings: [{ key: 'r5', radius: 5_000 }] }).within.r5
      const o = outcome(applyBands(bandPopulations(result.within)), result.within.fire)
      console.log(`HYDE 1940 | ${c.name} | within 5 km ${Math.round(within5)} | blast dead ${Math.round(o.blast.fatal)} | injured ${Math.round(o.blast.injured)} | fire dead ${Math.round(o.fire.fatal)}`)
      if (c.id === 'hiroshima') expect(o.blast.fatal).toBeLessThan(66_000 / 2)
    }
  })
})
