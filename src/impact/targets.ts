import type { EvidenceTier, Provenance } from '../evidence/evidence.ts'
import type { LngLat } from '../geo/geodesy.ts'
import { TARGETS, type HardTarget } from '../models/lethality.ts'
import forcesFile from '../../data/atlas/forces-2025.json'
import cityFile from '../../data/siop62/targets-1956-priority.json'
import airfieldFile from '../../data/siop62/airfields-1956-priority.json'
import installationsFile from '../../data/impact/installations.json'

/**
 * Things to aim at.
 *
 * The accuracy lab has the arithmetic: a lethal radius, a circular error, and
 * the chance one falls inside the other. An arithmetic does not make you feel
 * a probability, so the screen beside it flies the thing — and to fly it there
 * has to be somewhere to fly it at, with a shape on the ground and a hardness.
 *
 * Nothing here is a target list. No state's plan is claimed for any of it, and
 * the two lists that *are* somebody's plan say so on their own entries: the
 * cities and the airfields are the 1956 SAC study's, which is the one released
 * document of its kind and is one-sided because the release is. Everything
 * else is a representative installation of its class — a real place, publicly
 * known, put here so that a weapon can be aimed at something that exists.
 *
 * The hardness of each class is the accuracy lab's own, which is modelled: a
 * city fails at five pounds per square inch and a silo at two thousand, and
 * every figure on this screen follows from that difference.
 */

export type CategoryId = 'city' | 'airfield' | 'silo' | 'dockyard' | 'command' | 'radar'

export interface Installation {
  id: string
  name: string
  category: CategoryId
  position: LngLat
  /** The hardness class from the accuracy lab. */
  hardness: HardTarget
  evidence: EvidenceTier
  provenance: Provenance
  note: string
  /** Metres across, for the camera: how close to get before the shot. */
  extentMetres: number
}

export interface Category {
  id: CategoryId
  name: string
  line: string
  hardnessId: string
}

const hardness = (id: string): HardTarget => {
  const t = TARGETS.find((x) => x.id === id)
  if (!t) throw new Error(`no hardness class ${id}`)
  return t
}

export const CATEGORIES: Category[] = [
  { id: 'city', name: 'City', line: 'Five pounds per square inch and ten kilometres across. Accuracy has never mattered here, which is why the first generation of missiles was aimed at cities: they could not be aimed at anything else.', hardnessId: 'city' },
  { id: 'airfield', name: 'Airfield', line: 'Aircraft in the open fail at two to three psi, so the target is the parking apron and not the runway. Soft, large, and worth nothing once the aircraft have flown.', hardnessId: 'airfield' },
  { id: 'silo', name: 'Silo field', line: 'Two thousand pounds per square inch and four metres across. This is the target that made accuracy a strategic question rather than an engineering one.', hardnessId: 'silo-hard' },
  { id: 'dockyard', name: 'Dockyard', line: 'A submarine base is soft and what is alongside is what fails. A boat at sea is not on this list, which is the whole argument for putting them there.', hardnessId: 'airfield' },
  { id: 'command', name: 'Command centre', line: 'Ten thousand psi is a figure of merit and not a design: at that hardness only a crater reaches the target, and the overpressure rule overstates what a near miss does.', hardnessId: 'bunker' },
  { id: 'radar', name: 'Early-warning radar', line: 'Large, fixed and soft, and the first thing a side that meant to strike first would want off the air — which is why attacking one has always been read as the opening move.', hardnessId: 'airfield' },
]

/** How many of the long documented lists are put on the shortlist for each category. */
const SHORTLIST = 40

const SAC_1956: Provenance = {
  source: 'SAC Atomic Weapons Requirements Study for 1959 (June 1956)',
  locator: 'National Security Archive EBB 538',
  method: 'Transcribed from the release and carried in this repository; the priority order is the study\'s own',
}

const NOTEBOOK: Provenance = {
  source: 'Kristensen, Korda, Johns and Knight, Nuclear Notebook (Bulletin of the Atomic Scientists); SIPRI Yearbook 2025',
}

interface CityRow {
  name: string
  lat: number
  lon: number
  priority: number
  complex: string
  categoryNames?: string[]
}
interface AirfieldRow {
  name: string
  lat: number
  lon: number
  priority: number
  complex: string
}
interface ForceSite {
  id: string
  name: string
  kind: string
  lon: number
  lat: number
  side: string
  note?: string
  positionEvidence?: string
}
interface InstallationRow {
  id: string
  category: string
  name: string
  country: string
  lon: number
  lat: number
  evidence: string
  note: string
}

const cityRows = (cityFile as { targets: CityRow[] }).targets
const airfieldRows = (airfieldFile as { targets: AirfieldRow[] }).targets
const forceSites = (forcesFile as { sites: ForceSite[] }).sites
const installationRows = (installationsFile as { source: string; installations: InstallationRow[] }).installations
const INSTALLATION_SOURCE = (installationsFile as { source: string }).source

/** Tidy the study's shouted, OCR-spaced names into something a readout can show. */
export function tidyName(raw: string): string {
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .trim()
  return cleaned
    .split(' ')
    .map((word) =>
      word
        .split('/')
        .map((part) => (part.length <= 1 ? part : part.charAt(0) + part.slice(1).toLowerCase()))
        .join('/'),
    )
    .join(' ')
}

const byPriority = <T extends { priority: number }>(rows: T[]): T[] => [...rows].sort((a, b) => a.priority - b.priority)

function cities(): Installation[] {
  const h = hardness('city')
  return byPriority(cityRows)
    .slice(0, SHORTLIST)
    .map((row) => ({
      id: `city-${row.complex}`,
      name: tidyName(row.name),
      category: 'city' as const,
      position: [row.lon, row.lat] as LngLat,
      hardness: h,
      evidence: 'documented' as EvidenceTier,
      provenance: SAC_1956,
      note: `Priority ${row.priority} on the study's own list, complex ${row.complex}${row.categoryNames && row.categoryNames.length > 0 ? ` · ${row.categoryNames.slice(0, 3).join(', ').toLowerCase()}` : ''}`,
      extentMetres: h.extentMetres,
    }))
}

function airfields(): Installation[] {
  const h = hardness('airfield')
  const fromStudy = byPriority(airfieldRows)
    .slice(0, SHORTLIST - 8)
    .map((row) => ({
      id: `af-${row.complex}-${row.name.replace(/\W+/g, '')}`,
      name: tidyName(row.name),
      category: 'airfield' as const,
      position: [row.lon, row.lat] as LngLat,
      hardness: h,
      evidence: 'documented' as EvidenceTier,
      provenance: SAC_1956,
      note: `Priority ${row.priority} on the study's airfield list, complex ${row.complex}`,
      extentMetres: h.extentMetres,
    }))
  const modern = forceSites
    .filter((s) => s.kind === 'bomber')
    .map((s) => ({
      id: `af-${s.id}`,
      name: s.name,
      category: 'airfield' as const,
      position: [s.lon, s.lat] as LngLat,
      hardness: h,
      evidence: (s.positionEvidence as EvidenceTier) ?? 'reconstructed',
      provenance: NOTEBOOK,
      note: s.note ?? 'A bomber base of the present force',
      extentMetres: h.extentMetres,
    }))
  return [...modern, ...fromStudy]
}

function silos(): Installation[] {
  const h = hardness('silo-hard')
  return forceSites
    .filter((s) => s.kind === 'icbm')
    .map((s) => ({
      id: `silo-${s.id}`,
      name: s.name,
      category: 'silo' as const,
      position: [s.lon, s.lat] as LngLat,
      hardness: h,
      evidence: (s.positionEvidence as EvidenceTier) ?? 'reconstructed',
      provenance: NOTEBOOK,
      /*
       * The position is the wing or division headquarters, and the silos
       * themselves are spread over thousands of square kilometres around it.
       * That is a real distinction and the readout keeps it: what is aimed at
       * here is one launch facility of the field, placed at the headquarters
       * for want of a published list of the rest.
       */
      note: `${s.note ?? 'A missile field of the present force'} · the mark is the wing, and a field's silos are spread over thousands of square kilometres around it`,
      extentMetres: h.extentMetres,
    }))
}

function installations(category: CategoryId): Installation[] {
  const cat = CATEGORIES.find((c) => c.id === category)
  if (!cat) return []
  const h = hardness(cat.hardnessId)
  return installationRows
    .filter((row) => row.category === category)
    .map((row) => ({
      id: row.id,
      name: row.name,
      category,
      position: [row.lon, row.lat] as LngLat,
      hardness: h,
      evidence: row.evidence as EvidenceTier,
      provenance: { source: INSTALLATION_SOURCE, method: 'A representative installation of its class, not a target anyone has named' },
      note: `${row.country} · ${row.note}`,
      extentMetres: h.extentMetres,
    }))
}

const CATALOGUE: Record<CategoryId, Installation[]> = {
  city: cities(),
  airfield: airfields(),
  silo: silos(),
  dockyard: installations('dockyard'),
  command: installations('command'),
  radar: installations('radar'),
}

export function targetsIn(category: CategoryId): Installation[] {
  return CATALOGUE[category]
}

export function allTargets(): Installation[] {
  return CATEGORIES.flatMap((c) => CATALOGUE[c.id])
}

export function categoryOf(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}
