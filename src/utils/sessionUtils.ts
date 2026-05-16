// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type SessionId = 'asian' | 'london' | 'ny'

export interface Session {
  id: SessionId
  name: string
  cities: string
  flags: string    // ← keep this line
  regions: string[] // ← add this line
  startUTC: number
  endUTC: number
  color: string
}

export interface SessionState extends Session {
  isActive: boolean
  countdown: string      // "HH:MM:SS" until open or close
  countdownLabel: string // "Opens in" or "Closes in"
}

// ─────────────────────────────────────────────
// SESSION DEFINITIONS
// All times are in UTC. PHT = UTC + 8.
//
// Asian:   00:00–09:00 UTC  →  08:00–17:00 PHT
// London:  07:00–16:00 UTC  →  15:00–00:00 PHT
// NY:      12:00–21:00 UTC  →  20:00–05:00 PHT
// Overlap: 12:00–16:00 UTC  →  20:00–00:00 PHT
// ─────────────────────────────────────────────

export const SESSIONS: Session[] = [
  {
    id: 'asian',
    name: 'Asian',
    cities: 'Tokyo · Singapore',
    flags: '🇯🇵🇸🇬',
    regions: ['JP', 'SG'],
    startUTC: 0,
    endUTC: 9,
    color: '#3b82f6',
  },
  {
    id: 'london',
    name: 'London',
    cities: 'London · Frankfurt',
    flags: '🇬🇧🇪🇺',
    regions: ['GB', 'EU'],
    startUTC: 7,
    endUTC: 16,
    color: '#a78bfa',
  },
  {
    id: 'ny',
    name: 'New York',
    cities: 'New York',
    flags: '🇺🇸',
    regions: ['US'],
    startUTC: 12,
    endUTC: 21,
    color: '#34d399',
  },
]

export const OVERLAP = {
  londonStart: 7,
  londonEnd: 16,
  nyStart: 12,
  nyEnd: 21,
}

// ─────────────────────────────────────────────
// CORE TIME FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Returns the current time as a decimal UTC hour.
 * e.g. 14:30:00 UTC → 14.5
 */
function getUTCHourDecimal(): number {
  const now = new Date()
  return (
    now.getUTCHours() +
    now.getUTCMinutes() / 60 +
    now.getUTCSeconds() / 3600
  )
}

/**
 * Checks if a session is currently active based on UTC start/end hours.
 * Handles sessions that cross midnight (e.g. NY: 20:00–05:00 PHT).
 */
export function isSessionActive(startUTC: number, endUTC: number): boolean {
  const h = getUTCHourDecimal()
  if (startUTC < endUTC) {
    return h >= startUTC && h < endUTC
  }
  // Crosses midnight
  return h >= startUTC || h < endUTC
}

/**
 * Returns seconds remaining until a session opens.
 */
export function getSecsUntilStart(startUTC: number): number {
  const now = new Date()
  const nowSecs =
    now.getUTCHours() * 3600 +
    now.getUTCMinutes() * 60 +
    now.getUTCSeconds()
  const startSecs = startUTC * 3600
  let diff = startSecs - nowSecs
  if (diff <= 0) diff += 86400 // add 24 hours if already passed today
  return diff
}

/**
 * Returns seconds remaining until a session closes.
 */
export function getSecsUntilEnd(endUTC: number): number {
  const now = new Date()
  const nowSecs =
    now.getUTCHours() * 3600 +
    now.getUTCMinutes() * 60 +
    now.getUTCSeconds()
  const endSecs = endUTC * 3600
  let diff = endSecs - nowSecs
  if (diff <= 0) diff += 86400
  return diff
}

/**
 * Returns true if both London AND New York sessions are active
 * simultaneously — the highest-liquidity overlap window.
 */
export function isOverlapActive(): boolean {
  return (
    isSessionActive(OVERLAP.londonStart, OVERLAP.londonEnd) &&
    isSessionActive(OVERLAP.nyStart, OVERLAP.nyEnd)
  )
}

// ─────────────────────────────────────────────
// FORMATTING FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Formats a number of seconds into HH:MM:SS string.
 * e.g. 3661 → "01:01:01"
 */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

/**
 * Formats a Date object into 12-hour PHT time string.
 * e.g. "02:30:45 PM"
 */
export function formatPHT(date: Date): string {
  // Shift UTC to PHT by adding 8 hours
  const pht = new Date(date.getTime() + 8 * 3600 * 1000)
  const h = pht.getUTCHours()
  const m = pht.getUTCMinutes()
  const s = pht.getUTCSeconds()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`
}

/**
 * Formats a Date object into a readable PHT date string.
 * e.g. "Saturday, May 17, 2025"
 */
export function formatPHTDate(date: Date): string {
  const pht = new Date(date.getTime() + 8 * 3600 * 1000)
  return pht.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // we already shifted manually
  })
}

/**
 * Formats a Date object into HH:MM UTC string.
 * e.g. "06:30"
 */
export function formatUTC(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

/**
 * Returns current PHT time as a 0–1 fraction of the day.
 * Used to position the "now" marker on the 24hr timeline bar.
 * e.g. 12:00 noon PHT → 0.5
 */
export function getPHTDayFraction(): number {
  const now = new Date()
  const pht = new Date(now.getTime() + 8 * 3600 * 1000)
  const totalSecs =
    pht.getUTCHours() * 3600 +
    pht.getUTCMinutes() * 60 +
    pht.getUTCSeconds()
  return totalSecs / 86400
}

// ─────────────────────────────────────────────
// DERIVED STATE BUILDER
// ─────────────────────────────────────────────

/**
 * Combines a session definition with its current live state.
 * This is what components will actually consume.
 */
export function buildSessionState(session: Session): SessionState {
  const active = isSessionActive(session.startUTC, session.endUTC)
  const secs = active
    ? getSecsUntilEnd(session.endUTC)
    : getSecsUntilStart(session.startUTC)

  return {
    ...session,
    isActive: active,
    countdown: formatDuration(Math.round(secs)),
    countdownLabel: active ? 'Closes in' : 'Opens in',
  }
}