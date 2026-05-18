import { useState, useEffect } from 'react'
import {
  getSessions,
  buildSessionState,
  isOverlapActive,
  formatPHT,
  formatPHTDate,
  formatUTC,
  getPHTDayFraction,
  type SessionState,
} from '../utils/sessionUtils'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface NextEvent {
  name: string
  countdown: string
}

export interface ForexSessionsData {
  // Individual session states (active/inactive + countdown)
  sessions: SessionState[]

  // Overlap
  overlapActive: boolean

  // Clock strings — ready to render directly
  clockTime: string   // e.g. "08:45:30 PM"
  clockDate: string   // e.g. "Saturday, May 17, 2025"
  utcTime: string     // e.g. "12:45"

  // Timeline
  dayFraction: number // 0–1, position of "now" on the 24hr bar

  // Stats
  activeCount: number
  activeNames: string    // e.g. "London + New York"
  marketStatus: string   // "Peak" | "Active" | "Quiet"
  marketSub: string      // supporting description
  nextEvent: NextEvent   // the soonest session open/close
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useForexSessions(): ForexSessionsData {
  const [now, setNow] = useState<Date>(new Date())

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)

    // Cleanup: stop the interval when the component unmounts
    return () => clearInterval(interval)
  }, [])

  // ── Session states ──────────────────────────
  const sessions = getSessions().map(buildSessionState)
  const activeSessions = sessions.filter((s) => s.isActive)
  const overlapActive = isOverlapActive()

  // ── Clock strings ───────────────────────────
  const clockTime = formatPHT(now)
  const clockDate = formatPHTDate(now)
  const utcTime = formatUTC(now)
  const dayFraction = getPHTDayFraction()

  // ── Stats ───────────────────────────────────
  const activeCount = activeSessions.length
  const activeNames =
    activeCount === 0
      ? 'No sessions open'
      : activeSessions.map((s) => s.name).join(' + ')

  let marketStatus: string
  let marketSub: string

  if (overlapActive) {
    marketStatus = 'Peak'
    marketSub = 'Highest liquidity overlap'
  } else if (activeCount > 0) {
    marketStatus = 'Active'
    marketSub = 'Normal trading hours'
  } else {
    marketStatus = 'Quiet'
    marketSub = 'Low liquidity period'
  }

  // ── Next event ──────────────────────────────
  // Build a list of every upcoming open/close event and pick the soonest
  const events = sessions.map((s) => ({
    name: s.isActive ? `${s.name} Closes` : `${s.name} Opens`,
    secs: s.isActive
      ? Math.round(
          (() => {
            const n = new Date()
            const nowSecs =
              n.getUTCHours() * 3600 +
              n.getUTCMinutes() * 60 +
              n.getUTCSeconds()
            const endSecs = s.endUTC * 3600
            let diff = endSecs - nowSecs
            if (diff <= 0) diff += 86400
            return diff
          })()
        )
      : Math.round(
          (() => {
            const n = new Date()
            const nowSecs =
              n.getUTCHours() * 3600 +
              n.getUTCMinutes() * 60 +
              n.getUTCSeconds()
            const startSecs = s.startUTC * 3600
            let diff = startSecs - nowSecs
            if (diff <= 0) diff += 86400
            return diff
          })()
        ),
  }))

  events.sort((a, b) => a.secs - b.secs)

  const nextEvent: NextEvent = {
    name: events[0].name,
    countdown: formatCountdown(events[0].secs),
  }

  return {
    sessions,
    overlapActive,
    clockTime,
    clockDate,
    utcTime,
    dayFraction,
    activeCount,
    activeNames,
    marketStatus,
    marketSub,
    nextEvent,
  }
}

// ─────────────────────────────────────────────
// HELPER — local to this file only
// ─────────────────────────────────────────────

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `in ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}