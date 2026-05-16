interface StatsRowProps {
  activeCount: number
  activeNames: string
  marketStatus: string
  marketSub: string
  utcTime: string
  nextEventName: string
  nextEventCountdown: string
}

// ─────────────────────────────────────────────
// SUB-COMPONENT — individual stat card
// ─────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub: string
  valueColor?: string
}

function StatCard({ label, value, sub, valueColor }: StatCardProps) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex-1 min-w-0"
      style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <p
        className="text-xs font-semibold tracking-widest uppercase mb-1.5"
        style={{ color: '#7d8590' }}
      >
        {label}
      </p>
      <p
        className="font-mono text-lg font-bold leading-none mb-1 truncate"
        style={{ color: valueColor ?? '#e6edf3' }}
      >
        {value}
      </p>
      <p className="text-xs truncate" style={{ color: '#7d8590' }}>
        {sub}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function StatsRow({
  activeCount,
  activeNames,
  marketStatus,
  marketSub,
  utcTime,
  nextEventName,
  nextEventCountdown,
}: StatsRowProps) {

  // Color the market status value based on activity level
  const statusColor =
    marketStatus === 'Peak'
      ? '#f59e0b'   // amber — overlap
      : marketStatus === 'Active'
      ? '#34d399'   // green — normal
      : '#7d8590'   // gray — quiet

  return (
    <div className="flex gap-3 mt-3 flex-wrap">
      <StatCard
        label="Active Sessions"
        value={String(activeCount)}
        sub={activeNames}
        valueColor="#34d399"
      />
      <StatCard
        label="Market Status"
        value={marketStatus}
        sub={marketSub}
        valueColor={statusColor}
      />
      <StatCard
        label="UTC Time"
        value={utcTime}
        sub="Coordinated Universal"
      />
      <StatCard
        label="Next Event"
        value={nextEventName}
        sub={nextEventCountdown}
      />
    </div>
  )
}