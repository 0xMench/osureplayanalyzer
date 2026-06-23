# osu! Replay Analyzer

A self-contained, browser-only analyzer for osu! replay files (`.osr`). Drag in a
replay and get a visual breakdown of the play — cursor heatmap, unstable rate,
hit-error timeline, miss timeline, and key-press stats. **No backend:** the `.osr`
is parsed entirely in your browser and never leaves your machine.

![dark, in-browser tool](https://img.shields.io/badge/runs-100%25%20in%20browser-ff66aa)

## Features

- **`.osr` parsing** — reads the little-endian binary header (mode, version,
  beatmap/player/replay hashes, hit counts, score, combo, mods, timestamp, online
  score id) and LZMA-decompresses the replay frame stream.
- **Header summary** — player, mods, score, combo, accuracy, and 300/100/50/miss
  counts, with the beatmap title once resolved.
- **Cursor heatmap** — playfield heatmap weighted by cursor dwell time, with the
  cursor path overlaid and miss locations circled in red.
- **Unstable Rate** — `stddev(hit errors) × 10`, shown as a number plus an
  early/late error-distribution histogram centred on 0 ms.
- **Hit error & UR over time** — per-note scatter with a rolling unstable-rate
  line so you can see where timing got shaky vs. locked in.
- **Miss timeline** — where misses occurred along the song, cross-referenced with
  their playfield locations on the heatmap.
- **Key-press breakdown** — K1 vs K2 usage ratio, total presses, and a
  singletap-vs-alternate style estimate.
- **Graceful degradation** — corrupt files, non-standard modes, and unfetchable
  beatmaps all surface clear messages; anything that doesn't need the beatmap
  (cursor path, key stats) still renders.

Only **osu! standard** is fully supported in v1; taiko/catch/mania replays show a
clear "unsupported mode" notice with the parsed header.

## How it works

| Step | Detail |
| ---- | ------ |
| Binary parse | `src/lib/binary.ts` — LE reader with osu!-style `0x0b` + ULEB128 strings. |
| Replay decode | `src/lib/osr.ts` — header fields in order, then LZMA decompress + `w\|x\|y\|z` frame decode. |
| Decompression | `src/vendor/lzma-d.min.js` — worker-free [LZMA-JS](https://github.com/LZMA-JS/LZMA-JS) decompress build (MIT), vendored with an ESM export so the static build needs no CDN or web worker. |
| Beatmap align | `src/lib/beatmap.ts` — fetches the `.osu` by MD5 from a CORS-enabled mirror (catboy.best, falling back to osu.direct), parses hit objects + difficulty. |
| Analysis | `src/lib/analysis.ts` — key-press edges, greedy press↔object alignment, hit windows/radius from OD/CS (mod-adjusted), UR, histograms, rolling UR, heatmap grid. |

### A note on timing units

Hit errors are measured in the replay/beatmap millisecond timeline (`press time −
object time`), and UR = `σ × 10`, matching the conventional definition. Hit
windows and circle radius are adjusted for HR/EZ; alignment is greedy within the
50-window and a generous position tolerance.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build (static)

```bash
npm run build    # -> dist/  (deploy to any static host)
npm run preview
```

`vite.config.ts` uses `base: './'` so the build works from any subdirectory.
