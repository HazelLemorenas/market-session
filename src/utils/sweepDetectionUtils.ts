import type { SessionStat } from './sessionStatsUtils'
import type { KillZone }    from './killZoneUtils'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type SweepType     = 'bsl' | 'ssl'
export type SweepStrength = 'strong' | 'moderate' | 'weak'
export type LevelType     =
  | 'asian-high'  | 'asian-low'
  | 'london-high' | 'london-low'
  | 'ny-high'     | 'ny-low'

export interface Candle {
  time:  number  // UTC seconds
  open:  number
  high:  number
  low:   number
  close: number
}

export interface ReferenceLevel {
  price:     number
  type:      LevelType
  sessionId: string
}

export interface Sweep {
  id:          string
  timestamp:   number        // candle open time (UTC seconds)
  type:        SweepType
  level:       number        // price level that was swept
  levelType:   LevelType
  sweepExtent: number        // how far wick went beyond the level ($)
  closeReturn: number        // how far close returned inside the level ($)
  strength:    SweepStrength
  inKillZone:  boolean
  killZoneId:  string | null
  sessionId:   string
}

export interface SweepDetectionOptions {
  minSweepPct:         number   // min wick extension as fraction of level price
  minCandleRangePct:   number   // min candle range as fraction of price
  duplicateCooldown:   number   // candles before same level fires again
  weakStrengthEnabled: boolean  // include weak strength sweeps
}

export const DEFAULT_OPTIONS: SweepDetectionOptions = {
  minSweepPct:         0.0015,  // 0.15% — about $3 on a $2000 ETH
  minCandleRangePct:   0.0010,  // 0.10% — filters microscopic candles
  duplicateCooldown:   5,       // 5 candles cooldown between same-level detections
  weakStrengthEnabled: false,   // only report strong + moderate by default
}

// ─────────────────────────────────────────────
// STRENGTH CLASSIFICATION
// Measures how decisively price rejected the level
// after the sweep. Higher ratio = stronger rejection.
// ─────────────────────────────────────────────

export function classifySweepStrength(
  candle: Candle,
  level:  number,
  type:   SweepType
): SweepStrength {
  const range = candle.high - candle.low
  if (range === 0) return 'weak'

  // How far the close returned inside the level relative to total range
  const rejection =
    type === 'bsl'
      ? level - candle.close   // BSL: close should be below the level
      : candle.close - level   // SSL: close should be above the level

  const ratio = rejection / range

  if (ratio > 0.60) return 'strong'    // large wick, closed well inside
  if (ratio > 0.35) return 'moderate'  // decent wick, meaningful close
  return 'weak'                        // barely confirmed
}

// ─────────────────────────────────────────────
// BSL DETECTION
// Buy-side liquidity sweep:
// Wick went above the level, close came back below.
// ─────────────────────────────────────────────

export function detectBSL(
  candle:  Candle,
  level:   number,
  options: SweepDetectionOptions
): { sweepExtent: number; closeReturn: number; strength: SweepStrength } | null {
  const minSweepDist = level  * options.minSweepPct
  const minRange     = candle.close * options.minCandleRangePct

  // Candle range too small — likely spread noise
  if ((candle.high - candle.low) < minRange) return null

  // Wick must extend meaningfully above the level
  if (candle.high <= level + minSweepDist) return null

  // Close must be below the level — this confirms the rejection
  if (candle.close >= level) return null

  return {
    sweepExtent: parseFloat((candle.high - level).toFixed(2)),
    closeReturn: parseFloat((level - candle.close).toFixed(2)),
    strength:    classifySweepStrength(candle, level, 'bsl'),
  }
}

// ─────────────────────────────────────────────
// SSL DETECTION
// Sell-side liquidity sweep:
// Wick went below the level, close came back above.
// ─────────────────────────────────────────────

export function detectSSL(
  candle:  Candle,
  level:   number,
  options: SweepDetectionOptions
): { sweepExtent: number; closeReturn: number; strength: SweepStrength } | null {
  const minSweepDist = level  * options.minSweepPct
  const minRange     = candle.close * options.minCandleRangePct

  if ((candle.high - candle.low) < minRange) return null

  // Wick must extend meaningfully below the level
  if (candle.low >= level - minSweepDist) return null

  // Close must be above the level — confirms the rejection
  if (candle.close <= level) return null

  return {
    sweepExtent: parseFloat((level - candle.low).toFixed(2)),
    closeReturn: parseFloat((candle.close - level).toFixed(2)),
    strength:    classifySweepStrength(candle, level, 'ssl'),
  }
}

// ─────────────────────────────────────────────
// KILL ZONE CHECK
// Determines which kill zone (if any) was active
// at the time of a candle's timestamp.
// ─────────────────────────────────────────────

export function getKillZoneAtTime(
  utcTimestamp: number,
  killZones:    KillZone[]
): KillZone | null {
  const date    = new Date(utcTimestamp * 1000)
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60
  return killZones.find(
    (kz) => utcHour >= kz.startUTC && utcHour < kz.endUTC
  ) ?? null
}

// ─────────────────────────────────────────────
// REFERENCE LEVELS
// Extracts valid high/low price levels from
// session statistics. Skips upcoming sessions
// since they have no data yet.
// ─────────────────────────────────────────────

export function getReferenceLevels(sessionStats: SessionStat[]): ReferenceLevel[] {
  const levels: ReferenceLevel[] = []

  for (const stat of sessionStats) {
    if (stat.status === 'upcoming') continue
    if (stat.high === null || stat.low === null) continue

    levels.push({
      price:     stat.high,
      type:      `${stat.id}-high` as LevelType,
      sessionId: stat.id,
    })

    levels.push({
      price:     stat.low,
      type:      `${stat.id}-low` as LevelType,
      sessionId: stat.id,
    })
  }

  return levels
}

// ─────────────────────────────────────────────
// DUPLICATE FILTER
// Returns true if the new sweep should be blocked
// because the same level was swept too recently.
// ─────────────────────────────────────────────

export function isDuplicateSweep(
  existingSweeps:     Sweep[],
  candidate:          Sweep,
  cooldownCandles:    number,
  candleIntervalSecs: number = 300  // 5m default
): boolean {
  const cooldownSecs = cooldownCandles * candleIntervalSecs

  return existingSweeps.some(
    (s) =>
      s.levelType === candidate.levelType &&
      s.type      === candidate.type      &&
      (candidate.timestamp - s.timestamp) < cooldownSecs
  )
}

// ─────────────────────────────────────────────
// HISTORICAL SCAN
// Runs full detection across an array of candles.
// Used on initial data load to mark past sweeps.
// ─────────────────────────────────────────────

export function runSweepDetection(
  candles:   Candle[],
  levels:    ReferenceLevel[],
  killZones: KillZone[],
  options:   SweepDetectionOptions = DEFAULT_OPTIONS
): Sweep[] {
  const detected: Sweep[] = []

  for (const candle of candles) {

    // Compute kill zone once per candle — not per level
    const activeKZ = getKillZoneAtTime(candle.time, killZones)

    for (const refLevel of levels) {

      // ── BSL check ──
      const bsl = detectBSL(candle, refLevel.price, options)
      if (bsl && (options.weakStrengthEnabled || bsl.strength !== 'weak')) {
        const sweep: Sweep = {
          id:          `bsl-${refLevel.type}-${candle.time}`,
          timestamp:   candle.time,
          type:        'bsl',
          level:       refLevel.price,
          levelType:   refLevel.type,
          sweepExtent: bsl.sweepExtent,
          closeReturn: bsl.closeReturn,
          strength:    bsl.strength,
          inKillZone:  activeKZ !== null,
          killZoneId:  activeKZ?.id ?? null,
          sessionId:   refLevel.sessionId,
        }
        if (!isDuplicateSweep(detected, sweep, options.duplicateCooldown)) {
          detected.push(sweep)
        }
      }

      // ── SSL check ──
      const ssl = detectSSL(candle, refLevel.price, options)
      if (ssl && (options.weakStrengthEnabled || ssl.strength !== 'weak')) {
        const sweep: Sweep = {
          id:          `ssl-${refLevel.type}-${candle.time}`,
          timestamp:   candle.time,
          type:        'ssl',
          level:       refLevel.price,
          levelType:   refLevel.type,
          sweepExtent: ssl.sweepExtent,
          closeReturn: ssl.closeReturn,
          strength:    ssl.strength,
          inKillZone:  activeKZ !== null,
          killZoneId:  activeKZ?.id ?? null,
          sessionId:   refLevel.sessionId,
        }
        if (!isDuplicateSweep(detected, sweep, options.duplicateCooldown)) {
          detected.push(sweep)
        }
      }
    }
  }

  return detected
}

// ─────────────────────────────────────────────
// REAL-TIME CHECK
// Check a single just-closed candle.
// Returns a new sweep or null.
// Called on every candle close from the WebSocket.
// ─────────────────────────────────────────────

export function checkCandleForSweep(
  candle:         Candle,
  levels:         ReferenceLevel[],
  killZones:      KillZone[],
  existingSweeps: Sweep[],
  options:        SweepDetectionOptions = DEFAULT_OPTIONS
): Sweep | null {
  const activeKZ = getKillZoneAtTime(candle.time, killZones)

  for (const refLevel of levels) {

    const bsl = detectBSL(candle, refLevel.price, options)
    if (bsl && (options.weakStrengthEnabled || bsl.strength !== 'weak')) {
      const sweep: Sweep = {
        id:          `bsl-${refLevel.type}-${candle.time}`,
        timestamp:   candle.time,
        type:        'bsl',
        level:       refLevel.price,
        levelType:   refLevel.type,
        sweepExtent: bsl.sweepExtent,
        closeReturn: bsl.closeReturn,
        strength:    bsl.strength,
        inKillZone:  activeKZ !== null,
        killZoneId:  activeKZ?.id ?? null,
        sessionId:   refLevel.sessionId,
      }
      if (!isDuplicateSweep(existingSweeps, sweep, options.duplicateCooldown)) {
        return sweep
      }
    }

    const ssl = detectSSL(candle, refLevel.price, options)
    if (ssl && (options.weakStrengthEnabled || ssl.strength !== 'weak')) {
      const sweep: Sweep = {
        id:          `ssl-${refLevel.type}-${candle.time}`,
        timestamp:   candle.time,
        type:        'ssl',
        level:       refLevel.price,
        levelType:   refLevel.type,
        sweepExtent: ssl.sweepExtent,
        closeReturn: ssl.closeReturn,
        strength:    ssl.strength,
        inKillZone:  activeKZ !== null,
        killZoneId:  activeKZ?.id ?? null,
        sessionId:   refLevel.sessionId,
      }
      if (!isDuplicateSweep(existingSweeps, sweep, options.duplicateCooldown)) {
        return sweep
      }
    }
  }

  return null
}

// ─────────────────────────────────────────────
// DISPLAY HELPERS
// Pure formatting — used by both chart markers
// and the alert panel component.
// ─────────────────────────────────────────────

export function getSweepColor(sweep: Sweep): string {
  return sweep.type === 'bsl' ? '#f87171' : '#4ade80'
}

export function getSweepLabel(sweep: Sweep): string {
  const prefix     = sweep.inKillZone ? '⚡ ' : ''
  const typeLabel  = sweep.type === 'bsl' ? 'BSL' : 'SSL'
  return `${prefix}${typeLabel}`
}

export function getStrengthColor(strength: SweepStrength): string {
  if (strength === 'strong')   return '#fbbf24'  // amber
  if (strength === 'moderate') return '#94a3b8'  // slate
  return '#4b5563'                               // gray
}

export function getLevelDisplayName(levelType: LevelType): string {
  const map: Record<LevelType, string> = {
    'asian-high':  'Asian High',
    'asian-low':   'Asian Low',
    'london-high': 'London High',
    'london-low':  'London Low',
    'ny-high':     'NY High',
    'ny-low':      'NY Low',
  }
  return map[levelType]
}

export function timestampToPHT(utcSecs: number): string {
  const pht  = new Date((utcSecs + 8 * 3600) * 1000)
  const h    = pht.getUTCHours()
  const m    = pht.getUTCMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
}