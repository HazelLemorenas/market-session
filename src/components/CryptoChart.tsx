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

// ─────────────────────────────────────────────
// SESSION BOUNDARY DEFINITIONS
// ─────────────────────────────────────────────
const CHART_HEIGHT = 500
const BOUNDARIES = [
  { hour: 0,  color: '#3b82f6', label: 'A' },
  { hour: 9,  color: '#3b82f6', label: 'A' },
  { hour: 7,  color: '#a78bfa', label: 'L' },
  { hour: 16, color: '#a78bfa', label: 'L' },
  { hour: 12, color: '#34d399', label: 'N' },
  { hour: 21, color: '#34d399', label: 'N' },
]

function getSessionTimestamps(fromSec: number, toSec: number) {
  const results: { ts: number; color: string; label: string }[] = []
  const startDay = new Date((fromSec - 86400) * 1000)
  startDay.setUTCHours(0, 0, 0, 0)
  const endSec = toSec + 86400
  let current = startDay.getTime() / 1000
  while (current <= endSec) {
    BOUNDARIES.forEach(({ hour, color, label }) => {
      results.push({ ts: current + hour * 3600, color, label })
    })
    current += 86400
  }
  return results
}

// ─────────────────────────────────────────────
// SESSION COLOR DETECTION
// Given a UTC timestamp, returns the color of
// whichever session is active at that moment.
// Priority: NY > London > Asian > gray
// ─────────────────────────────────────────────

function getSessionColor(utcTimestampSecs: number): string {
  const date    = new Date(utcTimestampSecs * 1000)
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60

  const inAsian  = utcHour >= 0  && utcHour < 9
  const inLondon = utcHour >= 7  && utcHour < 16
  const inNY     = utcHour >= 12 && utcHour < 21

  if (inNY)     return '#34d399' // green
  if (inLondon) return '#a78bfa' // purple
  if (inAsian)  return '#3b82f6' // blue
  return '#7d8590'               // gray — no active session
}

function getSessionName(utcTimestampSecs: number): string {
  const date    = new Date(utcTimestampSecs * 1000)
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60

  if (utcHour >= 12 && utcHour < 21) return 'NY'
  if (utcHour >= 7  && utcHour < 16) return 'London'
  if (utcHour >= 0  && utcHour < 9)  return 'Asian'
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

      const timestamps = getSessionTimestamps(
        visibleRange.from as number,
        visibleRange.to   as number
      )

      const computed: LinePos[] = []
      timestamps.forEach(({ ts, color, label }) => {
        const x = timeScale.timeToCoordinate(ts as any)
        if (x !== null) {
          computed.push({ id: `${ts}-${color}`, x: Math.round(x), color, label })
        }
      })

      setLines(computed)
      setChartHeight(containerRef.current?.clientHeight ?? 400)
    }

    const rafId = requestAnimationFrame(() => setTimeout(computeLines, 50))
    chart.timeScale().subscribeVisibleTimeRangeChange(computeLines)
    chart.timeScale().subscribeVisibleLogicalRangeChange(computeLines)

    return () => {
      cancelAnimationFrame(rafId)
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

      {/* ── Chart + session line overlay ── */}
      <div style={{ position: 'relative', height: chartHeight }}>

        {/* Chart canvas */}
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset:    0,
            cursor:   drawingMode ? 'crosshair' : 'default',
          }}
        />

        {/* Session vertical lines */}
        {lines.map(({ id, x, color, label }) => (
          <div
            key={id}
            style={{
              position:      'absolute',
              top:           0,
              left:          x,
              height:        '100%',
              width:         0,
              borderLeft:    `1.5px dashed ${color}`,
              opacity:       0.6,
              pointerEvents: 'none',
              zIndex:        10,
            }}
          >
            <span
              style={{
                position:   'absolute',
                top:        8,
                left:       4,
                fontSize:   9,
                fontFamily: 'monospace',
                fontWeight: 700,
                color,
                opacity:    0.9,
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
        {[
          { label: 'Asian boundaries',  color: '#3b82f6' },
          { label: 'London boundaries', color: '#a78bfa' },
          { label: 'NY boundaries',     color: '#34d399' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{
              width:      16,
              height:     0,
              borderTop:  `2px dashed ${color}`,
              opacity:    0.7,
              flexShrink: 0,
            }} />
            <span style={{ color: '#7d8590', fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}