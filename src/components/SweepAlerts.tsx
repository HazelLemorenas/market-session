import { useEffect, useRef, useState } from 'react'
import {
  getSweepColor,
  getStrengthColor,
  getLevelDisplayName,
  timestampToPHT,
  type Sweep,
  type SweepStrength,
} from '../utils/sweepDetectionUtils'

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface SweepAlertsProps {
  sweeps:      Sweep[]
  recentSweep: Sweep | null
  isConnected: boolean
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

// Type badge — BSL (red ↓) or SSL (green ↑)
function TypeBadge({ type, size = 'sm' }: { type: 'bsl' | 'ssl'; size?: 'sm' | 'lg' }) {
  const color  = type === 'bsl' ? '#f87171' : '#4ade80'
  const label  = type === 'bsl' ? 'BSL ↓'  : 'SSL ↑'
  const fSize  = size === 'lg'  ? 12        : 10

  return (
    <span
      style={{
        background:    `${color}18`,
        color,
        border:        `1px solid ${color}44`,
        borderRadius:  6,
        padding:       size === 'lg' ? '3px 8px' : '2px 6px',
        fontFamily:    'monospace',
        fontWeight:    700,
        fontSize:      fSize,
        letterSpacing: '0.04em',
        whiteSpace:    'nowrap',
        flexShrink:    0,
      }}
    >
      {label}
    </span>
  )
}

// Strength badge
function StrengthBadge({ strength }: { strength: SweepStrength }) {
  const color = getStrengthColor(strength)
  const label = strength.toUpperCase()

  return (
    <span
      style={{
        color,
        fontFamily:    'monospace',
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.06em',
        flexShrink:    0,
      }}
    >
      {label}
    </span>
  )
}

// Kill zone chip — shown when the sweep occurred inside a kill zone
function KillZoneChip({ killZoneId }: { killZoneId: string }) {
  const labelMap: Record<string, string> = {
    'asian-kz':  'AKZ',
    'london-kz': 'LKZ',
    'ny-am-kz':  'NKZ',
    'ny-pm-kz':  'PKZ',
  }
  const label = labelMap[killZoneId] ?? 'KZ'

  return (
    <span
      style={{
        background:    'rgba(251,191,36,0.12)',
        color:         '#fbbf24',
        border:        '1px solid rgba(251,191,36,0.3)',
        borderRadius:  4,
        padding:       '1px 5px',
        fontFamily:    'monospace',
        fontSize:      9,
        fontWeight:    700,
        flexShrink:    0,
      }}
    >
      ⚡{label}
    </span>
  )
}

// ─────────────────────────────────────────────
// FEATURED CARD — most recent sweep
// Shown prominently at the top with full detail
// ─────────────────────────────────────────────

function FeaturedSweep({
  sweep,
  isNew,
}: {
  sweep:  Sweep
  isNew:  boolean
}) {
  const sweepColor   = getSweepColor(sweep)
  const directionMsg = sweep.type === 'bsl'
    ? 'Price swept above, closed back below — possible bearish rejection'
    : 'Price swept below, closed back above — possible bullish rejection'

  return (
    <div
      style={{
        background:   `${sweepColor}0d`,
        border:       `1px solid ${isNew ? sweepColor : `${sweepColor}44`}`,
        borderRadius: 12,
        padding:      '12px 14px',
        marginBottom: 10,
        transition:   'border-color 0.5s ease',
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={sweep.type} size="lg" />
          <span
            className="text-sm font-semibold"
            style={{ color: '#e6edf3' }}
          >
            {getLevelDisplayName(sweep.levelType)}
          </span>
          <span
            className="font-mono text-sm"
            style={{ color: sweepColor }}
          >
            ${sweep.level.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sweep.inKillZone && sweep.killZoneId && (
            <KillZoneChip killZoneId={sweep.killZoneId} />
          )}
          <span
            className="font-mono text-xs"
            style={{ color: '#7d8590' }}
          >
            {timestampToPHT(sweep.timestamp)} PHT
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <span className="text-xs" style={{ color: '#7d8590' }}>Wick beyond </span>
          <span className="font-mono text-xs font-semibold" style={{ color: sweepColor }}>
            +${sweep.sweepExtent.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-xs" style={{ color: '#7d8590' }}>Closed inside </span>
          <span className="font-mono text-xs font-semibold" style={{ color: '#e6edf3' }}>
            ${sweep.closeReturn.toFixed(2)}
          </span>
        </div>
        <StrengthBadge strength={sweep.strength} />
      </div>

      {/* Description */}
      <p
        className="text-xs mt-2"
        style={{ color: '#7d8590', fontStyle: 'italic' }}
      >
        {directionMsg}
      </p>

      {/* New sweep pulse indicator */}
      {isNew && (
        <div className="flex items-center gap-1.5 mt-2">
          <div
            style={{
              width:      6,
              height:     6,
              borderRadius: '50%',
              background:  sweepColor,
            }}
          />
          <span className="text-xs font-semibold" style={{ color: sweepColor }}>
            Just detected
          </span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SWEEP ROW — compact history entry
// ─────────────────────────────────────────────

function SweepRow({ sweep }: { sweep: Sweep }) {
  const sweepColor = getSweepColor(sweep)

  return (
    <div
      className="flex items-center gap-2 py-2 flex-wrap"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Time */}
      <span
        className="font-mono text-xs"
        style={{ color: '#7d8590', minWidth: 72, flexShrink: 0 }}
      >
        {timestampToPHT(sweep.timestamp)}
      </span>

      {/* Type badge */}
      <TypeBadge type={sweep.type} />

      {/* Level */}
      <span className="text-xs flex-1 min-w-0 truncate" style={{ color: '#e6edf3' }}>
        {getLevelDisplayName(sweep.levelType)}
      </span>

      {/* Price */}
      <span
        className="font-mono text-xs"
        style={{ color: sweepColor, flexShrink: 0 }}
      >
        ${sweep.level.toFixed(2)}
      </span>

      {/* Wick */}
      <span
        className="font-mono text-xs"
        style={{ color: sweepColor, flexShrink: 0, minWidth: 52 }}
      >
        +${sweep.sweepExtent.toFixed(2)}
      </span>

      {/* Strength */}
      <StrengthBadge strength={sweep.strength} />

      {/* Kill zone chip */}
      {sweep.inKillZone && sweep.killZoneId
        ? <KillZoneChip killZoneId={sweep.killZoneId} />
        : <div style={{ width: 32, flexShrink: 0 }} />
      }
    </div>
  )
}

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-6 text-center"
      style={{ color: '#7d8590' }}
    >
      <p className="text-sm mb-1">No sweeps detected in current session history</p>
      <p className="text-xs opacity-60">
        Watching for price to sweep session highs/lows and close back inside
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function SweepAlerts({
  sweeps,
  recentSweep,
  isConnected,
}: SweepAlertsProps) {

  // Track when a brand-new sweep arrives so we can
  // briefly highlight the featured card
  const [isNewSweep, setIsNewSweep]     = useState(false)
  const prevRecentIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!recentSweep) return
    if (recentSweep.id === prevRecentIdRef.current) return

    // New sweep arrived
    prevRecentIdRef.current = recentSweep.id
    setIsNewSweep(true)

    const timeout = setTimeout(() => setIsNewSweep(false), 4000)
    return () => clearTimeout(timeout)
  }, [recentSweep])

  // Show the featured card + up to 7 history rows
  const [featured, ...history] = sweeps
  const historyRows            = history.slice(0, 7)

  // Counts for the header
  const killZoneCount = sweeps.filter((s) => s.inKillZone).length
  const bslCount      = sweeps.filter((s) => s.type === 'bsl').length
  const sslCount      = sweeps.filter((s) => s.type === 'ssl').length

  return (
    <div
      className="rounded-2xl p-4 mt-3"
      style={{
        background: '#161b22',
        border:     '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#7d8590' }}
          >
            Liquidity Sweeps · ETH/USDT
          </p>

          {/* Sweep type counts */}
          {sweeps.length > 0 && (
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: '#f87171' }}
              >
                {bslCount} BSL
              </span>
              <span style={{ color: '#7d8590', fontSize: 10 }}>·</span>
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: '#4ade80' }}
              >
                {sslCount} SSL
              </span>
              {killZoneCount > 0 && (
                <>
                  <span style={{ color: '#7d8590', fontSize: 10 }}>·</span>
                  <span
                    className="font-mono text-xs font-semibold"
                    style={{ color: '#fbbf24' }}
                  >
                    ⚡{killZoneCount} in KZ
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Detection status */}
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   isConnected ? '#4ade80' : '#f59e0b',
              flexShrink:   0,
            }}
          />
          <span className="text-xs" style={{ color: '#7d8590' }}>
            {isConnected ? 'Detecting' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      {sweeps.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Featured: most recent sweep */}
          {featured && (
            <FeaturedSweep
              sweep={featured}
              isNew={isNewSweep}
            />
          )}

          {/* History rows */}
          {historyRows.length > 0 && (
            <div>
              {/* Column headers */}
              <div
                className="flex items-center gap-2 pb-1.5 mb-0.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                {['Time', 'Type', 'Level', 'Price', 'Wick', 'Str', 'KZ'].map(
                  (col) => (
                    <span
                      key={col}
                      className="text-xs uppercase"
                      style={{
                        color:         '#7d8590',
                        fontSize:       9,
                        letterSpacing: '0.06em',
                        flexShrink:    0,
                        minWidth:
                          col === 'Time'  ? 72 :
                          col === 'Type'  ? 40 :
                          col === 'Level' ? 0  :
                          col === 'Price' ? 60 :
                          col === 'Wick'  ? 52 :
                          col === 'Str'   ? 40 : 32,
                        flex: col === 'Level' ? 1 : undefined,
                      }}
                    >
                      {col}
                    </span>
                  )
                )}
              </div>

              {historyRows.map((sweep) => (
                <SweepRow key={sweep.id} sweep={sweep} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Footer ── */}
      <p
        className="text-xs mt-3"
        style={{ color: '#7d8590', opacity: 0.5 }}
      >
        Detection runs on 5m candle closes only · BSL = buy-side sweep (bearish rejection) · SSL = sell-side sweep (bullish rejection)
      </p>
    </div>
  )
}