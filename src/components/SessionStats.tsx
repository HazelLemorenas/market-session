import { useSessionStats } from '../hooks/useSessionStats'
import type { SessionStat } from '../utils/sessionStatsUtils'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function utcToPHT(utcHour: number): string {
  const pht  = (utcHour + 8) % 24
  const ampm = pht >= 12 ? 'PM' : 'AM'
  const h12  = pht % 12 || 12
  return `${h12}:00 ${ampm}`
}

function fmtPrice(price: number): string {
  return `$${price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtChange(change: number): string {
  const sign = change >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(change).toFixed(2)}`
}

// ─────────────────────────────────────────────
// STAT ROW — label on left, value + change on right
// ─────────────────────────────────────────────

function StatRow({
  label,
  value,
  change,
  changeColor,
}: {
  label:        string
  value:        string
  change?:      string | null
  changeColor?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: '#7d8590' }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className="text-xs font-mono"
          style={{ color: '#e6edf3' }}
        >
          {value}
        </span>
        {change && changeColor && (
          <span
            className="font-mono font-semibold"
            style={{ color: changeColor, fontSize: 10 }}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SESSION STAT CARD
// ─────────────────────────────────────────────

function StatCard({ stat }: { stat: SessionStat }) {
  const { color, status, name } = stat
  const isActive    = status === 'active'
  const isCompleted = status === 'completed'
  const isUpcoming  = status === 'upcoming'
  const hasData     = stat.open !== null

  const statusLabel = isActive ? 'LIVE' : isCompleted ? 'DONE' : 'SOON'
  const statusColor = isActive ? '#34d399' : isCompleted ? '#7d8590' : '#f59e0b'

  return (
    <div
      className="flex-1 rounded-xl p-3 min-w-0"
      style={{
        background: isActive ? `${color}12` : '#0d1117',
        border:     `1px solid ${isActive
          ? `${color}44`
          : 'rgba(255,255,255,0.07)'}`,
        position:   'relative',
        overflow:   'hidden',
      }}
    >
      {/* Active top accent line */}
      {isActive && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: color,
        }} />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: isActive ? color : '#7d8590' }}
        >
          {name}
        </span>
        <span
          className="font-bold rounded px-1.5 py-0.5"
          style={{
            background:  `${statusColor}22`,
            color:        statusColor,
            fontFamily:  'monospace',
            fontSize:     9,
            letterSpacing: '0.06em',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* ── Upcoming: show open time only ── */}
      {isUpcoming && (
        <div className="text-center py-4">
          <p className="text-xs mb-1" style={{ color: '#7d8590' }}>
            Opens at
          </p>
          <p
            className="text-sm font-bold"
            style={{ color: '#e6edf3', fontFamily: 'monospace' }}
          >
            {utcToPHT(stat.openTimeUTC)} PHT
          </p>
        </div>
      )}

      {/* ── Active / Completed stats ── */}
      {!isUpcoming && (
        <div className="flex flex-col gap-1.5">
          <StatRow
            label="Open"
            value={hasData ? fmtPrice(stat.open!) : '—'}
          />
          <StatRow
            label="High"
            value={hasData ? fmtPrice(stat.high!) : '—'}
            change={hasData ? fmtChange(stat.highChange!) : null}
            changeColor="#34d399"
          />
          <StatRow
            label="Low"
            value={hasData ? fmtPrice(stat.low!) : '—'}
            change={hasData ? fmtChange(stat.lowChange!) : null}
            changeColor="#f87171"
          />

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2, paddingTop: 6 }}>
            <StatRow
              label="Range"
              value={hasData ? `$${stat.range!.toFixed(2)}` : '—'}
            />
          </div>

          {/* Direction */}
          {hasData && stat.isBullish !== null && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: '#7d8590' }}>
                {isActive ? 'So far' : 'Result'}
              </span>
              <span
                className="text-xs font-semibold"
                style={{
                  color: stat.isBullish ? '#34d399' : '#f87171',
                }}
              >
                {stat.isBullish ? '↑ Bullish' : '↓ Bearish'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function SessionStats() {
  const { stats, loading, lastUpdated, refresh } = useSessionStats()

  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      className="rounded-2xl p-4 mt-3"
      style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#7d8590' }}
        >
          Session Statistics · ETH/USDT 5m
        </p>
        <div className="flex items-center gap-2">
          {updatedStr && (
            <span className="text-xs" style={{ color: '#7d8590', opacity: 0.6 }}>
              Updated {updatedStr}
            </span>
          )}
          <button
            onClick={refresh}
            className="text-xs px-2 py-1 rounded transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color:      '#7d8590',
              border:     '1px solid rgba(255,255,255,0.07)',
              cursor:     'pointer',
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div
          className="flex items-center justify-center py-6"
          style={{ color: '#7d8590' }}
        >
          <span className="text-xs">Loading session data...</span>
        </div>
      ) : (
        <div className="flex gap-3">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      )}

      {/* ── Footer note ── */}
      <p
        className="text-xs mt-3"
        style={{ color: '#7d8590', opacity: 0.5 }}
      >
        High and low changes are relative to session open · Auto-refreshes every 60s
      </p>
    </div>
  )
}