import type { SessionState } from '../utils/sessionUtils'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface SessionCardProps {
  session: SessionState
}

// ─────────────────────────────────────────────
// STATIC SESSION DISPLAY INFO
// Times shown in PHT (UTC+8), 12-hour format
// ─────────────────────────────────────────────

const SESSION_DISPLAY: Record <
  string,
  { openPHT: string; closePHT: string; utcRange: string }
> = {
  asian: {
    openPHT: '8:00 AM',
    closePHT: '5:00 PM',
    utcRange: '00:00 – 09:00',
  },
  london: {
    openPHT: '3:00 PM',
    closePHT: '12:00 AM',
    utcRange: '07:00 – 16:00',
  },
  ny: {
    openPHT: '8:00 PM',
    closePHT: '5:00 AM',
    utcRange: '12:00 – 21:00',
  },
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function SessionCard({ session }: SessionCardProps) {
  const display = SESSION_DISPLAY[session.id]
  const { isActive, color } = session

  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden transition-all duration-300"
      style={{
        background: isActive
          ? `${color}18` // hex color + 18 = ~10% opacity background
          : '#161b22',
        border: isActive
          ? `1px solid ${color}55` // ~33% opacity border
          : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top accent line — only visible when active */}
      {isActive && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: color }}
        />
      )}

      {/* ── Header: session name + status pill ── */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: isActive ? color : '#7d8590' }}
        >
          {session.name}
        </span>

        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full tracking-wide uppercase"
          style={
            isActive
              ? {
                  background: 'rgba(0,0,0,0.25)',
                  color: color,
                }
              : {
                  background: 'rgba(125,133,144,0.15)',
                  color: '#7d8590',
                }
          }
        >
          {isActive ? 'Open' : 'Closed'}
        </span>
      </div>

{/* ── Region badges + City ── */}
<div className="flex gap-1.5 mb-1.5">
  {session.regions.map((code) => (
    <span
      key={code}
      className="text-xs font-bold px-2 py-0.5 rounded"
      style={{
        background: `${color}22`,
        color: isActive ? color : '#7d8590',
        border: `1px solid ${color}33`,
        fontFamily: 'monospace',
        letterSpacing: '0.08em',
      }}
    >
      {code}
    </span>
  ))}
</div>
<div className="text-base font-semibold text-white mb-3">
  {session.cities}
</div>

      {/* ── Session times ── */}
      <div className="flex flex-col gap-1 mb-3">
        <TimeRow label="Opens" value={display.openPHT} />
        <TimeRow label="Closes" value={display.closePHT} />
        <TimeRow label="UTC" value={display.utcRange} />
      </div>

      {/* ── Countdown ── */}
      <div
        className="pt-3 border-t text-sm"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <span className="text-xs" style={{ color: '#7d8590' }}>
          {session.countdownLabel}{' '}
        </span>
        <span
          className="font-mono text-xs font-bold"
          style={{ color: isActive ? color : '#e6edf3' }}
        >
          {session.countdown}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SUB-COMPONENT — reusable time row
// ─────────────────────────────────────────────

interface TimeRowProps {
  label: string
  value: string
}

function TimeRow({ label, value }: TimeRowProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: '#7d8590' }}>{label}</span>
      <span className="font-mono" style={{ color: '#e6edf3' }}>
        {value}
      </span>
    </div>
  )
}