import { EARTH_RADIUS_METRES } from '../geo/geodesy.ts'

/**
 * Hitting a bullet with a bullet, phase by phase.
 *
 * A missile can be engaged while its motor burns, while it coasts through
 * space, while it glides through the upper atmosphere, or in the last
 * seconds as it comes down. Each phase offers the defence something and
 * takes something away, and the arithmetic of what it takes away is the
 * whole subject.
 *
 *   BOOST. The target is one bright slow object with everything still
 *   aboard, and killing it there drops the warheads short, on whoever is
 *   under the trajectory. But the motor burns for three to five minutes,
 *   detection and a decision eat most of that, and what is left times the
 *   interceptor's speed is a circle the interceptor must already be inside
 *   when the missile lifts. Nobody can be everywhere, so a space layer has
 *   to buy the whole sky to have one shooter over the right place: that
 *   ratio is the absentee problem, and it is why the numbers proposed for
 *   space-based defence have always been in the thousands.
 *
 *   MIDCOURSE. Twenty minutes of flight and no hurry, which is why every
 *   deployed strategic defence works here. The price is vacuum: a balloon
 *   weighing a few hundred grammes and a reentry vehicle weighing hundreds
 *   of kilogrammes follow exactly the same path, because there is nothing
 *   to tell them apart with. The defence must therefore shoot at
 *   everything, and the attacker's cheapest countermeasure is a bag of
 *   balloons.
 *
 *   GLIDE. A vehicle that flies at forty kilometres instead of arcing to a
 *   thousand stays under the horizon of a ground radar for most of its
 *   flight and manoeuvres while it is there, so the defence sees it late
 *   and cannot predict where it will be. This is the whole point of a
 *   glide vehicle and it is geometry, not stealth.
 *
 *   TERMINAL. The defence knows exactly where the target is going, because
 *   it is going to the thing being defended. What it does not have is
 *   time: tens of seconds, and a footprint whose radius is the interceptor's
 *   speed times those seconds. That is why terminal defences protect a base
 *   or a city and not a country.
 *
 * Everything here is the standard arithmetic, and it is checked in
 * intercept.test.ts against the footprints of two deployed systems.
 */

export type Phase = 'boost' | 'midcourse' | 'glide' | 'terminal'

export const PHASES: Array<{ id: Phase; name: string; gives: string; takes: string }> = [
  { id: 'boost', name: 'Boost', gives: 'One object, slow, bright, with every warhead still on it', takes: 'Three to five minutes, most of it spent seeing and deciding' },
  { id: 'midcourse', name: 'Midcourse', gives: 'Twenty minutes and no hurry', takes: 'A vacuum, in which a balloon and a warhead are the same object' },
  { id: 'glide', name: 'Glide', gives: 'Air, which sorts the light from the heavy', takes: 'The horizon, and a target that manoeuvres inside it' },
  { id: 'terminal', name: 'Terminal', gives: 'Certainty about where it is going', takes: 'Seconds, and a footprint the size of a city' },
]

/** Detection and decision, before anything can be fired. Round figures, and generous ones. */
export const DETECT_SECONDS = 60
export const DECIDE_SECONDS = 30

export interface Window {
  /** Seconds from launch to the end of the phase. */
  phaseSeconds: number
  detectSeconds: number
  decideSeconds: number
  /** What is left for the interceptor to fly in. */
  availableSeconds: number
}

export function window(phaseSeconds: number, detectSeconds = DETECT_SECONDS, decideSeconds = DECIDE_SECONDS): Window {
  return { phaseSeconds, detectSeconds, decideSeconds, availableSeconds: Math.max(0, phaseSeconds - detectSeconds - decideSeconds) }
}

/** The ground radius an interceptor of this speed can cover in the window it has. */
export function reachMetres(w: Window, speedMs: number): number {
  return w.availableSeconds * speedMs
}

export interface Absentee {
  reachMetres: number
  /** The fraction of a constellation that is within reach of a given launch point at a given moment. */
  fraction: number
  /** How many interceptors must be owned for one to be in place: the absentee ratio. */
  ratio: number
  /** Expected number in place, and the chance at least one is. */
  expected: number
  chance: number
}

/**
 * The absentee problem. Interceptors in low orbit are spread over a sphere
 * and go round it; only those inside the reach circle when the missile
 * lifts can do anything, and the rest are somewhere else. The fraction is
 * the spherical cap the reach cuts out of the shell they orbit on.
 */
export function absentee(reach: number, constellation: number, altitudeMetres: number): Absentee {
  const shell = EARTH_RADIUS_METRES + altitudeMetres
  const theta = Math.min(Math.PI, reach / shell)
  // Cap area over sphere area: (1 − cos θ) / 2.
  const fraction = (1 - Math.cos(theta)) / 2
  const expected = constellation * fraction
  return { reachMetres: reach, fraction, ratio: fraction > 0 ? 1 / fraction : Infinity, expected, chance: 1 - Math.exp(-expected) }
}

/**
 * How far a sensor can see an object, metres along the ground: the sum of
 * the two horizon distances, for the sensor's own height and the target's
 * altitude. This is the whole argument for a glide vehicle. A reentry
 * vehicle at a thousand kilometres of apogee is over the horizon of a
 * coastal radar at three and a half thousand kilometres; the same radar
 * does not see a glide vehicle at forty kilometres until it is seven
 * hundred away, which at three kilometres a second is four minutes of
 * warning against twenty.
 */
export function horizonMetres(sensorHeightMetres: number, targetAltitudeMetres: number): number {
  const R = EARTH_RADIUS_METRES
  return Math.sqrt(2 * R * Math.max(0, sensorHeightMetres)) + Math.sqrt(2 * R * Math.max(0, targetAltitudeMetres))
}

export interface Footprint {
  /** Seconds between the first moment the interceptor could fly and the last moment it could still arrive. */
  secondsAvailable: number
  /** The radius of ground a battery can defend, metres. */
  radiusMetres: number
  /** The area that defends, square kilometres. */
  areaSqKm: number
}

/**
 * The defended footprint of a terminal battery.
 *
 * The reentry vehicle comes down through the engagement band at its own
 * speed and angle; the time it spends inside that band, less the reaction,
 * is the time the interceptor has to get there, and the interceptor's speed
 * times that time is how far from the battery the intercept can happen.
 * The formula is the standard one and it reproduces both published
 * footprints, the two hundred kilometres of a high terminal battery and the
 * twenty of a point-defence one, from their own interceptor speeds.
 */
export function footprint(input: {
  interceptorSpeedMs: number
  /** Altitude at which the battery can first engage, and the lowest it can still intercept. */
  ceilingMetres: number
  floorMetres: number
  /** The reentry vehicle's speed and the angle it comes down at, degrees from the horizontal. */
  reentrySpeedMs: number
  reentryAngleDeg: number
  reactionSeconds?: number
}): Footprint {
  const descentMs = input.reentrySpeedMs * Math.sin((input.reentryAngleDeg * Math.PI) / 180)
  const throughBand = descentMs > 0 ? Math.max(0, input.ceilingMetres - input.floorMetres) / descentMs : 0
  const seconds = Math.max(0, throughBand - (input.reactionSeconds ?? 0))
  const radius = seconds * input.interceptorSpeedMs
  return { secondsAvailable: seconds, radiusMetres: radius, areaSqKm: (Math.PI * radius * radius) / 1e6 }
}

/**
 * What a miss is made of.
 *
 * A kill vehicle closing at ten kilometres a second turns a tenth of a
 * second of uncertainty about when the target will be somewhere into a
 * kilometre of being in the wrong place. Sideways error adds to that, and
 * the kill vehicle has only its own small thrusters and the seconds since
 * handover to cancel the total. This is the sentence about the bullet, as
 * arithmetic.
 */
export function missDistanceMetres(input: { lateralErrorMetres: number; timingErrorSeconds: number; closingSpeedMs: number; handoverSeconds: number }): {
  alongTrackMetres: number
  missMetres: number
  divertNeededMs: number
} {
  const alongTrackMetres = input.timingErrorSeconds * input.closingSpeedMs
  const missMetres = Math.hypot(input.lateralErrorMetres, alongTrackMetres)
  // To move that far sideways under constant thrust in the time left: s = ½at², so Δv = at = 2s/t.
  const divertNeededMs = input.handoverSeconds > 0 ? (2 * missMetres) / input.handoverSeconds : Infinity
  return { alongTrackMetres, missMetres, divertNeededMs }
}

/**
 * A balloon and a warhead in vacuum. The only force is gravity, which acts
 * on mass and produces the same acceleration whatever the mass, so the two
 * follow the same path exactly. In air the balloon slows at once, because
 * drag deceleration goes as area over mass. This returns the deceleration
 * of each at a given air density and the altitude at which they part
 * company, which is the altitude at which the defence can finally tell them
 * apart — and it is below the ceiling of most of the interceptors that
 * would have to do the telling.
 */
export function decelerationMs2(ballisticCoefficientKgPerSqM: number, airDensityKgPerCubicM: number, speedMs: number, dragCoefficient = 1): number {
  if (ballisticCoefficientKgPerSqM <= 0) return 0
  return (0.5 * airDensityKgPerCubicM * speedMs * speedMs * dragCoefficient) / ballisticCoefficientKgPerSqM
}

/** Air density by the exponential atmosphere, kg/m³: 1.225 at sea level with a 7.2 km scale height. */
export function airDensity(altitudeMetres: number): number {
  return 1.225 * Math.exp(-altitudeMetres / 7_200)
}

/**
 * The altitude at which a light decoy has fallen a stated distance behind a
 * heavy reentry vehicle, which is the first moment the two can be told
 * apart by anything but guesswork.
 */
export function discriminationAltitudeMetres(input: {
  warheadBeta: number
  decoyBeta: number
  speedMs: number
  separationMetres: number
  reentryAngleDeg: number
}): number {
  const sin = Math.sin((input.reentryAngleDeg * Math.PI) / 180)
  let lag = 0
  let lastAltitude = 0
  // Walk down from a hundred kilometres in hundred-metre steps, accumulating the difference in the distance each has flown.
  for (let h = 100_000; h > 0; h -= 100) {
    const rho = airDensity(h)
    const dt = 100 / (input.speedMs * sin)
    const dv = (decelerationMs2(input.decoyBeta, rho, input.speedMs) - decelerationMs2(input.warheadBeta, rho, input.speedMs)) * dt
    lag += dv * dt * 0.5 + lag * 0
    lastAltitude = h
    if (lag >= input.separationMetres) return h
  }
  return lastAltitude
}
