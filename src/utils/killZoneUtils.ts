import { isUSDST, isUKDST } from './sessionUtils'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface KillZone {
  id:       string
  name:     string
  abbr:     string   // short label for chart
  color:    string
  startUTC: number   // decimal hours — 17.5 = 17:30
  endUTC:   number
}

// ─────────────────────────────────────────────
// KILL ZONE DEFINITIONS
// All times defined in New York time, converted
// to UTC and DST-adjusted automatically.
//
// Asian KZ:   8:00 PM – 12:00 AM NY  → 00:00–04:00 UTC (DST)
// London KZ:  2:00 AM – 5:00 AM  NY  → 06:00–09:00 UTC (DST)
// NY AM KZ:   7:00 AM – 10:00 AM NY  → 11:00–14:00 UTC (DST)
// NY PM KZ:   1:30 PM – 4:00 PM  NY  → 17:30–20:00 UTC (DST)
// ─────────────────────────────────────────────

export function getKillZones(): KillZone[] {
  // When DST is active clocks are 1hr ahead so UTC times shift 1hr earlier
  const usOffset = isUSDST() ? 0 : 1  // NY-defined kill zones
  const ukOffset = isUKDST() ? 0 : 1  // London-defined kill zone

  return [
    {
      id:       'asian-kz',
      name:     'Asian Kill Zone',
      abbr:     'AKZ',
      color:    '#fbbf24',           // amber / gold
      startUTC: 0   + usOffset,
      endUTC:   4   + usOffset,
    },
    {
      id:       'london-kz',
      name:     'London Kill Zone',
      abbr:     'LKZ',
      color:    '#e879f9',           // fuchsia / bright purple
      startUTC: 6   + ukOffset,
      endUTC:   9   + ukOffset,
    },
    {
      id:       'ny-am-kz',
      name:     'NY AM Kill Zone',
      abbr:     'NKZ',
      color:    '#4ade80',           // bright green
      startUTC: 11  + usOffset,
      endUTC:   14  + usOffset,
    },
    {
      id:       'ny-pm-kz',
      name:     'NY PM Kill Zone',
      abbr:     'PKZ',
      color:    '#94a3b8',           // slate — lower priority
      startUTC: 17.5 + usOffset,
      endUTC:   20   + usOffset,
    },
  ]
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Returns the kill zone currently active, or null if none */
export function getActiveKillZone(): KillZone | null {
  const now     = new Date()
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60
  return getKillZones().find(
    (kz) => utcHour >= kz.startUTC && utcHour < kz.endUTC
  ) ?? null
}

/** Convert UTC decimal hour to PHT 0–1 day fraction for timeline */
export function utcToFrac(utcDecimal: number): number {
  return ((utcDecimal + 8) % 24) / 24
}

/** Convert UTC decimal hour to PHT time string e.g. "2:00 PM" */
export function utcToPHTStr(utcDecimal: number): string {
  const totalMins = Math.round(((utcDecimal + 8) % 24) * 60)
  const h    = Math.floor(totalMins / 60)
  const m    = totalMins % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return m === 0
    ? `${h12}:00 ${ampm}`
    : `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}