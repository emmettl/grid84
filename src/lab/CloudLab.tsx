import type { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatGrid, type LngLat } from '../geo/geodesy.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { ControlSheet, ReadingSheet } from '../hud/sheets.tsx'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { CLOUD, cloudRadiusMetres, cloudTopMetres, falloutRegime, stabilisedCloud, tropopauseMetres } from '../models/cloud.ts'
import { fireballRadiusMetres } from '../models/blast.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'
import { placeLabels } from '../chart/labels.ts'

/**
 * The cloud lab.
 *
 * The mushroom cloud is the picture everybody has of a nuclear explosion and
 * almost the only part of one that does nothing to anybody. It is here for the
 * single thing about it that matters to the rest of this engine: where it
 * stops rising decides whether the fission products come down on a county
 * within a day or on a hemisphere over years, and only the first of those is
 * the plume the fallout model draws.
 *
 * So what is drawn is the plan of the cloud over real ground — which is the
 * honest view from directly above, and which shows at a glance that a
 * megatonne cloud is wider than most cities — and an elevation against the
 * tropopause, which is where the answer is. There is no attempt at the
 * broiling updraft itself; it would be the first thing on this site that was
 * drawn rather than computed.
 */

interface Preset {
  id: string
  name: string
  center: LngLat
  yieldKt: number
  note: string
}

const PRESETS: Preset[] = [
  { id: 'hiroshima', name: 'Little Boy · 15 kt', center: [132.4553, 34.3853], yieldKt: 15, note: 'Hiroshima, 6 August 1945. The cloud was photographed at around 6 km and stayed well inside the troposphere: its fallout was local, and most of it fell as the black rain north-west of the city.' },
  { id: 'w49', name: 'W49 · 1.44 Mt', center: [177.467, 64.733], yieldKt: 1_440, note: 'The Atlas warhead of the SIOP//62 proof, over Anadyr at 64° north, where the tropopause is low. The cloud goes through it with room to spare.' },
  { id: 'bravo', name: 'Castle Bravo · 15 Mt', center: [165.27, 11.7], yieldKt: 15_000, note: '1 March 1954, Bikini, at 11° north where the tropopause stands near its highest. The cloud went through it anyway and the stratospheric fraction was measured worldwide for years.' },
  { id: 'w76', name: 'W76 · 100 kt', center: [37.6176, 55.7558], yieldKt: 100, note: 'The most numerous warhead in the American arsenal, over Moscow. A hundred kilotonnes is inside the band where Glasstone says the height curve flattens against the tropopause, so this is the case the answer is closest on.' },
]

const YIELDS = [1, 15, 100, 350, 1_440, 15_000]

const km = (m: number) => (m >= 10_000 ? `${(m / 1_000).toFixed(0)} km` : m >= 1_000 ? `${(m / 1_000).toFixed(1)} km` : `${Math.round(m)} m`)
const ktLabel = (kt: number) => (kt >= 1_000 ? `${(kt / 1_000).toFixed(kt % 1_000 === 0 ? 0 : 2)} Mt` : `${kt} kt`)

/*
 * These charts live in the hud's side columns rather than in the wide middle,
 * because the middle is the map and the map is half the point. So they are
 * drawn at about the width of a column and scale to roughly life size there,
 * instead of being a 640-unit drawing shrunk to sixty per cent with six-pixel
 * type on it.
 */
const W = 380
const H = 250
const PAD = { l: 46, r: 14, t: 14, b: 32 }

/**
 * Cloud top and head radius against yield, with the tropopause across it. The
 * crossing is the whole reading, so it is a line on the chart and not a
 * sentence underneath it.
 */
function CloudCurves({ yieldKt, latitude }: { yieldKt: number; latitude: number }) {
  const minKt = 0.5
  const maxKt = 100_000
  const yMaxKm = 50
  const x = (kt: number) => PAD.l + ((Math.log10(kt) - Math.log10(minKt)) / (Math.log10(maxKt) - Math.log10(minKt))) * (W - PAD.l - PAD.r)
  const y = (km_: number) => H - PAD.b - (km_ / yMaxKm) * (H - PAD.t - PAD.b)
  const samples = useMemo(() => {
    const pts: Array<{ kt: number; top: number; radius: number }> = []
    for (let i = 0; i <= 160; i += 1) {
      const kt = minKt * (maxKt / minKt) ** (i / 160)
      pts.push({ kt, top: cloudTopMetres(kt) / 1_000, radius: cloudRadiusMetres(kt) / 1_000 })
    }
    return pts
  }, [])
  const path = (pick: (p: { top: number; radius: number }) => number) => `M${samples.map((p) => `${x(p.kt).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' L')}`
  const tropKm = tropopauseMetres(latitude) / 1_000
  const here = { top: cloudTopMetres(yieldKt) / 1_000, radius: cloudRadiusMetres(yieldKt) / 1_000 }
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Stabilized cloud top and head radius against yield, with the tropopause">
      {[0, 20, 40].map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={PAD.l - 8} y={y(t) + 3} className="tick" textAnchor="end">
            {t} km
          </text>
        </g>
      ))}
      {[1, 100, 10_000].map((kt) => (
        <text key={kt} x={x(kt)} y={H - PAD.b + 16} className="tick" textAnchor="middle">
          {ktLabel(kt)}
        </text>
      ))}
      {/* §2.16: the height curve flattens between about 20 and 100 kt, and the tropopause is why. */}
      <rect x={x(CLOUD.tropopauseFlatteningKt[0])} y={PAD.t} width={x(CLOUD.tropopauseFlatteningKt[1]) - x(CLOUD.tropopauseFlatteningKt[0])} height={H - PAD.t - PAD.b} className="cl-band" />
      <line x1={PAD.l} x2={W - PAD.r} y1={y(tropKm)} y2={y(tropKm)} className="cl-tropopause" />
      <text x={W - PAD.r} y={y(tropKm) - 5} className="tick" textAnchor="end">
        tropopause at {latitude.toFixed(0)}° · {tropKm.toFixed(1)} km
      </text>
      <path d={path((p) => p.top)} className="series series--weapons" />
      <path d={path((p) => p.radius)} className="series series--systems" />
      {placeLabels(
        [
          { id: 'top', x: x(20_000), y: y(cloudTopMetres(20_000) / 1_000) - 8, text: 'cloud top', anchor: 'end', markX: x(20_000), markY: y(cloudTopMetres(20_000) / 1_000) },
          { id: 'radius', x: x(20_000), y: y(cloudRadiusMetres(20_000) / 1_000) + 14, text: 'head radius', anchor: 'end', markX: x(20_000), markY: y(cloudRadiusMetres(20_000) / 1_000) },
        ],
        { top: PAD.t, bottom: H - PAD.b },
      ).map((l) => (
        <text key={l.id} x={l.x} y={l.py} className="label" textAnchor={l.anchor}>
          {l.text}
        </text>
      ))}
      <line x1={x(yieldKt)} x2={x(yieldKt)} y1={PAD.t} y2={H - PAD.b} className="grid grid--needed" />
      <circle cx={x(yieldKt)} cy={y(here.top)} r={5} className="mark mark--weapons" />
      <circle cx={x(yieldKt)} cy={y(here.radius)} r={5} className="mark mark--systems" />
      <text x={W - PAD.r} y={H - 4} className="tick" textAnchor="end">
        yield · Glasstone &amp; Dolan Fig. 2.16, fitted
      </text>
    </svg>
  )
}

const EH = 170
const EPAD = { l: 42, r: 14, t: 14, b: 24 }

/**
 * The same cloud in elevation, to scale, against the tropopause. Not a
 * drawing of a mushroom: a rectangle from the base of the head to its top at
 * the head's own radius, the stem under it at the stem's radius, and the one
 * line that matters across the whole thing.
 */
function CloudProfile({ yieldKt, latitude }: { yieldKt: number; latitude: number }) {
  const cloud = stabilisedCloud(yieldKt, latitude)
  const topKm = cloud.topMetres / 1_000
  const tropKm = cloud.tropopauseMetres / 1_000
  const yMax = Math.max(topKm * 1.12, tropKm * 1.25, 8)
  const halfWidthKm = Math.max(cloud.radiusMetres / 1_000, 1)
  const xSpan = halfWidthKm * 2.6
  const cx = EPAD.l + (W - EPAD.l - EPAD.r) / 2
  const sx = (W - EPAD.l - EPAD.r) / xSpan
  const y = (k: number) => EH - EPAD.b - (k / yMax) * (EH - EPAD.t - EPAD.b)
  // Glasstone gives the base of the head only for a cloud that stays under the
  // tropopause; where he gives no rule the head is drawn from the tropopause up
  // and the readout says the base is not given.
  const baseKm = cloud.baseMetres !== null ? cloud.baseMetres / 1_000 : Math.min(tropKm, topKm * 0.55)
  const stemKm = cloud.stemRadiusMetres[1] / 1_000
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${EH}`} role="img" aria-label="The stabilized cloud in elevation against the tropopause">
      {Array.from({ length: 4 }, (_, i) => (yMax / 3) * i).map((t) => (
        <g key={t}>
          <line x1={EPAD.l} x2={W - EPAD.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={EPAD.l - 8} y={y(t) + 3} className="tick" textAnchor="end">
            {t.toFixed(0)} km
          </text>
        </g>
      ))}
      {tropKm < yMax && (
        <>
          <rect x={EPAD.l} y={EPAD.t} width={W - EPAD.l - EPAD.r} height={Math.max(0, y(tropKm) - EPAD.t)} className="cl-strato" />
          <line x1={EPAD.l} x2={W - EPAD.r} y1={y(tropKm)} y2={y(tropKm)} className="cl-tropopause" />
          <text x={EPAD.l + 4} y={y(tropKm) - 5} className="tick">
            tropopause · {tropKm.toFixed(1)} km · above it nothing washes out
          </text>
        </>
      )}
      <rect x={cx - stemKm * sx} y={y(baseKm)} width={stemKm * 2 * sx} height={Math.max(0, y(0) - y(baseKm))} className="cl-stem" />
      <rect x={cx - halfWidthKm * sx} y={y(topKm)} width={halfWidthKm * 2 * sx} height={Math.max(0, y(baseKm) - y(topKm))} className="cl-head" />
      <line x1={EPAD.l} x2={W - EPAD.r} y1={y(0)} y2={y(0)} className="cl-ground" />
      <line x1={cx - halfWidthKm * sx} x2={cx + halfWidthKm * sx} y1={y(topKm) - 9} y2={y(topKm) - 9} className="cl-measure" />
      <text x={cx} y={y(topKm) - 13} className="tick" textAnchor="middle">
        {km(cloud.radiusMetres * 2)} across
      </text>
      <text x={W - EPAD.r} y={y(topKm) + 12} className="tick" textAnchor="end">
        top {km(cloud.topMetres)}
      </text>
      <text x={W - EPAD.r} y={EH - 4} className="tick" textAnchor="end">
        to scale · {ktLabel(yieldKt)} · ten minutes after the burst
      </text>
    </svg>
  )
}

export function CloudLab() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [preset, setPreset] = useState<Preset>(PRESETS[1])
  const [center, setCenter] = useState<LngLat>(PRESETS[1].center)
  const [yieldKt, setYieldKt] = useState(PRESETS[1].yieldKt)
  const [ready, setReady] = useState(false)

  const latitude = center[1]
  const cloud = useMemo(() => stabilisedCloud(yieldKt, latitude), [yieldKt, latitude])
  const fireball = useMemo(() => fireballRadiusMetres(yieldKt), [yieldKt])

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center, zoom: 8, pitch: 0 })
    mapRef.current = map
    map.on('load', () => {
      installTerrainSync(map)
      installEvidenceLayers(map)
      setReady(true)
    })
    map.on('click', (e) => {
      setPreset({ id: 'custom', name: 'Custom', center: [e.lngLat.lng, e.lngLat.lat], yieldKt, note: 'Ground zero placed by hand. The tropopause follows the latitude, so the same weapon answers differently here than it did there.' })
      setCenter([e.lngLat.lng, e.lngLat.lat])
    })
    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const ring = (metres: number) => geodesicCircle(center, metres).map((p) => [p[0], p[1]])
    const head = ring(cloud.radiusMetres)
    const stem = ring(cloud.stemRadiusMetres[1])
    const areas: EvidenceFeature[] = [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [head] }, properties: { evidence: 'reconstructed', id: 'cloud-head', cloud: 'head' } },
    ]
    const rings: EvidenceFeature[] = [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: head }, properties: { evidence: 'reconstructed', id: 'cloud-head-line', cloud: 'head' } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: stem }, properties: { evidence: 'reconstructed', id: 'cloud-stem-line', cloud: 'stem' } },
      // The fireball, for scale: the cloud is what the fireball becomes.
      { type: 'Feature', geometry: { type: 'LineString', coordinates: ring(fireball) }, properties: { evidence: 'modelled', id: 'fireball' } },
    ]
    setSourceData(map, SOURCES.areas, areas)
    setSourceData(map, SOURCES.rings, rings)
    setSourceData(map, SOURCES.sites, [{ type: 'Feature', geometry: { type: 'Point', coordinates: [center[0], center[1]] }, properties: { evidence: 'modelled', id: 'gz' } }])
  }, [cloud, center, fireball, ready])

  // A change of yield changes the cloud by a factor of twenty across the
  // presets, so the camera follows it rather than staying where it was.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const want = zoomFor(yieldKt, center[1])
    if (Math.abs(map.getZoom() - want) > 0.4) map.easeTo({ zoom: want, duration: 900, essential: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yieldKt, ready])

  /**
   * Frame the cloud rather than the place: a 15 kt head is 3 km across and a
   * 15 Mt head is 60, and a fixed zoom shows one of them as a dot and the
   * other off the edge. Three cloud widths across the canvas, whatever the
   * weapon.
   */
  const zoomFor = (kt: number, lat: number) => {
    const span = Math.max(2_000, cloudRadiusMetres(kt) * 6)
    const width = mapRef.current?.getCanvas().clientWidth ?? 1_000
    return Math.max(3, Math.min(13, Math.log2((40_075_017 * Math.cos((lat * Math.PI) / 180) * width) / (512 * span))))
  }

  const applyPreset = (p: Preset) => {
    setPreset(p)
    setCenter(p.center)
    setYieldKt(p.yieldKt)
    mapRef.current?.flyTo({ center: [p.center[0], p.center[1]], zoom: zoomFor(p.yieldKt, p.center[1]), pitch: 0, duration: 2_500, essential: true })
  }

  return (
    <div className="study cloud-lab">
      <div ref={container} className="atlas-map" aria-label="Cloud lab" />
      <div className="atlas-vignette" aria-hidden="true" />
      <div className="study-hud lab-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · THE STABILIZED CLOUD</strong>
          <span>Where the cloud stops rising decides where the fallout goes</span>
        </header>

        <ControlSheet id="cloud">
          <section className="clock" aria-label="Burst">
            <h2>Case</h2>
            <div className="clock-controls">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className={preset.id === p.id ? 'is-active' : ''} title={p.note} onClick={() => applyPreset(p)}>
                  {p.name}
                </button>
              ))}
            </div>
            <p className="log-empty">{preset.note}</p>
            <p className="log-empty">Ground zero {formatGrid(center)}</p>
            <h2>Yield</h2>
            <div className="clock-controls">
              {YIELDS.map((kt) => (
                <button key={kt} type="button" className={yieldKt === kt ? 'is-active' : ''} onClick={() => setYieldKt(kt)}>
                  {ktLabel(kt)}
                </button>
              ))}
            </div>
            <input type="range" min={Math.log10(0.5)} max={Math.log10(100_000)} step={0.01} value={Math.log10(yieldKt)} aria-label="Yield" onChange={(e) => setYieldKt(Number((10 ** Number(e.target.value)).toPrecision(3)))} />
            <p className="log-empty">
              {ktLabel(yieldKt)} · fireball {km(fireball)} radius
              {cloud.extrapolated && (
                <>
                  {' '}
                  <span className="badge badge--inferred">PAST EVERY TEST</span>
                </>
              )}
            </p>
          </section>
        </ControlSheet>

        <ReadingSheet id="cloud">
          <section className="log" aria-label="The cloud">
            <h2>
              Ten minutes after the burst <span className="badge badge--reconstructed">RECONSTRUCTED</span>
            </h2>
            <dl className="grid-facts">
              <dt>Cloud top</dt>
              <dd>{km(cloud.topMetres)}</dd>
              <dt>Head radius</dt>
              <dd>
                {km(cloud.radiusMetres)} · {km(cloud.radiusMetres * 2)} across
              </dd>
              <dt>Base of the head</dt>
              <dd>{cloud.baseMetres === null ? <span className="badge badge--withheld">NO RULE GIVEN</span> : km(cloud.baseMetres)}</dd>
              <dt>Stem radius</dt>
              <dd>
                {cloud.stemRadiusMetres[0] === cloud.stemRadiusMetres[1] ? km(cloud.stemRadiusMetres[0]) : `${km(cloud.stemRadiusMetres[0])} to ${km(cloud.stemRadiusMetres[1])}`}
              </dd>
              <dt>Tropopause here</dt>
              <dd>
                {km(cloud.tropopauseMetres)} at {Math.abs(latitude).toFixed(1)}°{latitude >= 0 ? ' N' : ' S'}
              </dd>
              <dt>Through it</dt>
              <dd className={cloud.penetratesTropopause ? 'is-fire' : ''}>{cloud.penetratesTropopause ? 'YES' : 'NO'}</dd>
              <dt>Stabilises at</dt>
              <dd>H+{cloud.minutesToStabilise} min</dd>
            </dl>
            <p className="log-empty">{falloutRegime(cloud)}</p>
          </section>

          <section className="provenance" aria-label="Against yield">
            <h2>
              Cloud against yield <span className="badge badge--reconstructed">FIG. 2.16</span>
            </h2>
            <CloudCurves yieldKt={yieldKt} latitude={latitude} />
            <p className="provenance-method">
              The shaded band is the 20 to 100 kilotonne range where §2.16 says the height curve flattens, and the tropopause is the reason it does: a cloud arriving at the boundary with little buoyancy left spreads sideways instead of climbing. That kink is the one piece of physics in this chart, and it is visible in Glasstone’s own figure.
            </p>
            <p className="provenance-method">The elevation below is the same cloud to scale: head and stem at their own radii, base to top. Not a drawing of a mushroom — the shape of one is not computed here and would be the only thing on this site that was drawn rather than worked out.</p>
            <p className="provenance-source">{cloud.source}</p>
            <p className="provenance-method">{cloud.method}</p>
            <p className="provenance-method">
              The tropopause is the ICAO Standard Atmosphere’s 11 km, moved with latitude on a cosine between about 8 km over the poles and 17 km over the tropics. That shape is inferred, not measured: the real boundary moves with the season and the weather, and a burst whose top lands near it is a burst whose answer depends on the day.
            </p>
          </section>

          {/*
            * The elevation takes the third column's lower slot, which is where
            * this hud puts a second reading panel. It is the picture the
            * numbers above are of, and it is the one drawing in the lab that
            * answers the question at a glance.
            */}
          <section className="provenance recorded" aria-label="In elevation">
            <h2>
              In elevation <span className="badge badge--reconstructed">TO SCALE</span>
            </h2>
            <CloudProfile yieldKt={yieldKt} latitude={latitude} />
          </section>

          <section className="omissions" aria-label="Not represented">
            <h2>Not represented</h2>
            <ul>
              <li>The rise itself: this is the cloud at ten minutes, stabilised, not the updraft that makes it</li>
              <li>How the activity divides between head and stem, which decides how much fallout is local</li>
              <li>The stratospheric fraction and where it lands — real, and nobody’s local dose</li>
              <li>Weather: Fig. 2.16 is an average of continental conditions</li>
            </ul>
          </section>
        </ReadingSheet>

        <EvidenceLegend />
      </div>
    </div>
  )
}
