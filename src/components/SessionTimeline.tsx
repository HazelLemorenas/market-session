import { getKillZones, utcToFrac, utcToPHTStr } from '../utils/killZoneUtils'

interface SessionTimelineProps {
  dayFraction: number
}

// ─────────────────────────────────────────────
// SESSION BARS (PHT fractions, fixed)
// ─────────────────────────────────────────────

const toFrac = (h: number) => h / 24

const SESSION_BARS = [
  { id: 'asian',   color: '#3b82f6', start: toFrac(8),  end: toFrac(17) },
  { id: 'london',  color: '#a78bfa', start: toFrac(14), end: toFrac(24) },
  { id: 'ny-a',    color: '#34d399', start: toFrac(19), end: toFrac(24) },
  { id: 'ny-b',    color: '#34d399', start: toFrac(0),  end: toFrac(5)  },
  { id: 'overlap', color: '#f59e0b', start: toFrac(19), end: toFrac(24), opacity: 0.45 },
]

const HOUR_LABELS = [
  { label: '12AM', frac: toFrac(0)  },
  { label: '4AM',  frac: toFrac(4)  },
  { label: '8AM',  frac: toFrac(8)  },
  { label: '12PM', frac: toFrac(12) },
  { label: '4PM',  frac: toFrac(16) },
  { label: '8PM',  frac: toFrac(20) },
  { label: '12AM', frac: toFrac(24) },
]

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function SessionTimeline({ dayFraction }: SessionTimelineProps) {
  const killZones = getKillZones()

  return (
    <div
      className="rounded-2xl p-4 mt-3"
      style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <p
        className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: '#7d8590' }}
      >
        24-Hour Session Map · PHT (UTC+8)
      </p>

      {/* ── Session bar track ── */}
      <div
        className="relative h-7 rounded-lg overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        {SESSION_BARS.map(({ id, color, start, end, opacity = 0.28 }) => (
          <div
            key={id}
            className="absolute top-0 h-full rounded"
            style={{
              left:       `${start * 100}%`,
              width:      `${(end - start) * 100}%`,
              background: color,
              opacity,
            }}
          />
        ))}

        {/* Now marker */}
        <div
          className="absolute top-0 h-full w-0.5 rounded"
          style={{ left: `${dayFraction * 100}%`, background: '#fff', opacity: 0.9 }}
        >
          <div style={{
            position: 'absolute', top: -3, left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft:  '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop:   '5px solid #fff',
          }} />
        </div>
      </div>

      {/* ── Hour labels ── */}
      <div className="relative h-4 mb-2">
        {HOUR_LABELS.map(({ label, frac }) => (
          <span
            key={label + frac}
            className="absolute -translate-x-1/2"
            style={{
              left:       `${frac * 100}%`,
              color:      '#7d8590',
              fontSize:   10,
              fontFamily: 'monospace',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* ── Kill zone track ── */}
      <p
        className="text-xs font-semibold tracking-widest uppercase mb-1.5"
        style={{ color: '#7d8590', fontSize: 9, opacity: 0.7 }}
      >
        Kill Zones
      </p>
      <div
        className="relative h-5 rounded-lg overflow-hidden mb-1"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        {killZones.map((kz) => {
          const startFrac = utcToFrac(kz.startUTC)
          const endFrac   = utcToFrac(kz.endUTC)
          return (
            <div
              key={kz.id}
              className="absolute top-0 h-full flex items-center justify-center"
              style={{
                left:        `${startFrac * 100}%`,
                width:       `${(endFrac - startFrac) * 100}%`,
                background:  `${kz.color}30`,
                borderLeft:  `2px solid ${kz.color}`,
                opacity:     0.9,
              }}
            >
              <span style={{
                fontSize:   8,
                fontFamily: 'monospace',
                fontWeight: 700,
                color:      kz.color,
              }}>
                {kz.abbr}
              </span>
            </div>
          )
        })}

        {/* Now marker on kill zone track */}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${dayFraction * 100}%`, background: '#fff', opacity: 0.7 }}
        />
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {/* Sessions */}
        {[
          { label: 'Asian (8AM–5PM)',        color: '#3b82f6' },
          { label: 'London (2PM–11PM)',       color: '#a78bfa' },
          { label: 'New York (7PM–4AM)',      color: '#34d399' },
          { label: 'LN–NY Overlap',           color: '#f59e0b' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, background: color, opacity: 0.7, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: '#7d8590', fontSize: 10 }}>{label}</span>
          </div>
        ))}

        {/* Spacer */}
        <div style={{ width: '100%' }} />

        {/* Kill zones */}
        {killZones.map((kz) => (
          <div key={kz.id} className="flex items-center gap-1.5">
            <div style={{
              width:       8,
              height:      8,
              background:  `${kz.color}40`,
              borderLeft:  `2px solid ${kz.color}`,
              borderRadius: '0 2px 2px 0',
              flexShrink:  0,
            }} />
            <span style={{ color: '#7d8590', fontSize: 10 }}>
              {kz.name} ({utcToPHTStr(kz.startUTC)}–{utcToPHTStr(kz.endUTC)})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Need to import utcToPHTStr too - add to the import line at the top:
// import { getKillZones, utcToFrac, utcToPHTStr } from '../utils/killZoneUtils'