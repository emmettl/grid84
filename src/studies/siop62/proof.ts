import { timeByGroundSpeed, Track } from '../../engine/track.ts'
import type { Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import { minimumEnergyTrajectory } from '../../models/ballistic.ts'
import { BLAST_MODEL, promptEffects } from '../../models/blast.ts'
import type { Study, StudyEvent } from '../study.ts'

/**
 * SIOP//62 bounded proof: one of everything, across every evidence tier.
 * Nothing here is the plan. It is one documented base, one documented
 * sortie on a reconstructed route, one transcribed 1956 target with its
 * redaction, one modelled consequence, and one ghost.
 */

const SAGAN: Provenance = { source: 'Sagan 1987', locator: 'International Security 12:1, reproducing the 13 Sept 1961 briefing', url: 'https://archive.org/details/SIOP62TheNuclearWarPlanBriefingToPresidentKennedy' }
const ATLAS_TABLE: Provenance = { source: 'Wikipedia, SM-65 Atlas', locator: 'deployment table, citing Norris & Cochran, NRDC 1997', url: 'https://en.wikipedia.org/wiki/SM-65_Atlas' }
const CHROME_DOME: Provenance = { source: 'Wikipedia, Operation Chrome Dome', locator: 'from RCAF files and SAC histories', url: 'https://en.wikipedia.org/wiki/Operation_Chrome_Dome' }
const CITY_LIST_P6: Provenance = { source: 'SAC Atomic Weapons Requirements Study for 1959 (June 1956)', locator: 'NSA EBB 538, 1st city list, p. 6', url: 'https://nsarchive2.gwu.edu/nukevault/ebb538-Cold-War-Nuclear-Target-List-Declassified-First-Ever/' }
const EBB538: Provenance = { source: 'National Security Archive EBB 538', locator: 'editorial note on category 275 and withheld BE numbers', url: 'https://nsarchive2.gwu.edu/nukevault/ebb538-Cold-War-Nuclear-Target-List-Declassified-First-Ever/' }
const NO_ASSIGNMENTS: Provenance = { source: 'No released document', method: 'The US government has never declassified any SIOP; weapon-to-target assignments are not in the record. This assignment is an illustration chosen for range and geography.' }

const WARREN: LngLat = [-104.867, 41.133]
const THULE: LngLat = [-68.703, 76.531]
const ANADYR: LngLat = [177.467, 64.733]
const SHEPPARD: LngLat = [-98.49, 33.99]

/** Reaction time for fixed bases under tactical warning: fifteen minutes. */
const REACTION_SECONDS = 15 * 60
const atlasPlan = minimumEnergyTrajectory(WARREN, ANADYR)
const LAUNCH = REACTION_SECONDS
const IMPACT = LAUNCH + atlasPlan.flightSeconds

const atlasTrack = new Track([
  { position: WARREN, time: LAUNCH },
  { position: ANADYR, time: IMPACT },
])

/** Chrome Dome northern route as described for a 1964 mission; 1961 routes were similar per SAC histories. */
const NORTHERN_ROUTE: LngLat[] = [
  SHEPPARD,
  [-70.5, 43.0], // New England
  [-56.0, 48.5], // refuelling over Newfoundland
  [-65.0, 70.0], // Baffin Bay
  THULE,
  [-95.0, 78.0], // Queen Elizabeth Islands, westbound
  [-125.0, 76.0],
  [-148.0, 65.0], // Alaska
  [-142.0, 57.0], // refuelling over the Pacific
  SHEPPARD,
]
const B52_CRUISE_MS = 845_000 / 3_600
const rawLoop = timeByGroundSpeed(NORTHERN_ROUTE, 0, B52_CRUISE_MS)
// Phase the loop so the aircraft passes Thule half an hour before H-hour.
const thuleIndex = NORTHERN_ROUTE.indexOf(THULE)
const shift = -(rawLoop[thuleIndex].time + 1_800)
const bomberTrack = new Track(rawLoop.map((w) => ({ position: w.position, time: w.time + shift })))

const W49_KT = 1_440
const effects = promptEffects(W49_KT)

const minutes = (s: number) => `${(s / 60).toFixed(1)} min`
const km = (m: number) => `${(m / 1_000).toFixed(0)} km`

const events: StudyEvent[] = [
  { time: bomberTrack.start, text: 'AIRBORNE ALERT · CHROME DOME · NORTHERN ROUTE · 12 SORTIES/DAY', entityId: 'b52' },
  { time: bomberTrack.start + 1, text: 'SIOP TARGET FOR THIS SORTIE: WITHHELD', entityId: 'b52' },
  { time: 0, text: 'EXECUTION ORDER · OPTION 1 · ALERT FORCE · 1,004 SYSTEMS / 1,685 WEAPONS' },
  { time: 1, text: 'SEQUENCE: BALLISTIC MISSILES · FORWARD AREAS · CONUS FORCES' },
  { time: LAUNCH, text: '564 SMS · ATLAS D · LAUNCH · 15-MIN REACTION (DOCUMENTED) · ASSIGNMENT (INFERRED)', entityId: 'atlas' },
  { time: LAUNCH + 300, text: `ATLAS D · BURNOUT ${Math.round(atlasPlan.burnoutSpeed)} M/S · APOGEE ${km(atlasPlan.apogeeMetres)} (MODELLED)`, entityId: 'atlas' },
  { time: IMPACT - 120, text: 'ANADYR · TERMINAL PHASE · ACQUIRING', entityId: 'atlas', camera: { center: ANADYR, zoom: 9.2, pitch: 55, bearing: 20, durationMs: 6_000 } },
  { time: IMPACT, text: 'ANADYR · COMPLEX 0230 · DETONATION · W49 1.44 MT ASSUMED (MODELLED)', entityId: 'anadyr-effect' },
  { time: IMPACT + 1, text: 'OUTCOME CALCULATION · IN PROGRESS', entityId: 'anadyr-effect' },
]

export const SIOP62_PROOF: Study = {
  id: 'siop62-proof',
  title: 'SIOP//62',
  subtitle: 'Bounded proof · one of everything, across every tier',
  bounds: { start: -4 * 3_600, end: 2 * 3_600 },
  view: { center: [-152, 60], zoom: 1.75 },
  populationGrid: 'popc_1961',
  omissions: [
    'Soviet response: not represented; the briefing states some Soviet weapons would reach the United States under any circumstances',
    'Population exposure: HYDE 3.3 1961 grid at 5 arc minutes; uniform density within cells; blast-only fractions from OTA 1979 and a Postol fire bound',
    'Fallout: not modelled; air burst assumed',
    'Terrain, weather, shielding: not modelled; planar prompt effects',
    'Weapon-to-target assignment: not in the record; this one is an illustration',
  ],
  events,
  entities: [
    {
      kind: 'site',
      id: 'warren',
      name: 'F.E. Warren AFB',
      designation: 'LAUNCH COMPLEX · 564 SMS · ATLAS D',
      position: WARREN,
      uncertaintyMetres: 30_000,
      evidence: 'documented',
      provenance: ATLAS_TABLE,
      facts: [
        { label: 'Force', value: '6 × Atlas D, operational 2 Sept 1960 to 1 July 1964', evidence: 'documented', provenance: ATLAS_TABLE },
        { label: 'Warhead', value: 'W49 · 1.44 Mt', evidence: 'documented', provenance: ATLAS_TABLE },
        { label: 'Alert posture, late 1961', value: '24 of 78 ICBMs on alert', evidence: 'documented', provenance: { ...SAGAN, locator: 'p. 29' } },
        { label: 'Reaction time', value: '15 minutes for fixed bases under tactical warning', evidence: 'documented', provenance: { ...SAGAN, locator: 'citing JCS 2056/181, 14 Sept 1960' } },
        { label: 'Launch complex position', value: 'Within about 30 km of the base; not located here', evidence: 'inferred', provenance: { source: 'Base coordinate used', method: 'Ring shows positional uncertainty' } },
      ],
    },
    {
      kind: 'site',
      id: 'thule',
      name: 'Thule',
      designation: 'RADAR · BMEWS · MONITORED BY 2 AIRCRAFT DAILY',
      position: THULE,
      evidence: 'documented',
      provenance: CHROME_DOME,
      facts: [
        { label: 'Role', value: 'Two Chrome Dome bombers monitored the BMEWS site daily', evidence: 'documented', provenance: CHROME_DOME },
      ],
    },
    {
      kind: 'site',
      id: 'anadyr',
      name: 'Anadyr',
      designation: 'TARGET COMPLEX 0230 · PRIORITY 1045',
      position: ANADYR,
      evidence: 'documented',
      provenance: { ...CITY_LIST_P6, locator: 'p. 6, row "1045 0230 ANADYR 6444-17728"' },
      facts: [
        { label: 'Coordinates, 1956', value: '64°44′ N · 177°28′ E', evidence: 'documented', provenance: CITY_LIST_P6 },
        { label: 'Categories', value: '248 · 254 · 284 · 280 (BE 0075-0003)', evidence: 'documented', provenance: CITY_LIST_P6 },
        { label: 'Category names', value: 'Not yet transcribed (section 3, category code list)', evidence: 'withheld', provenance: { source: 'Transcription incomplete', withheldUnder: 'Not redacted; not yet read' } },
        { label: 'Population target', value: 'Category 275 · BE 0075-9999', evidence: 'withheld', provenance: { ...EBB538, withheldUnder: 'BE numbers of population targets remain classified' } },
        { label: 'Weapons assigned', value: 'WITHHELD', evidence: 'withheld', provenance: { ...CITY_LIST_P6, withheldUnder: 'FOIA (b)(3) · 42 USC 2168, printed on the redaction box' } },
        { label: 'In the 1961 target list', value: 'Not evidenced; the 1956 study is a proxy', evidence: 'inferred', provenance: { source: 'Method', method: 'Airfields and the largest complexes are the safest reconstruction; Anadyr carries an airfield category' } },
      ],
    },
    {
      kind: 'site',
      id: 'anadyr-population',
      name: 'Anadyr · population',
      designation: 'CATEGORY 275 · BE 0075-9999',
      position: [ANADYR[0] + 0.12, ANADYR[1] - 0.03],
      uncertaintyMetres: 4_000,
      labelAnchor: 'top',
      evidence: 'withheld',
      provenance: { ...EBB538, withheldUnder: 'Location and BE number withheld; drawn at the city with a ring for the uncertainty' },
      facts: [
        { label: 'Existence', value: 'A population row appears under complex 0230', evidence: 'documented', provenance: CITY_LIST_P6 },
        { label: 'Position', value: 'City extent, about 4 km', evidence: 'inferred', provenance: { source: 'Method', method: 'Ring radius is the uncertainty, not an effect' } },
      ],
    },
    {
      kind: 'track',
      id: 'b52',
      name: 'B-52 · Chrome Dome',
      designation: 'AIRBORNE ALERT · NORTHERN ROUTE',
      track: bomberTrack,
      reveal: 'full',
      evidence: 'documented',
      provenance: { ...SAGAN, locator: 'p. 29: a small number of B-52s on airborne alert at all times, late 1961' },
      route: { evidence: 'reconstructed', provenance: { ...CHROME_DOME, method: 'Great-circle legs between the places named in a 1964 mission description, at 845 km/h; refuelling tracks approximate' } },
      facts: [
        { label: 'Posture', value: '12 sorties a day by late 1961; two monitoring Thule', evidence: 'documented', provenance: CHROME_DOME },
        { label: 'Route', value: 'Texas · New England · Newfoundland · Baffin Bay · Thule · Queen Elizabeth Islands · Alaska · Pacific · Texas', evidence: 'reconstructed', provenance: CHROME_DOME },
        { label: 'Base for this sortie', value: 'Sheppard AFB, as in the 1964 description', evidence: 'inferred', provenance: { source: 'Method', method: '1961 launching bases not identified per sortie' } },
        { label: 'SIOP target', value: 'WITHHELD', evidence: 'withheld', provenance: { source: 'No released document', withheldUnder: 'No SIOP has been declassified' } },
        { label: 'Weapons', value: 'B28-class, as on later Chrome Dome losses', evidence: 'inferred', provenance: { source: 'Palomares 1966 carried four B28', method: 'Load for 1961 sorties not documented' } },
      ],
    },
    {
      kind: 'track',
      id: 'atlas',
      name: 'Atlas D',
      designation: '564 SMS · ONE WEAPON · W49',
      track: atlasTrack,
      reveal: 'progressive',
      evidence: 'inferred',
      provenance: NO_ASSIGNMENTS,
      route: { evidence: 'modelled', provenance: { source: 'Minimum-energy ballistic trajectory', method: 'Keplerian arc over a spherical non-rotating Earth, impulsive burn, no atmosphere after burnout' } },
      facts: [
        { label: 'Launch', value: `H+${minutes(LAUNCH)} after the execution order`, evidence: 'documented', provenance: { ...SAGAN, locator: '15-minute reaction for fixed bases' } },
        { label: 'Range', value: km(atlasPlan.rangeMetres), evidence: 'modelled', provenance: { source: 'Haversine' } },
        { label: 'Flight time', value: minutes(atlasPlan.flightSeconds), evidence: 'modelled', provenance: { source: 'Minimum-energy trajectory' } },
        { label: 'Apogee', value: km(atlasPlan.apogeeMetres), evidence: 'modelled', provenance: { source: 'Minimum-energy trajectory' } },
        { label: 'Reliability', value: 'Atlas D and E about 0.70 to 0.80; this flight assumes success', evidence: 'documented', provenance: { ...SAGAN, locator: 'n. 33' } },
      ],
    },
    {
      kind: 'effect',
      id: 'anadyr-effect',
      name: 'Anadyr · prompt effects',
      designation: 'W49 1.44 MT · AIR BURST ASSUMED',
      center: ANADYR,
      time: IMPACT,
      effects,
      evidence: 'modelled',
      provenance: { source: BLAST_MODEL },
      facts: [
        { label: 'Yield', value: 'W49 · 1.44 Mt', evidence: 'documented', provenance: ATLAS_TABLE },
        { label: 'Burst', value: 'Optimum-height air burst assumed', evidence: 'modelled', provenance: { source: BLAST_MODEL } },
        ...effects.rings.map((ring) => ({ label: ring.label, value: `${(ring.radius / 1_000).toFixed(1)} km · ${ring.criterion}`, evidence: 'modelled' as const, provenance: { source: BLAST_MODEL } })),
        { label: 'Population grid', value: 'HYDE 3.3 · 1961 · 5 arc minutes · CC BY-NC-SA 4.0', evidence: 'documented', provenance: { source: 'Klein Goldewijk 2023', url: 'https://doi.org/10.24416/UU01-AEZZIT' } },
      ],
    },
  ],
}
