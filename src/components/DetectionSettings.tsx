import { useState } from 'react'
import { DEFAULT_OPTIONS, type SweepDetectionOptions } from '../utils/sweepDetectionUtils'

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface DetectionSettingsProps {
  options:    SweepDetectionOptions
  onChange:   (updated: SweepDetectionOptions) => void
  onApply:    () => void
  sweepCount: number
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function DetectionSettings({
  options,
  onChange,
  onApply,
  sweepCount,
}: DetectionSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  function update<K extends keyof SweepDetectionOptions>(
    key:   K,
    value: SweepDetectionOptions[K]
  ) {
    onChange({ ...options, [key]: value })
  }

  // Display minSweepPct as a whole-number percentage (0.0015 → 0.15)
  const displayPct = parseFloat((options.minSweepPct * 100).toFixed(2))

  return (
    <div
      className="rounded-2xl mt-3"
      style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Header — always visible, click to expand ── */}
      <div
        className="flex items-center justify-between px-4 py-3 select-none"
        style={{ cursor: 'pointer' }}
        onClick={() => setIsOpen((p) => !p)}
      >
        <div className="flex items-center gap-3">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#7d8590' }}
          >
            Sweep Detection Settings
          </p>
          {sweepCount > 0 && (
            <span
              className="font-mono text-xs font-bold px-2 py-0.5 rounded"
              style={{
                background: 'rgba(74,222,128,0.12)',
                color:      '#4ade80',
                border:     '1px solid rgba(74,222,128,0.2)',
              }}
            >
              {sweepCount} detected
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg
          width="12" height="8" viewBox="0 0 12 8" fill="none"
          style={{
            color:      '#7d8590',
            transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* ── Settings panel ── */}
      {isOpen && (
        <div
          className="px-4 pb-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex flex-col gap-5 pt-4">

            {/* ── Setting 1: Min wick extension ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#e6edf3' }}>
                    Min wick extension
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>
                    How far price must pass the level to qualify
                  </p>
                </div>
                <span
                  className="font-mono text-sm font-bold ml-4"
                  style={{ color: '#4ade80', flexShrink: 0 }}
                >
                  {displayPct.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min={5} max={50} step={1}
                value={Math.round(options.minSweepPct * 10000)}
                onChange={(e) =>
                  update('minSweepPct', parseInt(e.target.value) / 10000)
                }
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span style={{ color: '#7d8590', fontSize: 10 }}>0.05% — very sensitive</span>
                <span style={{ color: '#7d8590', fontSize: 10 }}>0.50% — strict</span>
              </div>
            </div>

            {/* ── Setting 2: Duplicate cooldown ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#e6edf3' }}>
                    Duplicate cooldown
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>
                    Candles before same level can trigger again
                  </p>
                </div>
                <span
                  className="font-mono text-sm font-bold ml-4"
                  style={{ color: '#e6edf3', flexShrink: 0 }}
                >
                  {options.duplicateCooldown}
                </span>
              </div>
              <input
                type="range"
                min={1} max={20} step={1}
                value={options.duplicateCooldown}
                onChange={(e) =>
                  update('duplicateCooldown', parseInt(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span style={{ color: '#7d8590', fontSize: 10 }}>1 — more alerts</span>
                <span style={{ color: '#7d8590', fontSize: 10 }}>20 — fewer alerts</span>
              </div>
            </div>

            {/* ── Setting 3: Include weak sweeps toggle ── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold" style={{ color: '#e6edf3' }}>
                  Include weak sweeps
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>
                  Show low-confidence detections alongside strong + moderate
                </p>
              </div>
              <button
                onClick={() =>
                  update('weakStrengthEnabled', !options.weakStrengthEnabled)
                }
                style={{
                  position:     'relative',
                  width:        40,
                  height:       22,
                  borderRadius: 11,
                  background:   options.weakStrengthEnabled
                    ? '#4ade80'
                    : 'rgba(255,255,255,0.1)',
                  border:       'none',
                  cursor:       'pointer',
                  transition:   'background 0.2s',
                  flexShrink:   0,
                  marginLeft:   16,
                  padding:      0,
                }}
              >
                <span
                  style={{
                    position:    'absolute',
                    top:         3,
                    left:        options.weakStrengthEnabled ? 21 : 3,
                    width:       16,
                    height:      16,
                    borderRadius:'50%',
                    background:  '#fff',
                    transition:  'left 0.2s',
                  }}
                />
              </button>
            </div>

            {/* ── Action buttons ── */}
            <div className="flex gap-2">
              <button
                onClick={onApply}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(74,222,128,0.15)',
                  color:      '#4ade80',
                  border:     '1px solid rgba(74,222,128,0.3)',
                  cursor:     'pointer',
                }}
              >
                Apply & Rescan
              </button>
              <button
                onClick={() => onChange({ ...DEFAULT_OPTIONS })}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color:      '#7d8590',
                  border:     '1px solid rgba(255,255,255,0.07)',
                  cursor:     'pointer',
                }}
              >
                Reset defaults
              </button>
            </div>

            {/* ── Current defaults note ── */}
            <p style={{ color: '#7d8590', fontSize: 10, opacity: 0.55, lineHeight: 1.6 }}>
              Defaults: 0.15% min wick · 5 candle cooldown · weak sweeps off.
              Click Apply & Rescan after changing settings to immediately re-scan
              all loaded candles with the new parameters.
            </p>

          </div>
        </div>
      )}
    </div>
  )
}