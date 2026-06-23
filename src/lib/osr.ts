import { BinaryReader } from './binary'
import { decodeMods, type ModInfo } from './mods'
import { LZMA } from '../vendor/lzma-d.min.js'

export const GAME_MODES = ['osu! (std)', 'osu!taiko', 'osu!catch', 'osu!mania'] as const

// Key bitmask in each replay frame.
export const KEY = {
  M1: 1,
  M2: 2,
  K1: 4,
  K2: 8,
  SMOKE: 16,
} as const

export interface ReplayFrame {
  /** Absolute time in the song's millisecond timeline. */
  t: number
  /** Delta from the previous frame (raw `w`). */
  dt: number
  x: number
  y: number
  keys: number
}

export interface ReplayHeader {
  mode: number
  modeName: string
  version: number
  beatmapMd5: string
  playerName: string
  replayMd5: string
  count300: number
  count100: number
  count50: number
  countGeki: number
  countKatu: number
  countMiss: number
  score: number
  maxCombo: number
  perfect: boolean
  modsRaw: number
  mods: ModInfo
  lifeBar: { t: number; hp: number }[]
  timestamp: Date
  onlineScoreId: bigint
}

export interface ParsedReplay {
  header: ReplayHeader
  frames: ReplayFrame[]
  seed: number | null
  /** Total song time covered by the replay frames (ms). */
  duration: number
}

// Windows ticks (100ns since 0001-01-01) -> JS Date.
const TICKS_PER_MS = 10000n
const EPOCH_OFFSET_MS = 62135596800000 // ms between 0001-01-01 and 1970-01-01
function ticksToDate(ticks: bigint): Date {
  return new Date(Number(ticks / TICKS_PER_MS) - EPOCH_OFFSET_MS)
}

function parseLifeBar(raw: string): { t: number; hp: number }[] {
  // Format: "time|hp,time|hp,..." with hp in [0,1].
  const out: { t: number; hp: number }[] = []
  for (const seg of raw.split(',')) {
    if (!seg) continue
    const [t, hp] = seg.split('|')
    const tn = parseInt(t, 10)
    const hn = parseFloat(hp)
    if (!Number.isNaN(tn) && !Number.isNaN(hn)) out.push({ t: tn, hp: hn })
  }
  return out
}

function decompress(data: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      LZMA.decompress(data, (result, error) => {
        if (error) return reject(error)
        if (result == null) return reject(new Error('LZMA produced no output.'))
        if (typeof result === 'string') return resolve(result)
        // Byte array fallback (signed values): coerce to UTF-8.
        const bytes = Uint8Array.from(result, (b) => b & 0xff)
        resolve(new TextDecoder('utf-8').decode(bytes))
      })
    } catch (e) {
      reject(e)
    }
  })
}

function parseFrames(text: string): { frames: ReplayFrame[]; seed: number | null } {
  const frames: ReplayFrame[] = []
  let seed: number | null = null
  let t = 0
  for (const part of text.split(',')) {
    if (!part) continue
    const fields = part.split('|')
    if (fields.length < 4) continue
    const dt = parseInt(fields[0], 10)
    if (Number.isNaN(dt)) continue
    // The trailing "-12345|0|0|<seed>" frame carries the RNG seed, not motion.
    if (dt === -12345) {
      const s = parseInt(fields[3], 10)
      seed = Number.isNaN(s) ? null : s
      continue
    }
    t += dt
    frames.push({
      t,
      dt,
      x: parseFloat(fields[1]),
      y: parseFloat(fields[2]),
      keys: parseInt(fields[3], 10) || 0,
    })
  }
  return { frames, seed }
}

/** Parse only the header; cheap and never throws on mode mismatch. */
export function parseHeader(buf: ArrayBuffer): ReplayHeader {
  const r = new BinaryReader(buf)
  const mode = r.readByte()
  const version = r.readInt32()
  const beatmapMd5 = r.readString()
  const playerName = r.readString()
  const replayMd5 = r.readString()
  const count300 = r.readUInt16()
  const count100 = r.readUInt16()
  const count50 = r.readUInt16()
  const countGeki = r.readUInt16()
  const countKatu = r.readUInt16()
  const countMiss = r.readUInt16()
  const score = r.readInt32()
  const maxCombo = r.readUInt16()
  const perfect = r.readByte() !== 0
  const modsRaw = r.readUInt32()
  const lifeBarRaw = r.readString()
  const timestamp = ticksToDate(r.readInt64())

  // Stash the post-lifebar offset so parseReplay can resume without re-reading.
  const header: ReplayHeader & { _dataOffset?: number } = {
    mode,
    modeName: GAME_MODES[mode] ?? `unknown (${mode})`,
    version,
    beatmapMd5,
    playerName,
    replayMd5,
    count300,
    count100,
    count50,
    countGeki,
    countKatu,
    countMiss,
    score,
    maxCombo,
    perfect,
    modsRaw,
    mods: decodeMods(modsRaw),
    lifeBar: parseLifeBar(lifeBarRaw),
    timestamp,
    onlineScoreId: 0n,
  }
  ;(header as { _dataOffset?: number })._dataOffset = r.offset
  return header
}

/** Full parse: header + LZMA-decompressed, frame-decoded replay data. */
export async function parseReplay(buf: ArrayBuffer): Promise<ParsedReplay> {
  const r = new BinaryReader(buf)
  // Re-read the header through the reader so the offset lands on the data block.
  r.readByte() // mode
  r.readInt32() // version
  r.readString() // beatmap md5
  r.readString() // player
  r.readString() // replay md5
  for (let i = 0; i < 6; i++) r.readUInt16() // hit counts
  r.readInt32() // score
  r.readUInt16() // max combo
  r.readByte() // perfect
  r.readUInt32() // mods
  r.readString() // life bar
  r.readInt64() // timestamp

  const header = parseHeader(buf)

  const compressedLen = r.readInt32()
  const compressed = r.readBytes(compressedLen)
  // onlineScoreId follows the compressed block (present since 2014; guard anyway).
  if (r.remaining >= 8) header.onlineScoreId = r.readInt64()

  const text = await decompress(compressed)
  const { frames, seed } = parseFrames(text)
  const duration = frames.length ? frames[frames.length - 1].t : 0

  return { header, frames, seed, duration }
}
