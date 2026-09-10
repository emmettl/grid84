import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import { haversineMetres, type LngLat } from '../../geo/geodesy.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { enactStrike, launcherSite } from '../strike.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import file from '../../../data/sino-soviet-1969/complex-1969.json'

/**
 * The strike nobody has evidence was planned.
 *
 * In 1969 the Soviet Union and China fought a border war, and Moscow let it
 * be understood — through a diplomat in Washington, through a journalist in
 * London, through hints to East European allies — that it was considering a
 * nuclear strike on the Chinese nuclear programme. Beijing believed it,
 * dispersed its leadership on 15 October and put its forces on alert on the
 * 18th. The phrase Chinese scholarship uses for what Moscow was threatening
 * is a nuclear surgery.
 *
 * Every serious work on the period since has looked for the plan and not
 * found it. The Soviet strategic forces did not change in response to China;
 * the eastern medium-range missile force was liquidated the year after the
 * crisis rather than reinforced; and the strongest affirmative claim in the
 * literature is an assertion of privileged knowledge with nothing behind it.
 * This study does not assert a plan either. It asks the arithmetical
 * question the literature argues about in words: what would the surgery have
 * taken, and would it have worked?
 *
 * Two findings come out of it, and neither is a matter of opinion.
 *
 * The first is that the complex was small. Eight operating facilities, and
 * a strike on the whole of China's nuclear programme is a dozen aim points
 * rather than a war. Nothing about the scale of the thing was prohibitive.
 *
 * The second is that the surgery is not surgical. Three of those eight sit
 * in or beside cities — the enrichment plant is inside Lanzhou, the fuel
 * plant is inside Baotou, and the research institute is forty kilometres
 * from the centre of Beijing — and the readout counts what that costs on
 * the population grid of 1969. Whatever Moscow was threatening, it was not
 * a surgery, and the arithmetic says so without needing a document.
 *
 * The dossier behind this study is at /dossier/sino-soviet-1969.html, and it
 * sets out what is documented, what is inferred, what is contested and what
 * could not be established at all.
 */

interface Facility {
  id: string
  name: string
  lon: number
  lat: number
  kind: string
  operating: boolean
  why: string
  source: string
}

interface Base {
  id: string
  name: string
  lon: number
  lat: number
  unit: string
  type: string
  aircraft: number
  rangeKm: number
}

interface Battery {
  id: string
  name: string
  lon: number
  lat: number
  unit: string
  type: string
  launchers: number
  rangeKm: number
}

const F = file as unknown as {
  year: number
  source: string
  rule: string
  weapon: { name: string; yieldKt: number; note: string }
  profile: { cruiseAltitudeMetres: number; runInMetres: number; descendAtMetres: number; speedMs: number; note: string }
  attrition: { reliability: number; penetration: number; note: string }
  targets: Facility[]
  bases: Base[]
  missiles: Battery[]
  chinese: { note: string; bombers: string; missiles: string; reach: string; warheads: string }
}

const SOURCE: Provenance = { source: F.source, method: F.rule }
const MIN = 60
const STRUCK = F.targets.filter((t) => t.operating)
const DRAWN = F.targets.filter((t) => !t.operating)

/** What each kind of facility is, in one word for the readout. */
const KIND_LABEL: Record<string, string> = {
  weapons: 'WEAPONS DESIGN AND ASSEMBLY',
  enrichment: 'ENRICHMENT',
  plutonium: 'PLUTONIUM',
  test: 'TEST SITE',
  fuel: 'FUEL FABRICATION',
  missile: 'MISSILE TEST RANGE',
  research: 'RESEARCH REACTOR',
  mining: 'MILLING AND MINING',
}

/**
 * The geography is the argument, so the reach is computed rather than
 * assumed: a bomber base or a missile field is only an option for the
 * facilities it can actually get to. The medium-range missiles turn out to
 * reach almost nothing, which is why the strike has to be flown.
 */
export function reachOf(from: LngLat, rangeMetres: number): Facility[] {
  return STRUCK.filter((t) => haversineMetres(from, [t.lon, t.lat]) <= rangeMetres)
}

function launchers(): Launcher[] {
  return F.bases.map((b) => ({
    id: b.id,
    name: `${b.name} (${b.type})`,
    kind: 'bomber' as const,
    position: [b.lon, b.lat] as LngLat,
    weapons: Math.min(b.aircraft, STRUCK.length * 2),
    weaponsPerVehicle: 1,
    // A bomber's stated range is there and back; the reach to a target is half of it.
    rangeMetres: (b.rangeKm * 1_000) / 2,
    yieldKt: F.weapon.yieldKt,
    reactionSeconds: 30 * MIN,
    speedMs: F.profile.speedMs,
    cruiseAltitudeMetres: F.profile.cruiseAltitudeMetres,
    weaponAltitudeMetres: F.profile.runInMetres,
    descendAtMetres: F.profile.descendAtMetres,
  }))
}

/** What the missile force could have reached, which is the finding it exists to carry. */
export function missileReach(): Array<{ battery: Battery; targets: Facility[] }> {
  return F.missiles.map((m) => ({ battery: m, targets: reachOf([m.lon, m.lat], m.rangeKm * 1_000) }))
}

export function sinoSoviet69Arithmetic() {
  const strike = enact()
  const reach = missileReach()
  const byMissile = new Set(reach.flatMap((r) => r.targets.map((t) => t.id)))
  const reachable = new Set(F.bases.flatMap((b) => reachOf([b.lon, b.lat], (b.rangeKm * 1_000) / 2).map((t) => t.id)))
  return {
    operating: STRUCK.length,
    /** Facilities no bomber base on the list can get to and back from. */
    beyondReach: STRUCK.filter((t) => !reachable.has(t.id)),
    underConstruction: DRAWN.length,
    aircraft: F.bases.reduce((a, b) => a + b.aircraft, 0),
    launchers: F.missiles.reduce((a, m) => a + m.launchers, 0),
    /** Facilities any missile east of the Urals could reach, and the same for the medium-range force alone. */
    withinMissileReach: byMissile.size,
    withinMediumRange: new Set(reach.filter((r) => r.battery.rangeKm <= 2_500).flatMap((r) => r.targets.map((t) => t.id))).size,
    mediumLaunchers: F.missiles.filter((m) => m.rangeKm <= 2_500).reduce((a, m) => a + m.launchers, 0),
    inCities: STRUCK.filter((t) => ['plant-504', 'plant-202', 'institute-401'].includes(t.id)).length,
    sorties: strike.summary.vehicles,
    delivered: strike.summary.delivered,
    yieldKt: F.weapon.yieldKt,
  }
}

function enact() {
  const targets: Target[] = STRUCK.map((t, i) => ({ id: t.id, name: t.name, priority: i, position: [t.lon, t.lat] as LngLat, maxWeapons: 2 }))
  return enactStrike({
    prefix: 'ss69',
    side: 'attacker',
    launchers: launchers(),
    targets,
    allocation: { maxWeaponsPerTarget: 2, order: ['bomber'] },
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: F.attrition.reliability }, penetration: F.attrition.penetration, note: F.attrition.note },
    allocationRule: SOURCE,
    vehicle: { evidence: 'documented', provenance: { source: F.source, method: 'The aircraft and their bases are documented; that they flew this is not' } },
    route: { cruise: { source: 'Great circles at the profile\'s altitude', method: F.profile.note }, ballistic: { source: 'Not used' } },
    targetCategory: (t) => KIND_LABEL[F.targets.find((x) => x.id === t.id)?.kind ?? ''] ?? 'NUCLEAR COMPLEX',
    // The whole point of striking a works is to destroy the works, and that
    // means the fireball on the ground and the plume downwind of it. The wind
    // is the assumption this study is least sure of and it is stated as one:
    // the prevailing flow over the northwest of China is westerly, so the
    // plumes run east, over the country the complex is in.
    burstFor: () => ({
      burst: 'surface' as const,
      fallout: {
        fissionFraction: 0.5,
        windMph: 25,
        downwindBearingDeg: 95,
        untilHours: 48,
        shearDeg: 15,
        terrainFactor: 0.7,
        provenance: {
          source: 'Glasstone & Dolan 1977 ch. IX idealized contours; the wind is an assumption, not a forecast',
          method: 'The prevailing flow at altitude over Gansu, Qinghai and Xinjiang is westerly. Twenty-five miles an hour from the west with fifteen degrees of shear is a plain assumption and the readout says so; a different wind puts the same activity somewhere else',
        },
      },
    }),
    targetFacts: (t) => {
      const f = F.targets.find((x) => x.id === t.id)
      if (!f) return []
      return [
        { label: 'What it is', value: f.why, evidence: 'documented' as EvidenceTier, provenance: { source: f.source } },
        { label: 'Whose target', value: 'Nobody’s, on the record. No Soviet target list against China from 1969 has been released, and none of the scholarship that has looked for one has found it. This aim point follows from what the facility did, not from a document', evidence: 'withheld' as EvidenceTier, provenance: { source: F.source, withheldUnder: 'Soviet General Staff planning of the period remains closed' } },
      ]
    },
    mirv: { bomberLegMetres: 200_000 },
  })
}

export function sinoSoviet69(): Study {
  const strike = enact()
  const a = sinoSoviet69Arithmetic()
  const reach = missileReach()

  const entities: Entity[] = [
    ...F.bases.map((b, i) =>
      launcherSite(launchers()[i], {
        side: 'attacker',
        designation: `${b.type.toUpperCase()} · ${b.aircraft} AIRCRAFT · ${b.rangeKm.toLocaleString('en-GB')} KM`,
        evidence: 'documented',
        provenance: { source: F.source },
        positionEvidence: 'documented',
        label: true,
        facts: [
          { label: 'Unit', value: b.unit, evidence: 'documented' as EvidenceTier, provenance: { source: F.source } },
          { label: 'In reach from here', value: `${reachOf([b.lon, b.lat], (b.rangeKm * 1_000) / 2).length} of the ${STRUCK.length} operating facilities, on a combat radius of half the stated range`, evidence: 'reconstructed' as EvidenceTier, provenance: { source: F.source, method: 'Great-circle distance against the published range' } },
          { label: 'The weapon', value: F.weapon.note, evidence: 'inferred' as EvidenceTier, provenance: { source: F.source } },
        ],
      }),
    ),
    // The medium-range missile fields, drawn but not firing: what they could
    // reach is the reason the strike is an air strike.
    ...F.missiles.map((m): Entity => {
      const within = reach.find((r) => r.battery.id === m.id)?.targets ?? []
      return {
        kind: 'site',
        id: `ss69-mrbm-${m.id}`,
        name: m.name,
        designation: `${m.type} · ${m.launchers} LAUNCHERS · ${within.length === 0 ? 'REACHES NOTHING' : `REACHES ${within.length}`}`,
        label: true,
        position: [m.lon, m.lat],
        evidence: 'documented',
        provenance: { source: F.source, method: 'Position and strength documented; the reach is computed against the published range' },
        facts: [
          { label: 'Unit', value: m.unit, evidence: 'documented', provenance: { source: F.source } },
          {
            label: 'What it reaches',
            value: within.length === 0 ? `Nothing on this target list, at ${m.rangeKm.toLocaleString('en-GB')} km` : `${within.map((t) => t.name.split(' · ')[0]).join(', ')}, at ${m.rangeKm.toLocaleString('en-GB')} km`,
            evidence: 'reconstructed',
            provenance: { source: F.source, method: 'Great-circle distance against the published range' },
          },
        ],
      }
    }),
    // The Third Front plants, under construction and not struck.
    ...DRAWN.map((t): Entity => ({
      kind: 'site',
      id: `ss69-building-${t.id}`,
      name: t.name,
      designation: `${KIND_LABEL[t.kind] ?? 'COMPLEX'} · UNDER CONSTRUCTION · NOT STRUCK`,
      label: true,
      position: [t.lon, t.lat],
      evidence: 'documented',
      provenance: { source: t.source },
      facts: [{ label: 'Why it is not struck', value: t.why, evidence: 'documented', provenance: { source: t.source } }],
    })),
    ...strike.entities,
  ]

  const arrivals = Object.values(strike.firstArrival).map((f) => f.time)
  const first = Math.min(...arrivals)
  const last = Math.max(...arrivals)

  const events: StudyEvent[] = [
    {
      time: -40 * MIN,
      text: `THE COMPLEX · ${a.operating} OPERATING FACILITIES · ${a.underConstruction} MORE UNDER CONSTRUCTION IN THE INTERIOR · CHINA HAS ABOUT FIFTY WARHEADS AND TEN TESTS BEHIND IT`,
      camera: { center: [102, 38], zoom: 3.5, fit: F.targets.map((t) => [t.lon, t.lat] as LngLat), durationMs: 2_500 },
    },
    { time: -34 * MIN, text: 'PLANT 221 · THE NINTH ACADEMY · WEAPON PHYSICS, HIGH EXPLOSIVE AND FINAL ASSEMBLY IN ONE PLACE ON THE JINYINTAN GRASSLAND · THE HIGHEST-VALUE SINGLE AIM POINT IN CHINA', entityId: 'ss69-t-plant-221' },
    { time: -30 * MIN, text: `THE MISSILES ARE IN THE WRONG PLACES · ${a.mediumLaunchers} MEDIUM-RANGE LAUNCHERS EAST OF THE URALS REACH ${a.withinMediumRange} OF ${a.operating} FACILITIES BETWEEN THEM, AND NEITHER THE NINTH ACADEMY NOR LANZHOU · THE ONLY SYSTEM THAT COVERS THE COMPLEX IS THREE R-14U SILOS AT AKTYUBINSK, SITED AGAINST EUROPE` },
    { time: -26 * MIN, text: 'NONE OF THEM IS IN TRANSBAIKAL, AMUR OR MONGOLIA. THE 45TH ROCKET DIVISION AT USSURIYSK WAS DISBANDED IN SEPTEMBER 1970 — THE EASTERN MISSILE FORCE WAS LIQUIDATED AFTER THE CRISIS, NOT REINFORCED · THE STRIKE HAS TO BE FLOWN' },
    { time: -20 * MIN, text: `LONG RANGE AVIATION · ${a.aircraft} AIRCRAFT ON ${F.bases.length} BASES · 8TH SEPARATE HEAVY BOMBER CORPS AT IRKUTSK AND THE 79TH DIVISION AT DOLON`, camera: { center: [104, 44], zoom: 2.7, durationMs: 3_000 } },
    { time: 0, text: `EXECUTE · ${a.sorties} SORTIES AGAINST ${a.operating} FACILITIES · ONE WEAPON OF ${F.weapon.yieldKt} KT ON EACH · SURFACE BURST, BECAUSE THE POINT IS THE WORKS` },
    { time: Math.round(first * 0.6), text: 'NO CHINESE STRATEGIC AIR DEFENCE OVER THE NORTHWEST · A SMALL MIG FORCE AND A FEW BATTERIES AROUND BEIJING, AND NOTHING AT ALL OVER QINGHAI, GANSU OR XINJIANG' },
    { time: first, text: 'FIRST WEAPONS DOWN' },
    { time: last, text: `${a.delivered} WEAPONS DOWN ON ${a.operating - a.beyondReach.length} FACILITIES · THREE OF THEM STAND IN OR BESIDE CITIES — LANZHOU, BAOTOU AND FORTY KILOMETRES FROM THE CENTRE OF BEIJING — AND THE OUTCOME PANEL COUNTS WHAT THAT MEANS` },
    ...(a.beyondReach.length > 0
      ? [{ time: last + 10 * MIN, text: `${a.beyondReach.map((t) => t.name.split(' · ')[0].toUpperCase()).join(', ')} IS NOT STRUCK · NO BOMBER BASE ON THIS LIST CAN GET THERE AND BACK · THE MILLING AND MINING THAT FEEDS EVERYTHING ELSE IS TWO THOUSAND KILOMETRES DEEPER INTO CHINA THAN THE REST OF THE COMPLEX` }]
      : []),
    { time: last + 30 * MIN, text: `CHINA ANSWERS WITH WHAT IT HAS · TWO TU-16 AND A HANDFUL OF DF-2A AT 1,250 KM ON SOFT SITES, THREE HOURS TO FUEL · SOVIET CENTRAL ASIA AND THE FAR EAST ARE IN REACH · MOSCOW IS NOT` },
    { time: last + 90 * MIN, text: 'AND THE PROGRAMME IS NOT ENDED. THE WEAPONS ALREADY BUILT ARE NOT AT THESE ADDRESSES, THE INTERIOR PLANTS ARE ALREADY BEING DUG, AND PLANT 221’S OWN MOVE TO MIANYANG BEGINS IN OCTOBER 1969' },
    { time: last + 150 * MIN, text: 'NO SUCH PLAN IS ON THE RECORD. EVERY SERIOUS WORK ON THE PERIOD HAS LOOKED FOR IT AND NOT FOUND IT; THE SOVIET STRATEGIC FORCES DID NOT CHANGE, AND THE EASTERN MISSILE FORCE WAS DISBANDED THE YEAR AFTER. THIS IS THE ARITHMETIC OF A THREAT, NOT THE RECONSTRUCTION OF AN ORDER' },
  ]

  return {
    id: 'sino-soviet-1969',
    title: 'THE NUCLEAR SURGERY',
    subtitle: `A Soviet strike on the Chinese nuclear complex, 1969 · ${a.operating} operating facilities, ${a.sorties} sorties of ${F.weapon.yieldKt} kt · no such plan is on the record · 1969 grid`,
    bounds: { start: -45 * MIN, end: last + 48 * 3_600 },
    startTime: -45 * MIN,
    view: { center: [100, 41], zoom: 3.4 },
    entities,
    events,
    omissions: [
      'No Soviet plan, target list or order against China from 1969 has been released, and every serious work on the period that has looked for one has failed to find it. This is what a disarming strike on the documented complex implies, not a reconstruction of anything on the record',
      `The weapon is inferred: ${F.weapon.note}`,
      'The border war itself, the eleven Soviet divisions that became forty, and the conventional campaign any of this would have started are not drawn. The scholarship’s own answer to why Moscow did not strike is mostly about that campaign rather than about China’s arsenal',
      'No Chinese air defence as entities and no route planning around it: the aircraft fly great circles at altitude, which the northwest of China in 1969 would very nearly have permitted',
      'The Chinese answer is described and not flown. Two Tu-16 and a handful of DF-2A would not have changed the outcome, and drawing them would suggest a symmetry that did not exist',
      'The fallout wind is assumed, not forecast: twenty-five miles an hour from the west, which is the prevailing flow over the northwest. A different wind puts the same activity over different people, and the plume shape at forty-eight hours is order of magnitude and general direction',
      'The population grid is the 1969 HYDE reconstruction at five arc minutes, which is a model of where people were and not a census of it',
    ],
    populationGrid: 'popc_1969',
    defaultBurst: 'surface',
    surfaceBounds: { start: -45 * MIN, end: last + 48 * 3_600 },
    exposureWorkers: 2,
    sides: { attacker: { name: 'The Soviet Union' }, defender: { name: 'China' } },
    links: [
      { label: 'The dossier: what is documented, contested and unestablished about 1969', href: './dossier/sino-soviet-1969.html' },
      { label: 'The chronicle: the stockpiles either side held', href: '#/chronicle' },
      { label: 'The 72 minutes: a single strike, decided in modern time', href: '#/study/72-minutes' },
      { label: 'The accuracy lab: what a surface burst on a works actually does', href: '#/lab/accuracy' },
    ],
  }
}
