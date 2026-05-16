interface SessionTimelineProps {
  dayFraction: number  // 0–1, current PHT position in the day
}

// ─────────────────────────────────────────────
// SESSION POSITIONS ON THE 24HR PHT TIMELINE
// All values are fractions of 24 hours (0 = 12AM, 1 = 12AM next day)
// ─────────────────────────────────────────────

const toFrac = (hour: number) => hour / 24

const BARS = [
  // Asian: 8AM–5PM PHT
  {
    id: 'asian',
    label: 'Asian',
    color: '#3b82f6',
    segments: [{ start: toFrac(8), end: toFrac(17) }],
  },
  // London: 3PM–12AM PHT
  {
    id: 'london',
    label: 'London',
    color: '#a78bfa',
    segments: [{ start: toFrac(15), end: toFrac(24) }],
  },
  // New York: 8PM–5AM PHT (crosses midnight — two segments)
  {
    id: 'ny',
    label: 'New York',
    color: '#34d399',
    segments: [
      { start: toFrac(20), end: toFrac(24) }, // 8PM to midnight
      { start: toFrac(0),  end: toFrac(5)  }, // midnight to 5AM
    ],
  },
  // London–NY Overlap: 8PM–12AM PHT
  {
    id: 'overlap',
    label: 'LN–NY Overlap',
    color: '#f59e0b',
    segments: [{ start: toFrac(20), end: toFrac(24) }],
  },
]

// Hour labels shown below the track
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
  return (
    <div
      className="rounded-2xl p-4 mt-3"
      style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Section title */}
      <p
        className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: '#7d8590' }}
      >
        24-Hour Session Map · PHT (UTC+8)
      </p>

      {/* ── Timeline track ── */}
      <div className="relative">

        {/* Background track */}
        <div
          className="relative h-8 rounded-lg overflow-hidden mb-1"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {/* Session bars */}
          {BARS.map((bar) =>
            bar.segments.map((seg, i) => (
              <div
                key={`${bar.id}-${i}`}
                className="absolute top-0 h-full rounded"
                style={{
                  left: `${seg.start * 100}%`,
                  width: `${(seg.end - seg.start) * 100}%`,
                  background: bar.color,
                  opacity: bar.id === 'overlap' ? 0.5 : 0.28,
                }}
              />
            ))
          )}

          {/* Now marker — white vertical line */}
          <div
            className="absolute top-0 h-full w-0.5 rounded"
            style={{
              left: `${dayFraction * 100}%`,
              background: '#ffffff',
              opacity: 0.9,
            }}
          >
            {/* Triangle pointer on top */}
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '5px solid #ffffff',
              }}
            />
          </div>
        </div>

        {/* ── Hour labels ── */}
        <div className="relative h-4">
          {HOUR_LABELS.map((tick) => (
            <span
              key={tick.label + tick.frac}
              className="absolute text-xs transform -translate-x-1/2"
              style={{
                left: `${tick.frac * 100}%`,
                color: '#7d8590',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
        {BARS.map((bar) => (
          <div key={bar.id} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ background: bar.color }}
            />
            <span style={{ color: '#7d8590', fontSize: '11px' }}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}