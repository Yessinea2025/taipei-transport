import { useState, useEffect } from 'react'
import axios from 'axios'

function formatWait(seconds) {
  if (seconds === -1) return '未發車'
  if (seconds === -2) return '不停靠'
  if (seconds === -3) return '末班已過'
  if (seconds === -4) return '今日未營運'
  if (seconds < 60) return '進站中'
  return `${Math.round(seconds / 60)} 分鐘`
}

function waitColor(seconds) {
  if (seconds < 0) return '#555'
  if (seconds < 120) return '#22c55e'
  if (seconds < 300) return '#f59e0b'
  return '#ef4444'
}

export default function NearbyPanel({ nearbyData, selectedMrt, selectedExit, activeShape, onSelectShape, onBack, apiBase }) {
  const [goBack, setGoBack] = useState('0')
  const [stopArrivals, setStopArrivals] = useState({})
  const [activeStop, setActiveStop] = useState(null)

  const rawStops = nearbyData?.bus_stops || []
  const stopsMap = {}
  for (const s of rawStops) {
    if (!stopsMap[s.stop_name] || s.distance < stopsMap[s.stop_name].distance) {
      stopsMap[s.stop_name] = s
    }
  }
  const busStops = Object.values(stopsMap).sort((a, b) => a.distance - b.distance)

  useEffect(() => {
    setActiveStop(null)
    setStopArrivals({})
  }, [selectedExit])

  useEffect(() => {
    if (!activeStop) return
    const fetch = () => {
      axios.get(`${apiBase}/api/bus/arrivals`, {
        params: { stop_name: activeStop, go_back: goBack }
      }).then(r => {
        setStopArrivals(prev => ({ ...prev, [activeStop]: r.data }))
      }).catch(() => {})
    }
    fetch()
    const id = setInterval(fetch, 1 * 60 * 1000)
    return () => clearInterval(id)
  }, [activeStop, goBack])

  return (
    <div style={{ background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', padding: '14px', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 'calc(100vh - 200px)' }}>
      {/* 標題與返回 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: '#2a2d3a', border: 'none', borderRadius: '6px', color: '#aaa', fontSize: '12px', padding: '4px 8px', cursor: 'pointer' }}>← 返回</button>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
          📍 {selectedMrt.station_name}站 {selectedExit.exit_number || selectedExit.exit_name}
        </div>
      </div>

      {/* 去程/返程切換 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexShrink: 0 }}>
        {['0', '1'].map(dir => (
          <button key={dir} onClick={() => { setGoBack(dir); setStopArrivals({}) }} style={{
            padding: '5px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            background: goBack === dir ? '#60a5fa' : '#2a2d3a',
            color: goBack === dir ? '#000' : '#aaa',
          }}>
            {dir === '0' ? '去程' : '返程'}
          </button>
        ))}
      </div>

      <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '8px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        附近公車站（{busStops.length}）
      </div>

      {/* 可滾動列表 */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {busStops.length === 0 ? (
          <div style={{ color: '#555', fontSize: '12px' }}>載入中...</div>
        ) : (
          busStops.map((stop, i) => {
            const isActive = activeStop === stop.stop_name
            const arrivals = stopArrivals[stop.stop_name] || []
            return (
              <div key={i}
                onClick={() => setActiveStop(isActive ? null : stop.stop_name)}
                style={{
                  background: '#12141e', borderRadius: '8px',
                  border: `1px solid ${isActive ? '#60a5fa' : '#2a2d3a'}`,
                  padding: '8px 12px', marginBottom: '6px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#ddd', fontWeight: 500 }}>{stop.stop_name}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>{stop.distance} 公尺</div>
                </div>

                {isActive && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid #2a2d3a', paddingTop: '8px' }}>
                    {arrivals.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#555' }}>無到站資料</div>
                    ) : (
                      arrivals.map((a, j) => (
                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div>
                            <span
                              onClick={(e) => { e.stopPropagation(); onSelectShape(a.route_id, goBack) }}
                              style={{
                                fontSize: '12px', fontWeight: 700,
                                color: activeShape?.routeName === a.route_id ? '#facc15' : '#60a5fa',
                                cursor: 'pointer', textDecoration: 'underline'
                              }}
                            >
                              {a.route_id} 路
                            </span>
                            {a.destination && (
                              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                                往 {a.destination}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: waitColor(a.estimate_time) }}>
                            {formatWait(a.estimate_time)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
