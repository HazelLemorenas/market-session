import { useState, useEffect } from 'react'
import {
  computeSessionStats,
  type Candle,
  type SessionStat,
} from '../utils/sessionStatsUtils'

// ─────────────────────────────────────────────
// Fetch 5m candles from Binance REST
// 500 candles = ~41 hours — covers all 3 sessions
// ─────────────────────────────────────────────

async function fetchCandles(): Promise<Candle[]> {
  const res = await fetch(
    'https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=5m&limit=500'
  )
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
// HOOK
// ─────────────────────────────────────────────

export function useSessionStats() {
  const [stats,   setStats]   = useState<SessionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function refresh() {
    try {
      const candles = await fetchCandles()
      setStats(computeSessionStats(candles))
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Session stats fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()

    // Refresh every 60 seconds — stats don't need tick-by-tick updates
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [])

  return { stats, loading, lastUpdated, refresh }
}