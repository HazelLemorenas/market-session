import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { useBinanceChart, type Timeframe } from '../hooks/useBinanceChart'
import { isUSDST, isUKDST } from '../utils/sessionUtils'
import { getKillZones } from '../utils/killZoneUtils'

// ─────────────────────────────────────────────
// SESSION BOUNDARY DEFINITIONS
// ─────────────────────────────────────────────
const CHART_HEIGHT = 500
function getBoundaries() {
  const londonOffset = isUKDST() ? -1 : 0
  const nyOffset     = isUSDST() ? -1 : 0
  return [
    { hour: 0,                  color: '#3b82f6', label: 'A' },
    { hour: 9,                  color: '#3b82f6', label: 'A' },
    { hour: 7  + londonOffset,  color: '#a78bfa', label: 'L' },
    { hour: 16 + londonOffset,  color: '#a78bfa', label: 'L' },
    { hour: 12 + nyOffset,      color: '#34d399', label: 'N' },
    { hour: 21 + nyOffset,      color: '#34d399', label: 'N' },
  ]
}

function getMostRecentBoundaries() {
  const now        = new Date()
  const nowUTCSecs = now.getTime() / 1000

  const todayMidnight = new Date(now)
  todayMidnight.setUTCHours(0, 0, 0, 0)
  const todayStart     = todayMidnight.getTime() / 1000
  const yesterdayStart = todayStart - 86400

  return getBoundaries().map(({ hour, color, label }) => {  // ← updated
    const todayOccurrence     = todayStart     + hour * 3600
    const yesterdayOccurrence = yesterdayStart + hour * 3600
    const ts = todayOccurrence <= nowUTCSecs
      ? todayOccurrence
      : yesterdayOccurrence
    return { ts, color, label }
  })
}

/**
 * Returns the start timestamp (seconds) of each UTC day
 * within the visible range, with a 1-day buffer on each side
 */
function getDayStarts(fromSec: number, toSec: number): number[] {
  const starts: number[] = []
  const startDay = new Date((fromSec - 86400) * 1000)
  startDay.setUTCHours(0, 0, 0, 0)
  let current = startDay.getTime() / 1000
  while (current <= toSec + 86400) {
    starts.push(current)
    current += 86400
  }
  return starts
}

// ─────────────────────────────────────────────
// SESSION COLOR DETECTION
// Given a UTC timestamp, returns the color of
// whichever session is active at that moment.
// Priority: NY > London > Asian > gray
// ─────────────────────────────────────────────

function getSessionColor(utcTimestampSecs: number): string {
  const date         = new Date(utcTimestampSecs * 1000)
  const utcHour      = date.getUTCHours() + date.getUTCMinutes() / 60
  const londonOffset = isUKDST(date) ? -1 : 0
  const nyOffset     = isUSDST(date) ? -1 : 0

  const inAsian  = utcHour >= 0                   && utcHour < 9
  const inLondon = utcHour >= (7  + londonOffset) && utcHour < (16 + londonOffset)
  const inNY     = utcHour >= (12 + nyOffset)     && utcHour < (21 + nyOffset)

  if (inNY)     return '#34d399'
  if (inLondon) return '#a78bfa'
  if (inAsian)  return '#3b82f6'
  return '#7d8590'
}

function getSessionName(utcTimestampSecs: number): string {
  const date         = new Date(utcTimestampSecs * 1000)
  const utcHour      = date.getUTCHours() + date.getUTCMinutes() / 60
  const londonOffset = isUKDST(date) ? -1 : 0
  const nyOffset     = isUSDST(date) ? -1 : 0

  if (utcHour >= (12 + nyOffset)     && utcHour < (21 + nyOffset))     return 'NY'
  if (utcHour >= (7  + londonOffset) && utcHour < (16 + londonOffset)) return 'London'
  if (utcHour >= 0                   && utcHour < 9)                   return 'Asian'
  return 'Off-session'
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface LinePos {
  id:    string
  x:     number
  color: string
  label: string
}

interface ZonePos {
  id:    string
  x1:    number
  x2:    number
  color: string
  label: string
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function CryptoChart() {
  const {
    candles,
    lastPrice,
    priceChange,
    isConnected,
    timeframe,
    setTimeframe,
  } = useBinanceChart()

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const seriesRef    = useRef<ISeriesApi<'Candlestick', any> | null>(null)
  

  // Session vertical lines
  const [lines, setLines]           = useState<LinePos[]>([])
  const [zones, setZones]   = useState<ZonePos[]>([])
  const [killZones, setKillZones] = useState<(ZonePos & { abbr: string })[]>([]) 
  const [chartHeight, setChartHeight] = useState(CHART_HEIGHT)

  // Drawing tool state
  const [drawingMode, setDrawingMode] = useState(false)
  const [lastDrawnSession, setLastDrawnSession] = useState<string | null>(null)
  const drawnLinesRef = useRef<any[]>([]) // stores IPriceLine objects for undo/clear
  const prevCandlesLengthRef = useRef(0)

  // ── Initialize chart ────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#161b22' },
        textColor: '#7d8590',
      },
      localization: {
        timeFormatter: (timestamp: number) => {
          const pht  = new Date((timestamp + 8 * 3600) * 1000)
          const h    = pht.getUTCHours()
          const m    = pht.getUTCMinutes()
          const ampm = h >= 12 ? 'PM' : 'AM'
          const h12  = h % 12 || 12
          return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
        },
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255,255,255,0.2)',
          labelBackgroundColor: '#1c2332',
        },
        horzLine: {
          color: 'rgba(255,255,255,0.2)',
          labelBackgroundColor: '#1c2332',
        },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.07)' },
      timeScale: {
        borderColor:    'rgba(255,255,255,0.07)',
        timeVisible:    true,
        secondsVisible: false,
        tickMarkFormatter: (time: any) => {
          const pht  = new Date((time + 8 * 3600) * 1000)
          const h    = pht.getUTCHours()
          const m    = pht.getUTCMinutes()
          const ampm = h >= 12 ? 'PM' : 'AM'
          const h12  = h % 12 || 12
          return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
        },
      },
      width:  containerRef.current.clientWidth,
      height: CHART_HEIGHT,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor:         '#34d399',
      downColor:       '#f87171',
      borderUpColor:   '#34d399',
      borderDownColor: '#f87171',
      wickUpColor:     '#34d399',
      wickDownColor:   '#f87171',
    })

    chartRef.current  = chart
    seriesRef.current = series

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  }, [])

  // ── Feed candle data ────────────────────────
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return

    seriesRef.current.setData(
      candles.map((c) => ({
        time:  c.time as any,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }))
    )

    // Only scroll to real-time when candles first load
    // or when reloading after a timeframe switch (length resets to 0 then back up)
    // Never scroll again after that — user is free to pan
    if (prevCandlesLengthRef.current === 0 && candles.length > 0) {
      chartRef.current?.timeScale().scrollToRealTime()
    }

    prevCandlesLengthRef.current = candles.length
  }, [candles])

  // ── Session vertical lines ──────────────────
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return

    const chart = chartRef.current

function computeLines() {
  if (!chartRef.current || !containerRef.current) return

  const timeScale    = chartRef.current.timeScale()
  const visibleRange = timeScale.getVisibleRange()
  if (!visibleRange) return

  // ── Existing line computation ──
  const timestamps = getMostRecentBoundaries()
  const computed: LinePos[] = []
  timestamps.forEach(({ ts, color, label }) => {
    const x = timeScale.timeToCoordinate(ts as any)
    if (x !== null) {
      computed.push({ id: `${ts}-${color}`, x: Math.round(x), color, label })
    }
  })
  setLines(computed)
  setChartHeight(containerRef.current?.clientHeight ?? CHART_HEIGHT)

  // ── NEW: Overlap zone computation ──
  const londonOffset = isUKDST() ? -1 : 0
  const nyOffset     = isUSDST() ? -1 : 0

  const londonOpen  = 7  + londonOffset
  const londonClose = 16 + londonOffset
  const asianClose  = 9
  const nyOpen      = 12 + nyOffset

  const dayStarts = getDayStarts(
    visibleRange.from as number,
    visibleRange.to   as number
  )

  const computedZones: ZonePos[] = []

  dayStarts.forEach((dayStart) => {
    // Asian–London overlap: London opens while Asian still active
    const alStart = dayStart + londonOpen  * 3600
    const alEnd   = dayStart + asianClose  * 3600

    // London–NY overlap: NY opens while London still active
    const lnStart = dayStart + nyOpen      * 3600
    const lnEnd   = dayStart + londonClose * 3600

    const x1AL = timeScale.timeToCoordinate(alStart as any)
    const x2AL = timeScale.timeToCoordinate(alEnd   as any)
    const x1LN = timeScale.timeToCoordinate(lnStart as any)
    const x2LN = timeScale.timeToCoordinate(lnEnd   as any)

    if (x1AL !== null && x2AL !== null && x2AL > x1AL) {
      computedZones.push({
        id:    `al-${dayStart}`,
        x1:    Math.round(x1AL),
        x2:    Math.round(x2AL),
        color: 'rgba(139,92,246,0.07)',  // indigo — Asian+London
        label: 'A+L',
      })
    }

    if (x1LN !== null && x2LN !== null && x2LN > x1LN) {
      computedZones.push({
        id:    `ln-${dayStart}`,
        x1:    Math.round(x1LN),
        x2:    Math.round(x2LN),
        color: 'rgba(245,158,11,0.09)',  // amber — London+NY
        label: 'L+N',
      })
    }
  })

  // ── Kill zone computation ──────────────────
const kzDefs          = getKillZones()
const computedKillZones: (ZonePos & { abbr: string })[] = []

  dayStarts.forEach((dayStart) => {
    kzDefs.forEach((kz) => {
      const kzStart = dayStart + kz.startUTC * 3600
      const kzEnd   = dayStart + kz.endUTC   * 3600

      const x1 = timeScale.timeToCoordinate(kzStart as any)
      const x2 = timeScale.timeToCoordinate(kzEnd   as any)

      if (x1 !== null && x2 !== null && x2 > x1) {
        computedKillZones.push({
          id:    `${kz.id}-${dayStart}`,
          x1:    Math.round(x1),
          x2:    Math.round(x2),
          color: kz.color,
          label: kz.name,
          abbr:  kz.abbr,
        })
      }
    })
  })

  setKillZones(computedKillZones)

  setZones(computedZones)
}

    const rafId = requestAnimationFrame(() => setTimeout(computeLines, 50))
    chart.timeScale().subscribeVisibleTimeRangeChange(computeLines)
    chart.timeScale().subscribeVisibleLogicalRangeChange(computeLines)

    // Refresh every 60 seconds so lines reset automatically at UTC midnight
    const intervalId = setInterval(computeLines, 60000)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(intervalId)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(computeLines)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(computeLines)
    }
  }, [candles.length])

  // ── Drawing tool click handler ───────────────
  useEffect(() => {
    if (!drawingMode) return
    if (!containerRef.current || !chartRef.current || !seriesRef.current) return

    const container = containerRef.current
    const chart     = chartRef.current
    const series    = seriesRef.current

    function handleClick(e: MouseEvent) {
      const rect = container.getBoundingClientRect()
      const x    = e.clientX - rect.left
      const y    = e.clientY - rect.top

      // Convert pixel coords to price and time
      const price = series.coordinateToPrice(y)
      const time  = chart.timeScale().coordinateToTime(x)

      if (price === null || time === null) return

      const utcSecs    = time as number
      const color      = getSessionColor(utcSecs)
      const sessionName = getSessionName(utcSecs)

      // Draw the horizontal ray as a price line
      const priceLine = series.createPriceLine({
        price,
        color,
        lineWidth:        1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: true,
        title:            sessionName,
      })

      drawnLinesRef.current.push(priceLine)
      setLastDrawnSession(sessionName)
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [drawingMode, candles.length])

  // ── Drawing tool actions ────────────────────

  function handleUndo() {
    if (!seriesRef.current || drawnLinesRef.current.length === 0) return
    const last = drawnLinesRef.current.pop()
    seriesRef.current.removePriceLine(last)
    setLastDrawnSession(null)
  }

  function handleClearAll() {
    if (!seriesRef.current) return
    drawnLinesRef.current.forEach((line) => {
      seriesRef.current!.removePriceLine(line)
    })
    drawnLinesRef.current = []
    setLastDrawnSession(null)
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  const changeColor =
    priceChange === null ? '#7d8590'
    : priceChange >= 0   ? '#34d399'
    :                      '#f87171'

  const TIMEFRAMES: Timeframe[] = ['1m', '5m']

  return (
    <div
      className="rounded-2xl overflow-hidden mt-3"
      style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Header: pair + price ── */}
      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-3">
        <div>
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#7d8590' }}
          >
            ETH / USDT
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className="text-xl font-bold font-mono"
              style={{ color: '#e6edf3' }}
            >
              {lastPrice !== null
                ? `$${lastPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '---'}
            </span>
            {priceChange !== null && (
              <span
                className="text-xs font-semibold font-mono"
                style={{ color: changeColor }}
              >
                {priceChange >= 0 ? '+' : ''}{priceChange}%
              </span>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: isConnected ? '#34d399' : '#f59e0b' }}
            />
            <span className="text-xs" style={{ color: '#7d8590' }}>
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
          </div>

          {/* Timeframe toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className="px-3 py-1 text-xs font-semibold font-mono transition-all duration-200"
                style={{
                  background: timeframe === tf
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
                  color:  timeframe === tf ? '#e6edf3' : '#7d8590',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Drawing toolbar ── */}
      <div
        className="flex items-center gap-2 px-4 py-2 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Draw Ray toggle */}
        <button
          onClick={() => setDrawingMode((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{
            background: drawingMode
              ? 'rgba(167,139,250,0.2)'
              : 'rgba(255,255,255,0.05)',
            color:  drawingMode ? '#a78bfa' : '#7d8590',
            border: drawingMode
              ? '1px solid rgba(167,139,250,0.4)'
              : '1px solid rgba(255,255,255,0.07)',
            cursor: 'pointer',
          }}
        >
          {/* Horizontal ray icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="0" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M10 4L14 7L10 10" fill="currentColor"/>
          </svg>
          {drawingMode ? 'Drawing...' : 'Draw Ray'}
        </button>

        {/* Undo */}
        <button
          onClick={handleUndo}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color:      '#7d8590',
            border:     '1px solid rgba(255,255,255,0.07)',
            cursor:     'pointer',
          }}
        >
          Undo
        </button>

        {/* Clear All */}
        <button
          onClick={handleClearAll}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{
            background: 'rgba(248,113,113,0.08)',
            color:      '#f87171',
            border:     '1px solid rgba(248,113,113,0.2)',
            cursor:     'pointer',
          }}
        >
          Clear All
        </button>

        {/* Session hint — shows which session your last line landed in */}
        {drawingMode && (
          <span className="text-xs" style={{ color: '#7d8590' }}>
            {lastDrawnSession
              ? `Last ray → ${lastDrawnSession} session`
              : 'Click anywhere on the chart to place a ray'}
          </span>
        )}
      </div>

  {/* ── Chart canvas + session line overlay ── */}
  <div style={{ position: 'relative', height: chartHeight }}>

    {/* Chart canvas */}
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        cursor: drawingMode ? 'crosshair' : 'default',
      }}
    />

    {/* Kill zones — lowest layer, behind everything */}
  {killZones.map(({ id, x1, x2, color, abbr }) => (
    <div
      key={id}
      style={{
        position:      'absolute',
        top:           0,
        left:          x1,
        width:         Math.max(0, x2 - x1),
        height:        '100%',
        background:    `${color}09`,
        borderLeft:    `2px solid ${color}`,
        opacity:       0.85,
        pointerEvents: 'none',
        zIndex:        2,
      }}
    >
      <span
        style={{
          position:   'absolute',
          bottom:     10,
          left:       '50%',
          transform:  'translateX(-50%)',
          fontSize:   8,
          fontFamily: 'monospace',
          fontWeight: 700,
          color,
          opacity:    0.75,
          whiteSpace: 'nowrap',
        }}
      >
        {abbr}
      </span>
    </div>
  ))}

  {/* Overlap zone shading — rendered BEHIND session lines */}
  {zones.map(({ id, x1, x2, color, label }) => (
    <div
      key={id}
      style={{
        position: 'absolute',
        top: 0,
        left: x1,
        width: Math.max(0, x2 - x1),
        height: '100%',
        background: color,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 8,
          fontFamily: 'monospace',
          fontWeight: 700,
          color: label === 'L+N' ? '#f59e0b' : '#8b5cf6',
          opacity: 0.7,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  ))}

  {/* Session vertical lines — rendered ON TOP of zones */}
  {lines.map(({ id, x, color, label }) => (
    <div
      key={id}
      style={{
        position: 'absolute',
        top: 0,
        left: x,
        height: '100%',
        width: 0,
        borderLeft: `1.5px dashed ${color}`,
        opacity: 0.6,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 4,
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: 700,
            color,
            opacity: 0.9,
          }}
        >
          {label}
        </span>
      </div>
    ))}
  </div>

      {/* ── Legend ── */}
      <div
  className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2"
  style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
>
  {/* Session boundary lines */}
  {[
    { label: 'Asian boundaries',     color: '#3b82f6', dashed: true  },
    { label: 'London boundaries',    color: '#a78bfa', dashed: true  },
    { label: 'NY boundaries',        color: '#34d399', dashed: true  },
  ].map(({ label, color }) => (
    <div key={label} className="flex items-center gap-1.5">
      <div style={{ width: 16, height: 0, borderTop: `2px dashed ${color}`, opacity: 0.7, flexShrink: 0 }} />
      <span style={{ color: '#7d8590', fontSize: 11 }}>{label}</span>
    </div>
  ))}

  {/* Divider */}
  <div style={{ width: '100%', height: 0, borderTop: '1px solid rgba(255,255,255,0.05)', margin: '2px 0' }} />

  {/* Overlap zones */}
  {[
    { label: 'Asian–London overlap', color: '#8b5cf6' },
    { label: 'London–NY overlap',    color: '#f59e0b' },
  ].map(({ label, color }) => (
    <div key={label} className="flex items-center gap-1.5">
      <div style={{ width: 16, height: 10, background: color, opacity: 0.35, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ color: '#7d8590', fontSize: 11 }}>{label}</span>
    </div>
  ))}

        {/* Kill zones */}
        {[
          { label: 'Asian Kill Zone',     color: '#fbbf24' },
          { label: 'London Kill Zone',    color: '#e879f9' },
          { label: 'NY AM Kill Zone',     color: '#4ade80' },
          { label: 'NY PM Kill Zone',     color: '#94a3b8' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{
              width:       16,
              height:      10,
              background:  `${color}25`,
              borderLeft:  `2px solid ${color}`,
              borderRadius: '0 2px 2px 0',
              flexShrink:  0,
            }} />
            <span style={{ color: '#7d8590', fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}