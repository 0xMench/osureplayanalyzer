import { useEffect, useRef } from 'react'
import { PLAYFIELD_H, PLAYFIELD_W, type HeatGrid } from '../lib/analysis'
import type { ReplayFrame } from '../lib/osr'

interface MissMark {
  x: number
  y: number
}

// Five-stop ramp: faint -> blue -> purple -> pink -> hot yellow.
const RAMP: [number, [number, number, number]][] = [
  [0.0, [20, 18, 40]],
  [0.25, [60, 70, 170]],
  [0.5, [150, 70, 200]],
  [0.75, [255, 90, 160]],
  [1.0, [255, 225, 120]],
]

function ramp(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t))
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1]
      const [t1, c1] = RAMP[i]
      const f = (t - t0) / (t1 - t0)
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ]
    }
  }
  return RAMP[RAMP.length - 1][1]
}

export function Heatmap({
  grid,
  frames,
  misses,
}: {
  grid: HeatGrid
  frames: ReplayFrame[]
  misses: MissMark[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = 2
    const W = PLAYFIELD_W * scale
    const H = PLAYFIELD_H * scale
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0a0910'
    ctx.fillRect(0, 0, W, H)

    // Heat cells via an offscreen ImageData at grid resolution, scaled up smoothly.
    const { cols, rows, data, max } = grid
    if (max > 0) {
      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const octx = off.getContext('2d')!
      const img = octx.createImageData(cols, rows)
      // Compress dynamic range so faint trails stay visible.
      const norm = (v: number) => Math.pow(v / max, 0.55)
      for (let i = 0; i < data.length; i++) {
        const v = data[i]
        const t = v > 0 ? norm(v) : 0
        const [r, g, b] = ramp(t)
        const o = i * 4
        img.data[o] = r
        img.data[o + 1] = g
        img.data[o + 2] = b
        img.data[o + 3] = v > 0 ? Math.round(40 + 215 * t) : 0
      }
      octx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.globalAlpha = 0.92
      ctx.drawImage(off, 0, 0, W, H)
      ctx.globalAlpha = 1
    }

    // Faint cursor path over the top for structure.
    if (frames.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      let started = false
      for (const f of frames) {
        if (f.x < 0 || f.x > PLAYFIELD_W || f.y < 0 || f.y > PLAYFIELD_H) {
          started = false
          continue
        }
        const px = f.x * scale
        const py = f.y * scale
        if (!started) {
          ctx.moveTo(px, py)
          started = true
        } else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    // Misses in a distinct red.
    for (const m of misses) {
      const px = m.x * scale
      const py = m.y * scale
      ctx.beginPath()
      ctx.arc(px, py, 9, 0, Math.PI * 2)
      ctx.strokeStyle = '#ff5c7a'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ff5c7a'
      ctx.fill()
    }

    // Playfield border.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, W - 2, H - 2)
  }, [grid, frames, misses])

  return (
    <div className="canvas-wrap">
      <canvas ref={ref} className="viz" />
    </div>
  )
}
