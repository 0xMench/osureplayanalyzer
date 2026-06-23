import { useEffect, useMemo, useState } from 'react'
import { parseReplay, type ParsedReplay } from './lib/osr'
import { fetchBeatmap, type BeatmapResult } from './lib/beatmap'
import {
  analyzeTiming,
  buildHeatGrid,
  errorHistogram,
  extractPresses,
  keyStats,
  rollingUR,
} from './lib/analysis'
import { Dropzone } from './components/Dropzone'
import { HeaderSummary } from './components/HeaderSummary'
import { Heatmap } from './components/Heatmap'
import { URPanel } from './components/URPanel'
import { ErrorTimeline } from './components/ErrorTimeline'
import { MissTimeline } from './components/MissTimeline'
import { KeyBreakdown } from './components/KeyBreakdown'

type Phase = 'idle' | 'parsing' | 'ready' | 'error'

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [replay, setReplay] = useState<ParsedReplay | null>(null)
  const [beatmap, setBeatmap] = useState<BeatmapResult | null>(null)
  const [beatmapLoading, setBeatmapLoading] = useState(false)

  async function handleFile(file: File) {
    setPhase('parsing')
    setError(null)
    setReplay(null)
    setBeatmap(null)
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const parsed = await parseReplay(buf)
      setReplay(parsed)
      setPhase('ready')
    } catch (e) {
      setError((e as Error).message || 'Failed to parse replay.')
      setPhase('error')
    }
  }

  // Fetch the beatmap once a standard-mode replay is parsed.
  useEffect(() => {
    if (!replay || replay.header.mode !== 0) return
    let cancelled = false
    setBeatmapLoading(true)
    setBeatmap(null)
    fetchBeatmap(replay.header.beatmapMd5)
      .then((res) => {
        if (!cancelled) setBeatmap(res)
      })
      .catch((e) => {
        if (!cancelled) setBeatmap({ beatmap: null, error: (e as Error).message })
      })
      .finally(() => {
        if (!cancelled) setBeatmapLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [replay])

  const isStd = replay?.header.mode === 0

  // Frame-only derivations (no beatmap needed).
  const presses = useMemo(
    () => (replay && isStd ? extractPresses(replay.frames) : []),
    [replay, isStd],
  )
  const keys = useMemo(() => keyStats(presses), [presses])
  const heat = useMemo(
    () => (replay && isStd ? buildHeatGrid(replay.frames) : null),
    [replay, isStd],
  )

  // Beatmap-dependent timing analysis.
  const timing = useMemo(() => {
    if (!replay || !isStd || !beatmap?.beatmap) return null
    return analyzeTiming(beatmap.beatmap, presses, replay.header.mods)
  }, [replay, isStd, beatmap, presses])

  const histogram = useMemo(
    () => (timing ? errorHistogram(timing.hits.map((h) => h.error)) : null),
    [timing],
  )
  const rolling = useMemo(() => (timing ? rollingUR(timing.hits) : []), [timing])

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          osu! replay analyzer<span className="dot">.</span>
        </h1>
        <span className="tag">drop an .osr, get the timing story</span>
        <span className="privacy">🔒 100% in-browser · your replay never uploads</span>
      </header>

      {phase === 'idle' && <Dropzone onFile={handleFile} />}

      {phase === 'parsing' && (
        <div className="panel">
          <span className="loading">
            <span className="spinner" /> Parsing {fileName}…
          </span>
        </div>
      )}

      {phase === 'error' && (
        <>
          <div className="banner error">
            <b>Couldn't read that replay.</b> {error}
          </div>
          <Dropzone onFile={handleFile} />
        </>
      )}

      {phase === 'ready' && replay && (
        <Results
          replay={replay}
          beatmap={beatmap}
          beatmapLoading={beatmapLoading}
          isStd={!!isStd}
          heat={heat}
          presses={presses}
          keys={keys}
          timing={timing}
          histogram={histogram}
          rolling={rolling}
          onReset={() => {
            setPhase('idle')
            setReplay(null)
            setBeatmap(null)
            setFileName('')
          }}
        />
      )}

      <footer className="foot">
        Parses the little-endian .osr binary + LZMA replay stream locally. Beatmaps are
        fetched from public mirrors (catboy.best / osu.direct) only to align timing.
      </footer>
    </div>
  )
}

function Results({
  replay,
  beatmap,
  beatmapLoading,
  isStd,
  heat,
  presses,
  keys,
  timing,
  histogram,
  rolling,
  onReset,
}: {
  replay: ParsedReplay
  beatmap: BeatmapResult | null
  beatmapLoading: boolean
  isStd: boolean
  heat: ReturnType<typeof buildHeatGrid> | null
  presses: ReturnType<typeof extractPresses>
  keys: ReturnType<typeof keyStats>
  timing: ReturnType<typeof analyzeTiming> | null
  histogram: ReturnType<typeof errorHistogram> | null
  rolling: { t: number; ur: number }[]
  onReset: () => void
}) {
  const { header } = replay
  const missMarks = timing ? timing.misses.map((m) => ({ x: m.object.x, y: m.object.y })) : []

  return (
    <div className="grid">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -6 }}>
        <button className="reset" onClick={onReset}>
          ← Analyze another replay
        </button>
      </div>

      <HeaderSummary
        header={header}
        beatmap={beatmap?.beatmap ?? null}
        beatmapLoading={beatmapLoading}
      />

      {!isStd && (
        <div className="banner warn">
          <b>Unsupported mode: {header.modeName}.</b> This analyzer fully supports osu!
          standard for now. The header above is parsed, but cursor and timing
          visualizations need a standard-mode replay.
        </div>
      )}

      {isStd && beatmapLoading && (
        <div className="panel">
          <span className="loading">
            <span className="spinner" /> Resolving beatmap from mirror for timing
            analysis…
          </span>
        </div>
      )}

      {isStd && !beatmapLoading && beatmap && !beatmap.beatmap && beatmap.error && (
        <div className="banner info">{beatmap.error}</div>
      )}

      {isStd && heat && (
        <div className="grid cols-2">
          <div className="panel">
            <h2>Cursor heatmap</h2>
            <Heatmap grid={heat} frames={replay.frames} misses={missMarks} />
            <div className="hint">
              Brighter = more cursor dwell time. Red circles mark miss locations.
            </div>
          </div>

          {timing && histogram ? (
            <URPanel
              unstableRate={timing.unstableRate}
              meanError={timing.meanError}
              stdError={timing.stdError}
              hitCount={timing.hits.length}
              histogram={histogram}
            />
          ) : (
            <KeyBreakdown stats={keys} />
          )}
        </div>
      )}

      {isStd && timing && histogram && (
        <KeyBreakdown stats={keys} />
      )}

      {isStd && timing && (
        <ErrorTimeline
          hits={timing.hits}
          rolling={rolling}
          duration={replay.duration}
          windows={timing.windows}
        />
      )}

      {isStd && timing && (
        <MissTimeline
          misses={timing.misses}
          duration={replay.duration}
          headerMissCount={header.countMiss}
        />
      )}

      <RawDump replay={replay} presses={presses.length} />
    </div>
  )
}

function RawDump({ replay, presses }: { replay: ParsedReplay; presses: number }) {
  const { header, frames, duration, seed } = replay
  const dump = {
    header: {
      ...header,
      timestamp: header.timestamp.toISOString(),
      onlineScoreId: header.onlineScoreId.toString(),
      mods: header.mods.acronyms,
      lifeBar: `${header.lifeBar.length} points`,
    },
    frames: {
      count: frames.length,
      durationMs: duration,
      keyPresses: presses,
      seed,
      first10: frames.slice(0, 10),
    },
  }
  return (
    <details className="raw">
      <summary>Raw parsed data (JSON)</summary>
      <pre>{JSON.stringify(dump, null, 2)}</pre>
    </details>
  )
}
