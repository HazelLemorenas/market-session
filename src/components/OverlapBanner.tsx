interface OverlapBannerProps {
  isVisible: boolean
}

export default function OverlapBanner({ isVisible }: OverlapBannerProps) {
  // Render nothing when overlap is not active
  if (!isVisible) return null

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4 text-sm"
      style={{
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.3)',
        color: '#f59e0b',
      }}
    >
      {/* Warning icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <div>
        <span className="font-semibold">London–New York Overlap · </span>
        <span style={{ color: '#fbbf24' }}>
          Highest liquidity window active. Prime scalping and breakout zone.
        </span>
      </div>
    </div>
  )
}