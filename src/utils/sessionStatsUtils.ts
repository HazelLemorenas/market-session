import { getSessions } from './sessionUtils'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface Candle {
  time:  number
  open:  number
  high:  number
  low:   number
  close: number
}

export type SessionStatus = 'completed' | 'active' | 'upcoming'

export interface SessionStat {
  id:          string
  name:        string
  color:       string
  status:      SessionStatus
  openTimeUTC: number        // for PHT display
  open:        number | null
  high:        number | null
  low:         number | null
  close:       number | null
  range:       number | null
  highChange:  number | null // high  - open
  lowChange:   number | null // low   - open
  closeChange: number | null // close - open
  isBullish:   boolean | null
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getStatus(startSecs: number, endSecs: number): SessionStatus {
  const now = Date.now() / 1000
  if (now < startSecs) return 'upcoming'
  if (now >= endSecs)  return 'completed'
  return 'active'
}

function calcOHLC(candles: Candle[]) {
  if (candles.length === 0) return null
  const open  = candles[0].open
  const close = candles[candles.length - 1].close
  const high  = Math.max(...candles.map((c) => c.high))
  const low   = Math.min(...candles.map((c) => c.low))
  return {
    open,
    high,
    low,
    close,
    range: parseFloat((high - low).toFixed(2)),
  }
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

export function computeSessionStats(candles: Candle[]): SessionStat[] {
  const sessions = getSessions()

  // Today's UTC midnight in seconds
  const todayMidnight = new Date()
  todayMidnight.setUTCHours(0, 0, 0, 0)
  const dayStart = todayMidnight.getTime() / 1000

  return sessions.map((session) => {
    const windowStart = dayStart + session.startUTC * 3600
    const windowEnd   = dayStart + session.endUTC   * 3600
    const status      = getStatus(windowStart, windowEnd)

    // Candles whose open time falls inside this session window
    const sessionCandles = candles.filter(
      (c) => c.time >= windowStart && c.time < windowEnd
    )

    const calc = calcOHLC(sessionCandles)

    return {
      id:          session.id,
      name:        session.name,
      color:       session.color,
      status,
      openTimeUTC: session.startUTC,
      open:        calc?.open        ?? null,
      high:        calc?.high        ?? null,
      low:         calc?.low         ?? null,
      close:       calc?.close       ?? null,
      range:       calc?.range       ?? null,
      highChange:  calc ? parseFloat((calc.high  - calc.open).toFixed(2)) : null,
      lowChange:   calc ? parseFloat((calc.low   - calc.open).toFixed(2)) : null,
      closeChange: calc ? parseFloat((calc.close - calc.open).toFixed(2)) : null,
      isBullish:   calc ? calc.close >= calc.open : null,
    }
  })
}