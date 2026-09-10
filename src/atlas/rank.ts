import type { AtlasTarget } from './target.ts'

/**
 * Ranking the geocoder's candidates.
 *
 * Photon returns what matches the string, in its own order, and that order is
 * often wrong for this instrument in a specific and repeatable way: a thing
 * that exists to *point at* another thing carries the name and comes first.
 * Searching "Zürich HB" returns a guidepost — a signpost on a pavement —
 * ahead of Zürich Hauptbahnhof. "Heathrow" returns an unpopulated locality
 * ahead of the airport. "Cheyenne Mountain" returns a zoo ahead of the NORAD
 * complex.
 *
 * The rule is one sentence: a feature that exists to name or point at another
 * feature ranks below the feature it points at, and a substantial place
 * outranks a fixture that happens to share its name. Photon's own order is
 * kept as the tie-break, because the string-match relevance in it is real —
 * this re-sorts, it does not re-search.
 *
 * Nothing is hidden. Every candidate the geocoder returned is still on the
 * list and still reachable; only the order changes.
 */

/** What kind of thing a candidate is, from most to least likely to be meant. */
export type Significance = 'principal' | 'substantial' | 'ordinary' | 'fixture'

const WEIGHT: Record<Significance, number> = { principal: 300, substantial: 200, ordinary: 100, fixture: 0 }

/**
 * Things this atlas exists to look at, and that someone typing their name is
 * almost certainly asking for: a settlement, an aerodrome, a works, a port,
 * a military installation.
 */
const PRINCIPAL: Array<[string, string]> = [
  ['place', 'city'],
  ['place', 'town'],
  ['aeroway', 'aerodrome'],
  ['landuse', 'military'],
  ['military', '*'],
  ['power', 'plant'],
  ['man_made', 'works'],
  ['landuse', 'industrial'],
  ['harbour', '*'],
  ['amenity', 'port'],
]

/** Substantial named things: a station, a hospital, a university, a smaller settlement. */
const SUBSTANTIAL: Array<[string, string]> = [
  ['railway', 'station'],
  ['place', 'village'],
  ['place', 'suburb'],
  ['place', 'borough'],
  ['place', 'municipality'],
  ['place', 'county'],
  ['place', 'state'],
  ['place', 'country'],
  ['amenity', 'hospital'],
  ['amenity', 'university'],
  ['aeroway', 'terminal'],
  ['man_made', 'bridge'],
  ['natural', 'peak'],
  ['leisure', 'stadium'],
]

/**
 * Fixtures: things that carry a name because they refer to something else.
 * A guidepost is a signpost. A taxi rank is a kerb. A stop is a place a bus
 * pauses beside the thing it is named for. None of them is ever the answer to
 * "where is X", and every one of them outranks X at the geocoder.
 */
const FIXTURE: Array<[string, string]> = [
  ['information', '*'],
  ['tourism', 'information'],
  ['advertising', '*'],
  ['railway', 'stop'],
  ['railway', 'halt'],
  ['railway', 'service_station'],
  ['railway', 'switch'],
  ['railway', 'level_crossing'],
  ['railway', 'tram_stop'],
  ['public_transport', '*'],
  ['highway', 'bus_stop'],
  ['highway', 'crossing'],
  ['highway', 'traffic_signals'],
  ['highway', 'street_lamp'],
  ['amenity', 'taxi'],
  ['amenity', 'bench'],
  ['amenity', 'bicycle_parking'],
  ['amenity', 'waste_basket'],
  ['amenity', 'post_box'],
  ['barrier', '*'],
  ['entrance', '*'],
  // An unpopulated named place. This is what puts a locality above Heathrow.
  ['place', 'locality'],
]

const matches = (list: Array<[string, string]>, key: string, value: string): boolean =>
  list.some(([k, v]) => k === key && (v === '*' || v === value))

/** What kind of thing a candidate is. */
export function significanceOf(target: Pick<AtlasTarget, 'osmKey' | 'osmValue'>): Significance {
  const key = target.osmKey
  const value = target.osmValue
  if (matches(FIXTURE, key, value)) return 'fixture'
  if (matches(PRINCIPAL, key, value)) return 'principal'
  if (matches(SUBSTANTIAL, key, value)) return 'substantial'
  return 'ordinary'
}

const normalise = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * How well the name answers the query, which is a tie-break within a class
 * rather than a ranking of its own: an exact name is worth something, a name
 * that starts with the query is worth a little, and a fixture with a perfect
 * name still loses to the station it stands outside.
 */
export function nameBonus(target: Pick<AtlasTarget, 'name'>, query: string): number {
  const q = normalise(query)
  const n = normalise(target.name)
  if (!q || !n) return 0
  if (n === q) return 40
  if (n.startsWith(q)) return 25
  if (n.includes(q)) return 10
  // Every word of the query present, in any order: "cheyenne mountain complex".
  const words = q.split(' ').filter(Boolean)
  if (words.length > 1 && words.every((w) => n.includes(w))) return 15
  return 0
}

/**
 * Reorder the geocoder's candidates. Stable: two candidates that score the
 * same keep the order Photon gave them, so its own relevance survives
 * wherever this has nothing to say.
 */
export function rankTargets(targets: AtlasTarget[], query: string): AtlasTarget[] {
  return targets
    .map((target, index) => ({ target, index, score: WEIGHT[significanceOf(target)] + nameBonus(target, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.target)
}
