import type { Provenance } from '../evidence/evidence.ts'
import type { LngLat } from '../geo/geodesy.ts'

/**
 * Published NUKEMAP results to set the lab against. NUKEMAP's casualty
 * method is the one this engine uses, the DCPA bands reprinted in OTA 1979
 * applied to the overpressure rings, so a difference between the two is a
 * difference of population data and ground zero, not of method: NUKEMAP
 * sums LandScan 2011 ambient population, the lab sums GHSL residential
 * population for its epoch. The figures below are as the press quoted them;
 * the ground zero each run used is not stated, so a city's geocoded centre
 * stands for it and the readout says so.
 */
export interface ComparisonCase {
  id: string
  name: string
  weapon: string
  yieldKt: number
  burst: 'air' | 'surface'
  /** Ground zero the comparison uses: the city's geocoded centre. */
  center: LngLat
  centerNote: string
  nukemap: { dead: number; injured: number }
  /** NUKEMAP's quoted ring areas in square miles, when the report gave them. */
  areasSqMi?: { fireball: number; psi20: number; rad500: number; psi5: number; burn3: number; psi1: number }
  provenance: Provenance
}

/** The W88 run's quoted areas: fireball, heavy blast (20 psi), radiation (500 rem), moderate blast (5 psi), thermal (third-degree burns), light blast (1 psi). */
const W88_AREAS = { fireball: 0.73, psi20: 3.95, rad500: 5.73, psi5: 20.9, burn3: 90.1, psi1: 280 }

/** Radius in metres of a circle of the given area in square miles. */
export function radiusOfSqMi(sqMi: number): number {
  return Math.sqrt((sqMi * 2.589988e6) / Math.PI)
}

const NEWSWEEK_2025: Provenance = { source: 'Newsweek, "Nuclear bomb map shows impact of US weapons on major cities," 30 October 2025, quoting NUKEMAP', url: 'https://www.newsweek.com/nuclear-bomb-map-shows-impact-of-us-weapons-on-major-cities-10965507', method: 'W88 warhead, 455 kt, air burst; NUKEMAP by Alex Wellerstein over LandScan 2011 ambient population' }
const NEWSWEEK_2022: Provenance = { source: 'Newsweek, "Nuclear bomb blast map shows what would happen if one detonated near you," 16 May 2022, quoting NUKEMAP', url: 'https://www.newsweek.com/nuclear-bomb-blast-map-shows-what-would-happen-one-detonated-near-you-nukemap-1706923', method: 'Tsar Bomba, 50 Mt, air burst at 13,000 feet; NUKEMAP over LandScan 2011' }

export const NUKEMAP_METHOD: Provenance = { source: 'NUKEMAP FAQ', url: 'https://nuclearsecrecy.com/nukemap/faq/', method: 'Casualties from blast overpressure bands taken from the 1973 DCPA Attack Environment Manual as reprinted in OTA 1979, over LandScan Global Population 2011 ambient population; no shielding, thermal or radiation effects in the count' }

const w88 = (id: string, name: string, center: LngLat, dead: number, injured: number): ComparisonCase => ({ id, name, weapon: 'W88', yieldKt: 455, burst: 'air', center, centerNote: 'City centre as geocoded; the run\'s own ground zero is not stated', nukemap: { dead, injured }, areasSqMi: W88_AREAS, provenance: NEWSWEEK_2025 })

export const COMPARISON_CASES: ComparisonCase[] = [
  w88('moscow-w88', 'Moscow', [37.6173, 55.7558], 507_500, 1_442_990),
  w88('beijing-w88', 'Beijing', [116.4074, 39.9042], 695_260, 1_502_500),
  w88('london-w88', 'London', [-0.1278, 51.5074], 225_930, 202_370),
  w88('new-york-w88', 'New York', [-74.006, 40.7128], 1_258_610, 1_436_630),
  w88('los-angeles-w88', 'Los Angeles', [-118.2437, 34.0522], 320_580, 601_150),
  w88('tokyo-w88', 'Tokyo', [139.6503, 35.6762], 673_950, 1_752_400),
  w88('paris-w88', 'Paris', [2.3522, 48.8566], 1_072_840, 1_537_060),
  { id: 'new-york-tsar', name: 'New York · Tsar Bomba', weapon: 'Tsar Bomba', yieldKt: 50_000, burst: 'air', center: [-74.006, 40.7128], centerNote: 'City centre as geocoded; the run\'s own ground zero is not stated', nukemap: { dead: 7_600_000, injured: 4_200_000 }, provenance: NEWSWEEK_2022 },
]
