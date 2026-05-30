interface LiveClockProps {
  clockTime: string
  clockDate: string
  utcTime: string
}

export default function LiveClock({ clockTime, clockDate, utcTime }: LiveClockProps) {
  return (
    <div
      className="flex items-center justify-between mt-4 px-2 flex-wrap gap-3"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '12px',
      }}
    >
      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: '#34d399' }}
          />
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{ background: '#34d399', opacity: 0.4 }}
          />
        </div>
        <div>
          <p
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: '#e6edf3', fontFamily: 'monospace' }}
          >
            ForexSessions
          </p>
          <p className="text-xs" style={{ color: '#7d8590' }}>
            Philippine Time · UTC+8
          </p>
        </div>
      </div>

      {/* Right: clock — now shows seconds for candle tracking */}
      <div className="text-right">
        <p
          className="text-2xl font-bold tracking-wide leading-none"
          style={{ color: '#e6edf3', fontFamily: 'monospace' }}
        >
          {clockTime}
        </p>
        <p className="text-xs mt-1" style={{ color: '#7d8590' }}>
          {clockDate}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: '#7d8590', fontFamily: 'monospace' }}
        >
          UTC {utcTime}
        </p>
      </div>
    </div>
  )
}