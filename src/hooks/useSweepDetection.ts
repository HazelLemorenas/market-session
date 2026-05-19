import { useState, useEffect, useRef, useCallback } from 'react'
import {
  runSweepDetection,
  checkCandleForSweep,
  getReferenceLevels,
  DEFAULT_OPTIONS,
  type Candle,
  type Sweep,
  type SweepDetectionOptions,
} from '../utils/sweepDetectionUtils'
import { getKillZones }   from '../utils/killZoneUtils'
import type { SessionStat } from '../utils/sessionStatsUtils'

// ─────────────────────────────────────────────
// CONSTANTS
// Detection always runs on 5m candles regardless
// of what timeframe the chart is displaying.
// 5m gives reliable OHLC data with less noise
// than 1m for sweep confirmation.
// ─────────────────────────────────────────────

const MAX_SWEEPS = 50
const REST_URL   = 'https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=5m&limit=500'
const WS_URL     = 'wss://stream.binance.com:9443/ws/ethusdt@kline_5m'

// ─────────────────────────────────────────────
// CANDLE FETCHER
// ─────────────────────────────────────────────

async function fetchCandles(): Promise<Candle[]> {
  const res = await fetch(REST_URL)
  const raw: number[][] = await res.json()
  return raw.map((k) => ({
    time:  k[0] / 1000,
    open:  parseFloat(String(k[1])),
    high:  parseFloat(String(k[2])),
    low:   parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
  }))
}

// ─────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────

export interface UseSweepDetectionReturn {
  sweeps:      Sweep[]        // all detected sweeps newest first
  recentSweep: Sweep | null   // most recent — used to trigger UI alerts
  isConnected: boolean        // WebSocket status
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useSweepDetection(
  sessionStats: SessionStat[],
  options:      SweepDetectionOptions = DEFAULT_OPTIONS
): UseSweepDetectionReturn {
  const [sweeps,      setSweeps]      = useState<Sweep[]>([])
  const [recentSweep, setRecentSweep] = useState<Sweep | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // ── Refs ──────────────────────────────────
  // Refs let WebSocket handlers access the latest
  // values without needing to re-connect on every render.

  const sweepsRef       = useRef<Sweep[]>([])
  const candlesRef      = useRef<Candle[]>([])
  const optionsRef      = useRef(options)
  const sessionStatsRef = useRef(sessionStats)

  // Sync refs with latest values on every render — no effects needed
  optionsRef.current      = options
  sessionStatsRef.current = sessionStats

  // ── Stable sweep adder ────────────────────
  // useCallback with empty deps ensures this never
  // changes, keeping it safe as an Effect 1 dependency.

  const addSweep = useCallback((sweep: Sweep) => {
    const updated = [sweep, ...sweepsRef.current].slice(0, MAX_SWEEPS)
    sweepsRef.current = updated
    setSweeps([...updated])
    setRecentSweep(sweep)
  }, [])

  // ── Effect 1: WebSocket + candle fetch ────
  // Runs ONCE on mount. Fetches historical candles
  // for initial context, then connects WebSocket and
  // listens only for confirmed candle close events.

  useEffect(() => {
    let cancelled = false
    let ws: WebSocket | null = null

    async function init() {
      // Fetch initial candle history
      try {
        const candles = await fetchCandles()
        if (cancelled) return
        candlesRef.current = candles
      } catch (err) {
        console.error('useSweepDetection: REST fetch failed', err)
      }

      // Connect live WebSocket
      ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        if (!cancelled) setIsConnected(true)
      }

      ws.onclose = () => {
        if (!cancelled) setIsConnected(false)
      }

      ws.onerror = () => {
        if (!cancelled) setIsConnected(false)
      }

      ws.onmessage = (event) => {
        if (cancelled) return

        const k = JSON.parse(event.data).k

        // ── Core timing decision ──
        // k.x === true means the candle just CLOSED.
        // We only run detection on closed candles because:
        // - The close condition (price rejected back inside) requires a final close
        // - Intra-candle detection would generate false positives constantly
        if (!k.x) return

        const closedCandle: Candle = {
          time:  k.t / 1000,
          open:  parseFloat(k.o),
          high:  parseFloat(k.h),
          low:   parseFloat(k.l),
          close: parseFloat(k.c),
        }

        // Append closed candle to local history, keep rolling 500
        candlesRef.current = [...candlesRef.current, closedCandle].slice(-500)

        // Get fresh levels from the latest sessionStats
        const levels = getReferenceLevels(sessionStatsRef.current)
        if (levels.length === 0) return

        const sweep = checkCandleForSweep(
          closedCandle,
          levels,
          getKillZones(),
          sweepsRef.current,
          optionsRef.current
        )

        if (sweep) addSweep(sweep)
      }
    }

    init()

    return () => {
      cancelled = true
      ws?.close()
    }
  }, [addSweep])

  // ── Effect 2: Historical scan ─────────────
  // Re-runs whenever sessionStats updates with data.
  // This solves the race condition: sessionStats loads
  // asynchronously (REST call), so levels might be empty
  // when Effect 1 first runs. Effect 2 fires once levels
  // are available and rescans all candles in history.
  //
  // Also re-runs when sessionStats refreshes every 60s,
  // which updates levels with the most recent session
  // highs/lows as the session progresses.

  useEffect(() => {
    // Wait until both data sources are ready
    if (sessionStats.length === 0)       return
    if (candlesRef.current.length === 0) return

    const levels = getReferenceLevels(sessionStats)
    if (levels.length === 0) return

    const detected = runSweepDetection(
      candlesRef.current,
      levels,
      getKillZones(),
      optionsRef.current
    )

    // Sort newest first and cap at MAX_SWEEPS
    const sorted = [...detected].reverse().slice(0, MAX_SWEEPS)

    sweepsRef.current = sorted
    setSweeps([...sorted])

    if (sorted.length > 0) setRecentSweep(sorted[0])
  }, [sessionStats])

  return { sweeps, recentSweep, isConnected }
}