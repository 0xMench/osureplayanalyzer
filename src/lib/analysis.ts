import type { Beatmap, HitObject } from './beatmap'
import { KEY, type ReplayFrame } from './osr'
import type { ModInfo } from './mods'

// ---- Difficulty -> windows / radius -------------------------------------

export interface HitWindows {
  great: number // 300
  good: number // 100
  meh: number // 50
}

/** OD -> hit windows in milliseconds (std). HR/EZ adjust OD beforehand. */
export function hitWindows(od: number): HitWindows {
  return {
    great: 80 - 6 * od,
    good: 140 - 8 * od,
    meh: 200 - 10 * od,
  }
}

/** CS -> circle radius in osu!pixels. */
export function circleRadius(cs: number): number {
  return 54.4 - 4.48 * cs
}

export function adjustOD(od: number, mods: ModInfo): number {
  let v = od
  if (mods.hardRock) v = Math.min(v * 1.4, 10)
  else if (mods.easy) v = v * 0.5
  return v
}

export function adjustCS(cs: number, mods: ModInfo): number {
  let v = cs
  if (mods.hardRock) v = Math.min(v * 1.3, 10)
  else if (mods.easy) v = v * 0.5
  return v
}

// ---- Key-press events ----------------------------------------------------

export interface PressEvent {
  t: number
  x: number
  y: number
  /** 'left' = M1/K1, 'right' = M2/K2 */
  hand: 'left' | 'right'
  key: 'K1' | 'K2'
}

const LEFT_MASK = KEY.M1 | KEY.K1
const RIGHT_MASK = KEY.M2 | KEY.K2

/** Rising-edge detection for each hand across the frame stream. */
export function extractPresses(frames: ReplayFrame[]): PressEvent[] {
  const presses: PressEvent[] = []
  let prevLeft = false
  let prevRight = false
  for (const f of frames) {
    const left = (f.keys & LEFT_MASK) !== 0
    const right = (f.keys & RIGHT_MASK) !== 0
    if (left && !prevLeft) presses.push({ t: f.t, x: f.x, y: f.y, hand: 'left', key: 'K1' })
    if (right && !prevRight) presses.push({ t: f.t, x: f.x, y: f.y, hand: 'right', key: 'K2' })
    prevLeft = left
    prevRight = right
  }
  return presses
}

export interface KeyStats {
  k1Presses: number
  k2Presses: number
  totalPresses: number
  k1Ratio: number
  k2Ratio: number
  /** Fraction of consecutive presses that switched hands (1 = perfect alternation). */
  alternateRatio: number
  style: 'singletap' | 'alternating' | 'mixed' | 'unknown'
}

export function keyStats(presses: PressEvent[]): KeyStats {
  let k1 = 0
  let k2 = 0
  for (const p of presses) (p.hand === 'left' ? k1++ : k2++)
  const total = k1 + k2

  // Alternation: of all adjacent press pairs (in time order), how many alternate hands.
  let switches = 0
  for (let i = 1; i < presses.length; i++) {
    if (presses[i].hand !== presses[i - 1].hand) switches++
  }
  const alternateRatio = presses.length > 1 ? switches / (presses.length - 1) : 0

  let style: KeyStats['style'] = 'unknown'
  if (total >= 10) {
    if (alternateRatio >= 0.7) style = 'alternating'
    else if (alternateRatio <= 0.25) style = 'singletap'
    else style = 'mixed'
  }

  return {
    k1Presses: k1,
    k2Presses: k2,
    totalPresses: total,
    k1Ratio: total ? k1 / total : 0,
    k2Ratio: total ? k2 / total : 0,
    alternateRatio,
    style,
  }
}

// ---- Hit-object alignment / hit error ------------------------------------

export interface HitResult {
  object: HitObject
  pressTime: number
  /** pressTime - object.time. Negative = early, positive = late. */
  error: number
}

export interface MissResult {
  object: HitObject
  reason: 'no-press' | 'out-of-range'
}

export interface TimingAnalysis {
  hits: HitResult[]
  misses: MissResult[]
  unstableRate: number
  meanError: number
  stdError: number
  windows: HitWindows
  radius: number
}

/**
 * Greedy alignment: walk key-presses in time order and bind each to the nearest
 * still-unhit clickable object within the 50-window, preferring a press whose
 * cursor sits inside (a slightly padded) circle radius.
 */
export function analyzeTiming(
  beatmap: Beatmap,
  presses: PressEvent[],
  mods: ModInfo,
): TimingAnalysis {
  const od = adjustOD(beatmap.od, mods)
  const cs = adjustCS(beatmap.cs, mods)
  const windows = hitWindows(od)
  const radius = circleRadius(cs)

  // Clickable objects only (spinners have no single hit time / position check).
  const objects = beatmap.objects
    .filter((o) => o.kind !== 'spinner')
    .map((o) => (mods.hardRock ? { ...o, y: 384 - o.y } : o))

  const matched = new Array<boolean>(objects.length).fill(false)
  const hits: HitResult[] = []
  const meh = windows.meh
  const posTolerance = radius * 2.4 // generous: cursor need only be in the area

  let oi = 0 // objects pointer; objects & presses are both time-sorted
  for (const p of presses) {
    // Advance past objects that are now unreachable for this and later presses.
    while (oi < objects.length && objects[oi].time < p.t - meh) oi++

    let best = -1
    let bestErr = Infinity
    for (let j = oi; j < objects.length; j++) {
      const obj = objects[j]
      const dt = p.t - obj.time
      if (dt > meh) continue
      if (dt < -meh) break // future objects out of window; rest are later still
      if (matched[j]) continue
      const dist = Math.hypot(p.x - obj.x, p.y - obj.y)
      if (dist > posTolerance) continue
      if (Math.abs(dt) < Math.abs(bestErr)) {
        bestErr = dt
        best = j
      }
    }
    if (best !== -1) {
      matched[best] = true
      hits.push({ object: objects[best], pressTime: p.t, error: bestErr })
    }
  }

  const misses: MissResult[] = []
  for (let j = 0; j < objects.length; j++) {
    if (!matched[j]) misses.push({ object: objects[j], reason: 'no-press' })
  }

  hits.sort((a, b) => a.object.time - b.object.time)
  const errors = hits.map((h) => h.error)
  const mean = errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0
  const variance = errors.length
    ? errors.reduce((a, b) => a + (b - mean) ** 2, 0) / errors.length
    : 0
  const std = Math.sqrt(variance)

  return {
    hits,
    misses,
    unstableRate: std * 10,
    meanError: mean,
    stdError: std,
    windows,
    radius,
  }
}

// ---- Derived series for charts ------------------------------------------

export interface Histogram {
  binWidth: number
  bins: { center: number; count: number }[]
  max: number
}

/** Error-distribution histogram centred on 0 ms. */
export function errorHistogram(errors: number[], binWidth = 4): Histogram {
  if (!errors.length) return { binWidth, bins: [], max: 0 }
  const absMax = Math.max(20, ...errors.map((e) => Math.abs(e)))
  const edge = Math.ceil(absMax / binWidth) * binWidth
  const nBins = (edge / binWidth) * 2
  const counts = new Array<number>(nBins).fill(0)
  for (const e of errors) {
    let idx = Math.floor((e + edge) / binWidth)
    if (idx < 0) idx = 0
    if (idx >= nBins) idx = nBins - 1
    counts[idx]++
  }
  const bins = counts.map((count, i) => ({
    center: -edge + (i + 0.5) * binWidth,
    count,
  }))
  return { binWidth, bins, max: Math.max(...counts) }
}

/** Rolling UR over note index, returned as points keyed by song time. */
export function rollingUR(hits: HitResult[], window = 21): { t: number; ur: number }[] {
  const out: { t: number; ur: number }[] = []
  if (hits.length < 3) return out
  const half = Math.floor(window / 2)
  for (let i = 0; i < hits.length; i++) {
    const lo = Math.max(0, i - half)
    const hi = Math.min(hits.length - 1, i + half)
    let sum = 0
    let n = 0
    for (let j = lo; j <= hi; j++) {
      sum += hits[j].error
      n++
    }
    const m = sum / n
    let v = 0
    for (let j = lo; j <= hi; j++) v += (hits[j].error - m) ** 2
    out.push({ t: hits[i].object.time, ur: Math.sqrt(v / n) * 10 })
  }
  return out
}

// ---- Cursor heatmap grid -------------------------------------------------

export const PLAYFIELD_W = 512
export const PLAYFIELD_H = 384

export interface HeatGrid {
  cols: number
  rows: number
  /** Dwell-time weight per cell (ms). */
  data: Float32Array
  max: number
}

/**
 * Accumulate dwell time into a grid: each frame contributes its dt to the cell
 * under the cursor (capped to avoid pauses dominating the scale).
 */
export function buildHeatGrid(frames: ReplayFrame[], cols = 128, rows = 96): HeatGrid {
  const data = new Float32Array(cols * rows)
  let max = 0
  for (const f of frames) {
    if (f.x < 0 || f.x > PLAYFIELD_W || f.y < 0 || f.y > PLAYFIELD_H) continue
    const weight = Math.min(f.dt, 60) // ignore long pauses / skips
    if (weight <= 0) continue
    const cx = Math.min(cols - 1, Math.floor((f.x / PLAYFIELD_W) * cols))
    const cy = Math.min(rows - 1, Math.floor((f.y / PLAYFIELD_H) * rows))
    const idx = cy * cols + cx
    data[idx] += weight
    if (data[idx] > max) max = data[idx]
  }
  return { cols, rows, data, max }
}
