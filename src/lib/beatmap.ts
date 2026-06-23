// Beatmap resolution + .osu parsing.
//
// The replay only carries the beatmap MD5, so we fetch the .osu file from a
// public, CORS-enabled mirror. Everything here runs in the browser; the .osr
// itself never leaves the user's machine.

export type ObjectKind = 'circle' | 'slider' | 'spinner'

export interface HitObject {
  x: number
  y: number
  /** Hit time (ms) — the moment the player must click for circles/slider heads. */
  time: number
  kind: ObjectKind
  newCombo: boolean
}

export interface Beatmap {
  title: string
  titleUnicode: string
  artist: string
  version: string // difficulty name
  creator: string
  hp: number
  cs: number
  od: number
  ar: number
  sliderMultiplier: number
  objects: HitObject[]
  /** Source mirror that served the file. */
  source: string
}

const TYPE_CIRCLE = 1
const TYPE_SLIDER = 2
const TYPE_NEW_COMBO = 4
const TYPE_SPINNER = 8

function parseOsu(text: string, source: string): Beatmap {
  const bm: Beatmap = {
    title: '',
    titleUnicode: '',
    artist: '',
    version: '',
    creator: '',
    hp: 5,
    cs: 5,
    od: 5,
    ar: 5,
    sliderMultiplier: 1.4,
    objects: [],
    source,
  }

  let section = ''
  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1)
      continue
    }

    if (section === 'Metadata' || section === 'General' || section === 'Difficulty') {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim()
      switch (key) {
        case 'Title':
          bm.title = val
          break
        case 'TitleUnicode':
          bm.titleUnicode = val
          break
        case 'Artist':
          bm.artist = val
          break
        case 'Version':
          bm.version = val
          break
        case 'Creator':
          bm.creator = val
          break
        case 'HPDrainRate':
          bm.hp = parseFloat(val)
          break
        case 'CircleSize':
          bm.cs = parseFloat(val)
          break
        case 'OverallDifficulty':
          bm.od = parseFloat(val)
          break
        case 'ApproachRate':
          bm.ar = parseFloat(val)
          break
        case 'SliderMultiplier':
          bm.sliderMultiplier = parseFloat(val)
          break
      }
    } else if (section === 'HitObjects') {
      const f = line.split(',')
      if (f.length < 4) continue
      const x = parseFloat(f[0])
      const y = parseFloat(f[1])
      const time = parseInt(f[2], 10)
      const type = parseInt(f[3], 10)
      if (Number.isNaN(time)) continue
      let kind: ObjectKind = 'circle'
      if (type & TYPE_SLIDER) kind = 'slider'
      else if (type & TYPE_SPINNER) kind = 'spinner'
      else if (type & TYPE_CIRCLE) kind = 'circle'
      bm.objects.push({ x, y, time, kind, newCombo: (type & TYPE_NEW_COMBO) !== 0 })
    }
  }

  // Some old maps omit ApproachRate; it defaults to OD in that case.
  if (!Number.isFinite(bm.ar)) bm.ar = bm.od
  bm.objects.sort((a, b) => a.time - b.time)
  return bm
}

interface Mirror {
  name: string
  /** Resolve md5 -> raw .osu text, or null if not found. */
  fetchOsu(md5: string): Promise<string | null>
}

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { Accept: 'text/plain' } })
  if (!res.ok) return null
  const text = await res.text()
  // A valid .osu begins with "osu file format v..".
  if (!/osu file format/i.test(text.slice(0, 64))) return null
  return text
}

async function fetchJson(url: string): Promise<any | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

// catboy.best (Mino) and osu.direct both expose CORS-friendly md5 lookups and
// raw .osu downloads. We try each in turn so a single mirror outage is survivable.
const MIRRORS: Mirror[] = [
  {
    name: 'catboy.best',
    async fetchOsu(md5) {
      const meta = await fetchJson(`https://catboy.best/api/v2/md5/${md5}`)
      const id = meta?.id ?? meta?.beatmap_id ?? meta?.BeatmapID
      if (!id) return null
      return fetchText(`https://catboy.best/osu/${id}`)
    },
  },
  {
    name: 'osu.direct',
    async fetchOsu(md5) {
      // osu.direct serves the raw file straight from the md5.
      const direct = await fetchText(`https://osu.direct/api/osu/${md5}`)
      if (direct) return direct
      const meta = await fetchJson(`https://osu.direct/api/v2/md5/${md5}`)
      const id = meta?.BeatmapID ?? meta?.beatmap_id ?? meta?.id
      if (!id) return null
      return fetchText(`https://osu.direct/api/osu/${id}`)
    },
  },
]

export interface BeatmapResult {
  beatmap: Beatmap | null
  /** Human-readable note when resolution fails (shown in the UI). */
  error: string | null
}

export async function fetchBeatmap(md5: string): Promise<BeatmapResult> {
  if (!md5) return { beatmap: null, error: 'Replay has no beatmap hash.' }
  const failures: string[] = []
  for (const mirror of MIRRORS) {
    try {
      const text = await mirror.fetchOsu(md5)
      if (text) return { beatmap: parseOsu(text, mirror.name), error: null }
      failures.push(`${mirror.name}: not found`)
    } catch (e) {
      failures.push(`${mirror.name}: ${(e as Error).message}`)
    }
  }
  return {
    beatmap: null,
    error:
      `Couldn't fetch this beatmap from any mirror (${failures.join('; ')}). ` +
      `Cursor and key stats are still available below.`,
  }
}
