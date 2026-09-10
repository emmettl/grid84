import { haversineMetres, type LngLat } from '../geo/geodesy.ts'
import type { EffectEntity, SiteEntity, Study, TrackEntity } from './study.ts'

/**
 * The whole missile behind one warhead. A MIRVed vehicle is enacted as a
 * bus track that ends at separation and one track per reentry vehicle from
 * there, named `<bus>-rv<k>`; a detonation records the vehicles that
 * delivered it. From any of those, this finds the bus, the separation
 * point, every sibling vehicle and every detonation they made.
 */
export interface Missile {
  bus: TrackEntity
  /** 'bus' for a ballistic missile's reentry vehicles; 'aircraft' for a bomber's cruise missiles released at a standoff. */
  kind: 'bus' | 'aircraft'
  vehicles: TrackEntity[]
  separation: { position: LngLat; time: number; altitude: number }
  /** The detonations the bus's vehicles delivered, in the order of the vehicles. */
  effects: EffectEntity[]
}

const RV = /^(.+)-(?:rv|cm)(\d+)$/

export function busIdOf(trackId: string): string {
  const m = RV.exec(trackId)
  return m ? m[1] : trackId
}

export function missileOf(study: Study, entityId: string | null): Missile | null {
  if (!entityId) return null
  const entity = study.entities.find((e) => e.id === entityId)
  if (!entity) return null
  const trackIds = entity.kind === 'track' ? [entity.id] : entity.kind === 'effect' ? (entity.deliveredBy ?? []) : []
  for (const id of trackIds) {
    const busId = busIdOf(id)
    const bus = study.entities.find((e) => e.kind === 'track' && e.id === busId)
    if (!bus || bus.kind !== 'track') continue
    const vehicles = study.entities.filter((e): e is TrackEntity => e.kind === 'track' && busIdOf(e.id) === busId && e.id !== busId).sort((a, b) => Number(RV.exec(a.id)?.[2] ?? 0) - Number(RV.exec(b.id)?.[2] ?? 0))
    if (vehicles.length === 0) continue
    const last = bus.track.waypoints[bus.track.waypoints.length - 1]
    const ids = new Set(vehicles.map((v) => v.id))
    const effects: EffectEntity[] = []
    for (const e of study.entities) if (e.kind === 'effect' && (e.deliveredBy ?? []).some((d) => ids.has(d))) effects.push(e)
    const kind: Missile['kind'] = vehicles.some((v) => /-cm\d+$/.test(v.id)) ? 'aircraft' : 'bus'
    // A bus ends at separation; an aircraft turns for home there, so the release point is the vehicles' start.
    const at = kind === 'aircraft' ? vehicles[0].track.waypoints[0] : last
    return { bus, kind, vehicles, separation: { position: at.position, time: at.time, altitude: at.altitude ?? 0 }, effects }
  }
  return null
}

/** What a launch point sent and what it hit: the vehicles whose tracks begin within a kilometre of the site, their reentry vehicles, and the detonations they delivered. */
export interface Launch {
  site: SiteEntity
  /** The vehicles that left the site: single missiles, buses and bombers. */
  tracks: TrackEntity[]
  /** The reentry vehicles those buses released. */
  vehicles: TrackEntity[]
  effects: EffectEntity[]
}

export function launchedFrom(study: Study, siteId: string | null): Launch | null {
  if (!siteId) return null
  const site = study.entities.find((e): e is SiteEntity => e.kind === 'site' && e.id === siteId)
  if (!site) return null
  // A vehicle belongs to the site it starts at, or whose name it carries: a division's missiles are spread over its field by rule and start kilometres from the site's mark.
  const named = (t: TrackEntity) => t.name.startsWith(`${site.name} →`) || t.name.startsWith(`${site.name} (`)
  const tracks = study.entities.filter((e): e is TrackEntity => e.kind === 'track' && !RV.test(e.id) && (named(e) || haversineMetres(e.track.waypoints[0].position, site.position) < 1_000))
  if (tracks.length === 0) return null
  const busIds = new Set(tracks.map((t) => t.id))
  const vehicles = study.entities.filter((e): e is TrackEntity => e.kind === 'track' && RV.test(e.id) && busIds.has(busIdOf(e.id)))
  const ids = new Set([...tracks, ...vehicles].map((t) => t.id))
  const effects: EffectEntity[] = []
  for (const e of study.entities) if (e.kind === 'effect' && (e.deliveredBy ?? []).some((d) => ids.has(d))) effects.push(e)
  return { site, tracks, vehicles, effects }
}
