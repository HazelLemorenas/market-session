import { useForexSessions } from '../hooks/useForexSessions'
import SessionCard from '../components/SessionCard'
import LiveClock from '../components/LiveClock'
import OverlapBanner from '../components/OverlapBanner'
import SessionTimeline from '../components/SessionTimeline'
import StatsRow from '../components/StatsRow'
import CryptoChart from '../components/CryptoChart'
import SessionStats from '../components/SessionStats'
import { useSweepDetection } from '../hooks/useSweepDetection'
import SweepAlerts           from '../components/SweepAlerts'
import { useSessionStats } from '../hooks/useSessionStats'
import { useState }                                         from 'react'
import DetectionSettings                                    from '../components/DetectionSettings'
import { DEFAULT_OPTIONS, type SweepDetectionOptions }      from '../utils/sweepDetectionUtils'

export default function Dashboard() {
  const data = useForexSessions()
  const [detectionOptions, setDetectionOptions] =
  useState<SweepDetectionOptions>(DEFAULT_OPTIONS)
  // These two lines must both exist inside Dashboard()
  const { stats } = useSessionStats()
  const { sweeps, recentSweep, isConnected: sweepConnected, rescan } = useSweepDetection(stats, detectionOptions)


  return (
    <div
      className="min-h-screen p-5"
      style={{ background: '#0d1117', color: '#e6edf3' }}
    >
      <LiveClock
        clockTime={data.clockTime}
        clockDate={data.clockDate}
        utcTime={data.utcTime}
      />

      <OverlapBanner isVisible={data.overlapActive} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>

      <SessionTimeline dayFraction={data.dayFraction} />

      <StatsRow
        activeCount={data.activeCount}
        activeNames={data.activeNames}
        marketStatus={data.marketStatus}
        marketSub={data.marketSub}
        utcTime={data.utcTime}
        nextEventName={data.nextEvent.name}
        nextEventCountdown={data.nextEvent.countdown}
      />
      <SessionStats />

      <SweepAlerts
        sweeps={sweeps}
        recentSweep={recentSweep}
        isConnected={sweepConnected}
      />

      <DetectionSettings
        options={detectionOptions}
        onChange={setDetectionOptions}
        onApply={rescan}
        sweepCount={sweeps.length}
      />

      {/* Live ETH/USDT chart */}
      <CryptoChart sweeps={sweeps} />

      <p
        className="text-center mt-4 text-xs tracking-wide"
        style={{ color: '#7d8590', opacity: 0.6 }}
      >
        All times in Philippine Standard Time (PHT · UTC+8) · Forex market hours are approximate
      </p>
    </div>

    
  )
}