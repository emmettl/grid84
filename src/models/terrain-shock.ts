/**
 * Blast over real terrain, at two fidelities.
 *
 * 1. Geometric shadowing: a ground cell is shadowed when the straight line
 *    from the burst point to it passes below the terrain. This is real for
 *    thermal radiation and a fair first cut for the direct blast.
 * 2. A linear acoustic wave on a 2D grid in which the terrain faces that
 *    block the line of sight act as hard reflectors. Diffraction around
 *    them and reflection off them emerge from the wave equation. Amplitude
 *    falls as 1/√r in 2D rather than 1/r for a real spherical shock, so
 *    only the ratio to a flat-ground run is reported: the terrain factor.
 *
 * Fidelity ceiling: a linear wave over a 2.5D surface. Qualitative
 * reflections and channelling, not pressures anyone should quote.
 */
export interface HeightGrid {
  /** Cells per side; the grid is square. */
  n: number
  /** Metres per cell. */
  dx: number
  /** Terrain height above sea level, metres, row-major from the north-west corner. */
  h: Float32Array
}

export interface BurstPoint {
  /** Cell coordinates, may be fractional. */
  x: number
  y: number
  /** Height of burst above the ground at (x, y), metres. */
  hob: number
}

export interface ShadowResult {
  /** 1 where the burst is visible from the ground, 0 where it is not. */
  visible: Uint8Array
  /** 1 on the first terrain cell each ray hits: the faces that block. */
  blockers: Uint8Array
  /** Fraction of cells visible. */
  visibleFraction: number
}

function sample(grid: HeightGrid, x: number, y: number): number {
  const n = grid.n
  const cx = Math.min(n - 1.001, Math.max(0, x))
  const cy = Math.min(n - 1.001, Math.max(0, y))
  const x0 = Math.floor(cx)
  const y0 = Math.floor(cy)
  const fx = cx - x0
  const fy = cy - y0
  const h = grid.h
  const a = h[y0 * n + x0]
  const b = h[y0 * n + x0 + 1]
  const c = h[(y0 + 1) * n + x0]
  const d = h[(y0 + 1) * n + x0 + 1]
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

/** Line-of-sight shadow map from the burst. Eye height at each ground cell is 2 metres. */
export function shadowMap(grid: HeightGrid, burst: BurstPoint, eyeMetres = 2): ShadowResult {
  const n = grid.n
  const visible = new Uint8Array(n * n)
  const blockers = new Uint8Array(n * n)
  const zBurst = sample(grid, burst.x, burst.y) + burst.hob
  let count = 0
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const zTarget = grid.h[y * n + x] + eyeMetres
      const ddx = x - burst.x
      const ddy = y - burst.y
      const length = Math.hypot(ddx, ddy)
      const steps = Math.max(2, Math.ceil(length * 1.5))
      let clear = 1
      for (let s = 1; s < steps; s += 1) {
        const f = s / steps
        const px = burst.x + ddx * f
        const py = burst.y + ddy * f
        const zRay = zBurst + (zTarget - zBurst) * f
        if (sample(grid, px, py) > zRay) {
          clear = 0
          const bx = Math.round(px)
          const by = Math.round(py)
          blockers[by * n + bx] = 1
          break
        }
      }
      visible[y * n + x] = clear
      count += clear
    }
  }
  return { visible, blockers, visibleFraction: count / (n * n) }
}

export interface WaveOptions {
  /** Sound speed, m/s. */
  c?: number
  /** Courant number below 1/√2. */
  courant?: number
  /** Per-step amplitude damping, 0 for none. */
  damping?: number
  /** Source pulse width in cells. */
  pulseCells?: number
}

export class WaveField {
  readonly n: number
  readonly dx: number
  readonly dt: number
  readonly c: number
  private u0: Float32Array
  private u1: Float32Array
  private u2: Float32Array
  readonly peak: Float32Array
  private readonly wall: Uint8Array | null
  private readonly damping: number
  step = 0

  constructor(n: number, dx: number, wall: Uint8Array | null, options: WaveOptions = {}) {
    this.n = n
    this.dx = dx
    this.c = options.c ?? 340
    const courant = options.courant ?? 0.5
    this.dt = (courant * dx) / this.c
    this.u0 = new Float32Array(n * n)
    this.u1 = new Float32Array(n * n)
    this.u2 = new Float32Array(n * n)
    this.peak = new Float32Array(n * n)
    this.wall = wall
    this.damping = options.damping ?? 0.001
  }

  /** Inject a Gaussian pulse at fractional cell coordinates. */
  inject(x: number, y: number, amplitude = 1, widthCells = 2): void {
    const n = this.n
    const r = Math.ceil(widthCells * 3)
    for (let j = -r; j <= r; j += 1) {
      for (let i = -r; i <= r; i += 1) {
        const cx = Math.round(x) + i
        const cy = Math.round(y) + j
        if (cx < 0 || cy < 0 || cx >= n || cy >= n) continue
        const d2 = (cx - x) ** 2 + (cy - y) ** 2
        const v = amplitude * Math.exp(-d2 / (2 * widthCells * widthCells))
        this.u1[cy * n + cx] += v
        this.u0[cy * n + cx] += v
      }
    }
  }

  /** Current field. */
  get field(): Float32Array {
    return this.u1
  }

  advance(steps = 1): void {
    const n = this.n
    const k = ((this.c * this.dt) / this.dx) ** 2
    const decay = 1 - this.damping
    for (let s = 0; s < steps; s += 1) {
      const u0 = this.u0
      const u1 = this.u1
      const u2 = this.u2
      const wall = this.wall
      for (let y = 1; y < n - 1; y += 1) {
        for (let x = 1; x < n - 1; x += 1) {
          const i = y * n + x
          if (wall && wall[i]) {
            u2[i] = 0
            continue
          }
          const lap = u1[i - 1] + u1[i + 1] + u1[i - n] + u1[i + n] - 4 * u1[i]
          const v = (2 * u1[i] - u0[i] + k * lap) * decay
          u2[i] = v
          const a = Math.abs(v)
          if (a > this.peak[i]) this.peak[i] = a
        }
      }
      // Absorbing edge: copy inward neighbour scaled down, a crude sponge.
      for (let x = 0; x < n; x += 1) {
        u2[x] = u2[n + x] * 0.5
        u2[(n - 1) * n + x] = u2[(n - 2) * n + x] * 0.5
      }
      for (let y = 0; y < n; y += 1) {
        u2[y * n] = u2[y * n + 1] * 0.5
        u2[y * n + n - 1] = u2[y * n + n - 2] * 0.5
      }
      this.u0 = u1
      this.u1 = u2
      this.u2 = u0
      this.step += 1
    }
  }
}

/**
 * Terrain factor: peak amplitude with terrain over peak amplitude on flat
 * ground, per cell. Above 1 is reinforcement by reflection, below 1 is
 * shadow. Cells the flat run never reached are reported as 1.
 */
export function terrainFactor(withTerrain: Float32Array, flat: Float32Array, floor = 1e-4): Float32Array {
  const out = new Float32Array(withTerrain.length)
  for (let i = 0; i < out.length; i += 1) out[i] = flat[i] > floor ? withTerrain[i] / flat[i] : 1
  return out
}

/** Steps needed for the front to cross `metres` of ground. */
export function stepsToTravel(field: WaveField, metres: number): number {
  return Math.ceil(metres / (field.c * field.dt))
}

/** Fraction of cells inside a radius (in cells) that are visible, and the mean terrain factor there. */
export function discStatistics(n: number, cx: number, cy: number, radiusCells: number, visible: Uint8Array, factor: Float32Array | null): { visibleFraction: number; meanFactor: number; cells: number } {
  let cells = 0
  let vis = 0
  let sum = 0
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radiusCells * radiusCells) continue
      const i = y * n + x
      cells += 1
      vis += visible[i]
      sum += factor ? factor[i] : 1
    }
  }
  return { visibleFraction: cells ? vis / cells : 0, meanFactor: cells ? sum / cells : 1, cells }
}
