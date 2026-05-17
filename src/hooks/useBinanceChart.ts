import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type Timeframe = '1m' | '5m'

export interface Candle {
  time: number   // Unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
}

interface UseBinanceChartReturn {
  candles: Candle[]
  lastPrice: number | null
  priceChange: number | null  // % change vs 24h ago
  isConnected: boolean
  timeframe: Timeframe
  setTimeframe: (tf: Timeframe) => void
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const SYMBOL = 'ethusdt'
const HISTORY_LIMIT = 1000  // candles to load on startup

function getRestUrl(tf: Timeframe) {
  return `https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=${tf}&limit=${HISTORY_LIMIT}`
}

function getWsUrl(tf: Timeframe) {
  return `wss://stream.binance.com:9443/ws/${SYMBOL}@kline_${tf}`
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useBinanceChart(): UseBinanceChartReturn {
  const [candles, setCandles] = useState<Candle[]>([])
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [timeframe, setTimeframe] = useState<Timeframe>('5m')

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let cancelled = false

    // ── 1. Fetch historical candles from REST ──
    async function loadHistory() {
      try {
        const res = await fetch(getRestUrl(timeframe))
        const raw: number[][] = await res.json()

        if (cancelled) return

        const parsed: Candle[] = raw.map((k) => ({
          time: k[0] / 1000,   // Binance gives ms, chart needs seconds
          open: parseFloat(String(k[1])),
          high: parseFloat(String(k[2])),
          low: parseFloat(String(k[3])),
          close: parseFloat(String(k[4])),
        }))

        setCandles(parsed)

        // Set last price and 24h change from history
        if (parsed.length > 0) {
          const latest = parsed[parsed.length - 1]
          const oldest = parsed[0]
          setLastPrice(latest.close)
          const change = ((latest.close - oldest.open) / oldest.open) * 100
          setPriceChange(parseFloat(change.toFixed(2)))
        }
      } catch (err) {
        console.error('Failed to fetch candle history:', err)
      }
    }

    // ── 2. Open WebSocket for live updates ──
    function connectWebSocket() {
      // Close any existing connection first
      if (wsRef.current) {
        wsRef.current.close()
      }

      const ws = new WebSocket(getWsUrl(timeframe))
      wsRef.current = ws

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

        const msg = JSON.parse(event.data)
        const k = msg.k  // kline data object from Binance

        const updatedCandle: Candle = {
          time: k.t / 1000,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        }

        setLastPrice(updatedCandle.close)

        setCandles((prev) => {
          if (prev.length === 0) return [updatedCandle]

          const last = prev[prev.length - 1]

          if (last.time === updatedCandle.time) {
            // Same candle — update the last one in place
            return [...prev.slice(0, -1), updatedCandle]
          } else {
            // New candle — append it
            return [...prev, updatedCandle]
          }
        })
      }
    }

    loadHistory()
    connectWebSocket()

    // ── 3. Cleanup on timeframe change or unmount ──
    return () => {
      cancelled = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [timeframe])  // re-runs whenever timeframe changes

  return {
    candles,
    lastPrice,
    priceChange,
    isConnected,
    timeframe,
    setTimeframe,
  }
}