import type { ReplayHeader } from '../lib/osr'
import type { Beatmap } from '../lib/beatmap'
import { modsToString } from '../lib/mods'

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

export function HeaderSummary({
  header,
  beatmap,
  beatmapLoading,
}: {
  header: ReplayHeader
  beatmap: Beatmap | null
  beatmapLoading: boolean
}) {
  const acc = computeAccuracy(header)
  const title = beatmap
    ? `${beatmap.artist} – ${beatmap.title}`
    : beatmapLoading
      ? 'Resolving beatmap…'
      : 'Unknown beatmap'

  return (
    <div className="panel summary">
      <div className="titleline">
        <span className="maptitle">{title}</span>
        {beatmap && <span className="diff">[{beatmap.version}]</span>}
      </div>
      <div className="titleline">
        <span className="player">
          Played by <b>{header.playerName || 'unknown'}</b>
        </span>
        {header.mods.acronyms.length > 0 && (
          <span className="mods">
            {header.mods.acronyms.map((m) => (
              <span className="mod" key={m}>
                {m}
              </span>
            ))}
          </span>
        )}
        {header.mods.acronyms.length === 0 && <span className="pill">{modsToString(header.mods)}</span>}
        <span className="pill">{header.modeName}</span>
      </div>

      <div className="statgrid">
        <Stat k="Score" v={fmt(header.score)} />
        <Stat k="Max Combo" v={`${fmt(header.maxCombo)}x`} />
        <Stat k="Accuracy" v={`${acc.toFixed(2)}%`} />
        <Stat k="300" v={fmt(header.count300)} cls="judge-300" />
        <Stat k="100" v={fmt(header.count100)} cls="judge-100" />
        <Stat k="50" v={fmt(header.count50)} cls="judge-50" />
        <Stat k="Miss" v={fmt(header.countMiss)} cls="judge-miss" />
        <Stat
          k="Date"
          v={header.timestamp.toLocaleDateString()}
          small
        />
      </div>
    </div>
  )
}

function Stat({
  k,
  v,
  cls,
  small,
}: {
  k: string
  v: string
  cls?: string
  small?: boolean
}) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className={'v' + (small ? ' small' : '') + (cls ? ' ' + cls : '')}>{v}</div>
    </div>
  )
}

// Standard osu! accuracy.
function computeAccuracy(h: ReplayHeader): number {
  const total = h.count300 + h.count100 + h.count50 + h.countMiss
  if (!total) return 100
  return (
    ((300 * h.count300 + 100 * h.count100 + 50 * h.count50) / (300 * total)) * 100
  )
}
