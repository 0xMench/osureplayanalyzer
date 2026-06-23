import type { KeyStats } from '../lib/analysis'

const STYLE_LABEL: Record<KeyStats['style'], string> = {
  singletap: 'Singletapping',
  alternating: 'Alternating',
  mixed: 'Mixed',
  unknown: 'Not enough presses',
}

export function KeyBreakdown({ stats }: { stats: KeyStats }) {
  const k1pct = Math.round(stats.k1Ratio * 100)
  const k2pct = 100 - k1pct
  return (
    <div className="panel">
      <h2>Key-press breakdown</h2>
      <div className="keybar">
        <span className="k1" style={{ width: `${k1pct}%` }}>
          {k1pct >= 12 ? `K1 ${k1pct}%` : ''}
        </span>
        <span className="k2" style={{ width: `${k2pct}%` }}>
          {k2pct >= 12 ? `K2 ${k2pct}%` : ''}
        </span>
      </div>
      <div className="subnums" style={{ marginTop: 12 }}>
        <span>
          K1 / M1 <b>{stats.k1Presses.toLocaleString()}</b>
        </span>
        <span>
          K2 / M2 <b>{stats.k2Presses.toLocaleString()}</b>
        </span>
        <span>
          total <b>{stats.totalPresses.toLocaleString()}</b>
        </span>
      </div>
      <div className="subnums" style={{ marginTop: 8 }}>
        <span>
          style{' '}
          <span className="pill" style={{ marginLeft: 4 }}>
            {STYLE_LABEL[stats.style]}
          </span>
        </span>
        <span>
          alternation <b>{Math.round(stats.alternateRatio * 100)}%</b>
        </span>
      </div>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--accent)' }} />
          K1 / M1 (left)
        </span>
        <span>
          <i style={{ background: 'var(--accent-2)' }} />
          K2 / M2 (right)
        </span>
      </div>
    </div>
  )
}
