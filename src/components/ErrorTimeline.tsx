import { useEffect, useRef } from 'react'
import type { HitResult, HitWindows } from '../lib/analysis'

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function ErrorTimeline({
  hits,
  rolling,
  duration,
  windows,
}: {
  hits: HitResult[]
  rolling: { t: number; ur: number }[]
  duration: number
  windows: HitWindows
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = 2
    const W = 1040
    const H = 260
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, W, H)

    const padL = 44
    const padR = 48
    const padT = 12
    const padB = 24
    const plotW = W - padL - padR
    const plotH = H - padT - padB
    const dur = duration || 1
    const yMax = Math.max(windows.meh, 30)

    const xOf = (t: number) => padL + (t / dur) * plotW
    const yOf = (err: number) => padT + plotH / 2 - (err / yMax) * (plotH / 2)

    // Hit-window bands (50 / 100 / 300) as subtle horizontal zones.
    const bands: [number, string][] = [
      [windows.meh, 'rgba(92,200,255,0.06)'],
      [windows.good, 'rgba(255,204,85,0.06)'],
      [windows.great, 'rgba(87,217,163,0.08)'],
    ]
    for (const [w, color] of bands) {
      ctx.fillStyle = color
      ctx.fillRect(padL, yOf(w), plotW, yOf(-w) - yOf(w))
    }

    // Zero line.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, yOf(0))
    ctx.lineTo(padL + plotW, yOf(0))
    ctx.stroke()

    // y labels.
    ctx.fillStyle = 'rgba(236,233,245,0.55)'
    ctx.font = '11px ui-sans-serif, system-ui'
    ctx.textAlign = 'right'
    ctx.fillText('0', padL - 6, yOf(0) + 4)
    ctx.fillText(`-${Math.round(yMax)}`, padL - 6, yOf(yMax) + 8)
    ctx.fillText(`+${Math.round(yMax)}`, padL - 6, yOf(-yMax) + 0)

    // Hit-error scatter.
    for (const h of hits) {
      ctx.beginPath()
      ctx.arc(xOf(h.object.time), yOf(h.error), 1.8, 0, Math.PI * 2)
      ctx.fillStyle = h.error < 0 ? 'rgba(92,200,255,0.7)' : 'rgba(255,159,92,0.7)'
      ctx.fill()
    }

    // Rolling UR line on the right axis.
    if (rolling.length > 1) {
      const urMax = Math.max(50, ...rolling.map((p) => p.ur)) * 1.1
      const yUR = (ur: number) => padT + plotH - (ur / urMax) * plotH
      ctx.strokeStyle = '#ff66aa'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      rolling.forEach((p, i) => {
        const x = xOf(p.t)
        const y = yUR(p.ur)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      ctx.fillStyle = '#ff66aa'
      ctx.textAlign = 'left'
      ctx.fillText(`${Math.round(urMax)} UR`, padL + plotW + 6, padT + 8)
      ctx.fillText('0', padL + plotW + 6, padT + plotH)
    }

    // x time labels.
    ctx.fillStyle = 'rgba(236,233,245,0.55)'
    ctx.textAlign = 'center'
    for (let i = 0; i <= 4; i++) {
      const t = (dur / 4) * i
      ctx.fillText(fmtTime(t), xOf(t), H - 8)
    }
  }, [hits, rolling, duration, windows])

  return (
    <div className="panel">
      <h2>Hit error &amp; UR over time</h2>
      <div className="canvas-wrap">
        <canvas ref={ref} className="viz" />
      </div>
      <div className="legend">
        <span>
          <i style={{ background: '#5cc8ff' }} />
          early
        </span>
        <span>
          <i style={{ background: '#ff9f5c' }} />
          late
        </span>
        <span>
          <i style={{ background: '#ff66aa' }} />
          rolling unstable rate
        </span>
      </div>
      <div className="hint">
        Tinted bands show the 300 / 100 / 50 hit windows. Watch the pink line spike where
        timing got shaky.
      </div>
    </div>
  )
}
