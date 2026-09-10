import china from '../../data/winter/china-2023.json'
import europe from '../../data/winter/europe-2023.json'
import russia from '../../data/winter/russia-2023.json'
import subcontinent from '../../data/winter/subcontinent-2023.json'
import us from '../../data/winter/us-2023.json'

/**
 * Where the weapons land, so that the cold has somewhere to have come from.
 *
 * The winter model does not need target coordinates: it works in latitude
 * bands and takes the soot as a mass. These points are here to be looked
 * at. They are the most populous cells of the HYDE 2023 population grid
 * inside each region, one city to a cell, by the same rule the studies use
 * where no target list is in the record — which is also, near enough, the
 * rule Toon's group used to pick the targets whose populations set the
 * fuel loading.
 */

interface UrbanList {
  name: string
  year: number
  rule: string
  source: string
  targets: Array<{ lon: number; lat: number; population: number }>
}

const LISTS: Record<string, UrbanList> = {
  subcontinent: subcontinent as UrbanList,
  us: us as UrbanList,
  europe: europe as UrbanList,
  russia: russia as UrbanList,
  china: china as UrbanList,
}

/** Which cities burn in which case, and how many of them. */
const CASE_TARGETS: Record<string, Array<{ list: keyof typeof LISTS; count: number }>> = {
  'regional-5': [{ list: 'subcontinent', count: 100 }],
  'regional-16': [{ list: 'subcontinent', count: 250 }],
  'regional-27': [{ list: 'subcontinent', count: 250 }],
  'regional-37': [{ list: 'subcontinent', count: 250 }],
  'regional-47': [{ list: 'subcontinent', count: 250 }],
  'global-150': [
    { list: 'us', count: 250 },
    { list: 'russia', count: 250 },
    { list: 'europe', count: 220 },
    { list: 'china', count: 200 },
  ],
}

export function impactPoints(caseId: string): GeoJSON.FeatureCollection {
  const plan = CASE_TARGETS[caseId] ?? CASE_TARGETS['global-150']
  const features: GeoJSON.Feature[] = []
  for (const part of plan) {
    const list = LISTS[part.list]
    for (const t of list.targets.slice(0, part.count)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: { population: t.population, region: list.name },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** How many cities the marks stand for, and how many people were in them. */
export function impactSummary(caseId: string): { cities: number; population: number; regions: string[] } {
  const fc = impactPoints(caseId)
  const regions = [...new Set(fc.features.map((f) => String(f.properties?.region ?? '')))]
  return {
    cities: fc.features.length,
    population: fc.features.reduce((a, f) => a + Number(f.properties?.population ?? 0), 0),
    regions,
  }
}
