import { useEffect, useRef } from 'react'
import type { MissResult } from '../lib/analysis'

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function MissTimeline({
  misses,
  duration,
  headerMissCount,
}: {
  misses: MissResult[]
  duration: number
  headerMissCount: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = 2
    const W = 1040
    const H = 90
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, W, H)

    const padL = 14
    const padR = 14
    const plotW = W - padL - padR
    const dur = duration || 1
    const trackY = 38
    const xOf = (t: number) => padL + (t / dur) * plotW

    // Track line.
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padL, trackY)
    ctx.lineTo(padL + plotW, trackY)
    ctx.stroke()

    // Miss markers.
    for (const m of misses) {
      const x = xOf(m.object.time)
      ctx.strokeStyle = '#ff5c7a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, trackY - 14)
      ctx.lineTo(x, trackY + 14)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, trackY - 14, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#ff5c7a'
      ctx.fill()
    }

    // Time labels.
    ctx.fillStyle = 'rgba(236,233,245,0.55)'
    ctx.font = '11px ui-sans-serif, system-ui'
    ctx.textAlign = 'center'
    for (let i = 0; i <= 4; i++) {
      const t = (dur / 4) * i
      ctx.fillText(fmtTime(t), xOf(t), H - 8)
    }
  }, [misses, duration])

  return (
    <div className="panel">
      <h2>Miss timeline</h2>
      <div className="canvas-wrap">
        <canvas ref={ref} className="viz" />
      </div>
      <div className="hint">
        {misses.length} miss{misses.length === 1 ? '' : 'es'} detected from alignment
        {headerMissCount !== misses.length && (
          <> · replay header reports {headerMissCount}</>
        )}
        . Their playfield locations are circled on the heatmap above.
      </div>
    </div>
  )
}
