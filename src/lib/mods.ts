// osu! mods bitfield. Order matters only for stable display.
// Reference: osu! `Mods` enum.
const MOD_FLAGS: [number, string][] = [
  [1 << 0, 'NF'], // NoFail
  [1 << 1, 'EZ'], // Easy
  [1 << 2, 'TD'], // TouchDevice
  [1 << 3, 'HD'], // Hidden
  [1 << 4, 'HR'], // HardRock
  [1 << 5, 'SD'], // SuddenDeath
  [1 << 6, 'DT'], // DoubleTime
  [1 << 7, 'RX'], // Relax
  [1 << 8, 'HT'], // HalfTime
  [1 << 9, 'NC'], // Nightcore (DT bit is also set)
  [1 << 10, 'FL'], // Flashlight
  [1 << 11, 'AT'], // Autoplay
  [1 << 12, 'SO'], // SpunOut
  [1 << 13, 'AP'], // Autopilot
  [1 << 14, 'PF'], // Perfect (SD bit is also set)
  [1 << 15, '4K'],
  [1 << 16, '5K'],
  [1 << 17, '6K'],
  [1 << 18, '7K'],
  [1 << 19, '8K'],
  [1 << 20, 'FI'], // FadeIn
  [1 << 21, 'RD'], // Random
  [1 << 22, 'CN'], // Cinema
  [1 << 23, 'TP'], // TargetPractice
  [1 << 24, '9K'],
  [1 << 25, 'CO'], // KeyCoop
  [1 << 26, '1K'],
  [1 << 27, '3K'],
  [1 << 28, '2K'],
  [1 << 29, 'V2'], // ScoreV2
  [1 << 30, 'MR'], // Mirror
]

export interface ModInfo {
  acronyms: string[]
  /** Clock rate multiplier (DT/NC = 1.5, HT = 0.75, else 1). */
  rate: number
  hidden: boolean
  hardRock: boolean
  easy: boolean
}

export function decodeMods(bits: number): ModInfo {
  let acronyms: string[] = []
  for (const [flag, name] of MOD_FLAGS) {
    if (bits & flag) acronyms.push(name)
  }
  // Nightcore sets the DT bit too; Perfect sets the SD bit too. Hide redundancy.
  if (acronyms.includes('NC')) acronyms = acronyms.filter((m) => m !== 'DT')
  if (acronyms.includes('PF')) acronyms = acronyms.filter((m) => m !== 'SD')

  const dt = (bits & (1 << 6)) !== 0 || (bits & (1 << 9)) !== 0
  const ht = (bits & (1 << 8)) !== 0
  const rate = dt ? 1.5 : ht ? 0.75 : 1

  return {
    acronyms,
    rate,
    hidden: (bits & (1 << 3)) !== 0,
    hardRock: (bits & (1 << 4)) !== 0,
    easy: (bits & (1 << 1)) !== 0,
  }
}

export function modsToString(info: ModInfo): string {
  return info.acronyms.length ? '+' + info.acronyms.join('') : 'No Mod'
}
