import { useEffect, useRef } from 'react'
import type { Histogram } from '../lib/analysis'

export function URPanel({
  unstableRate,
  meanError,
  stdError,
  hitCount,
  histogram,
}: {
  unstableRate: number
  meanError: number
  stdError: number
  hitCount: number
  histogram: Histogram
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = 2
    const W = 520
    const H = 200
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, W, H)

    const padB = 26
    const padT = 10
    const midX = W / 2
    const plotH = H - padB - padT

    // Zero line / centre axis.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(midX, padT)
    ctx.lineTo(midX, H - padB)
    ctx.stroke()

    if (histogram.bins.length && histogram.max > 0) {
      const half = histogram.bins.length / 2
      const binW = (W - 20) / histogram.bins.length
      histogram.bins.forEach((bin, i) => {
        const h = (bin.count / histogram.max) * plotH
        const x = 10 + i * binW
        const y = H - padB - h
        ctx.fillStyle = bin.center < 0 ? '#5cc8ff' : '#ff9f5c'
        ctx.fillRect(x, y, Math.max(1, binW - 1), h)
      })
      void half

      // Axis labels (ms).
      ctx.fillStyle = 'rgba(236,233,245,0.6)'
      ctx.font = '11px ui-sans-serif, system-ui'
      ctx.textAlign = 'center'
      const edge = -histogram.bins[0].center - histogram.binWidth / 2
      ctx.fillText('0', midX, H - 9)
      ctx.fillText(`-${Math.round(edge)}ms`, 28, H - 9)
      ctx.fillText(`+${Math.round(edge)}ms`, W - 30, H - 9)
    } else {
      ctx.fillStyle = 'rgba(236,233,245,0.4)'
      ctx.font = '13px ui-sans-serif, system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('No hit-error data', W / 2, H / 2)
    }
  }, [histogram])

  return (
    <div className="panel">
      <h2>Unstable Rate</h2>
      <div className="metric">
        <span className="num">{unstableRate.toFixed(1)}</span>
        <span className="unit">UR</span>
      </div>
      <div className="subnums">
        <span>
          mean error <b>{meanError >= 0 ? '+' : ''}{meanError.toFixed(1)}ms</b>
        </span>
        <span>
          σ <b>{stdError.toFixed(1)}ms</b>
        </span>
        <span>
          notes <b>{hitCount}</b>
        </span>
      </div>
      <div className="canvas-wrap section">
        <canvas ref={ref} className="viz" />
      </div>
      <div className="legend">
        <span>
          <i style={{ background: '#5cc8ff' }} />
          early (hit before the note)
        </span>
        <span>
          <i style={{ background: '#ff9f5c' }} />
          late (hit after the note)
        </span>
      </div>
    </div>
  )
}
