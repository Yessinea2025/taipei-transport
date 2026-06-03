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

export default function NearbyPanel({ nearbyData, selectedMrt, activeShape, onSelectShape, apiBase }) {
  const [goBack, setGoBack] = useState('0')
  const [busArrivals, setBusArrivals] = useState([])
  const [activeStop, setActiveStop] = useState(null)

  const busStops = nearbyData?.bus_stops || []
  const youbike = nearbyData?.youbike || []

  useEffect(() => {
    if (!activeStop) return
    const fetch = () => {
      axios.get(`${apiBase}/api/bus/arrivals`, {
        params: { stop_name: activeStop.stop_name, go_back: goBack }
      }).then(r => setBusArrivals(r.data)).catch(() => {})
    }
    fetch()
    const id = setInterval(fetch, 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [activeStop, goBack])

  const s = { card: { background: '#12141e', borderRadius: '8px', border: '1px solid #2a2d3a', marginBottom: '8px' } }

  return (
    <div style={{ background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', padding: '14px', flex: 1 }}>
      {/* 捷運站標題 */}
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
        📍 {selectedMrt.station_name}站 附近 1 公里
      </div>

      {/* YouBike 區塊 */}
      <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        YouBike 站點（{youbike.length}）
      </div>
      {youbike.length === 0 ? (
        <div style={{ color: '#555', fontSize: '12px', marginBottom: '14px' }}>附近無 YouBike 站</div>
      ) : (
        <div style={{ marginBottom: '14px' }}>
          {youbike.slice(0, 5).map(s => {
            const rate = s.total_spaces > 0 ? Math.round(s.available_bikes / s.total_spaces * 100) : 0
            const color = rate >= 50 ? '#22c55e' : rate >= 20 ? '#f59e0b' : '#ef4444'
            return (
              <div key={s.station_id} style={{ background: '#12141e', borderRadius: '8px', border: '1px solid #2a2d3a', padding: '8px 12px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#ddd' }}>{s.station_name.replace('YouBike2.0_', '')}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{s.distance} 公尺</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color }}>{s.available_bikes ?? '-'} 台</div>
                  <div style={{ fontSize: '10px', color: '#555' }}>可借 / {s.available_spaces ?? '-'} 格可還</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 公車區塊 */}
      <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        附近公車站（{busStops.length}）
      </div>

      {busStops.length === 0 ? (
        <div style={{ color: '#555', fontSize: '12px' }}>附近無公車站資料</div>
      ) : (
        <>
          {/* 去程/返程切換 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['0', '1'].map(dir => (
              <button key={dir} onClick={() => setGoBack(dir)} style={{
                padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                background: goBack === dir ? '#60a5fa' : '#2a2d3a',
                color: goBack === dir ? '#000' : '#aaa',
              }}>
                {dir === '0' ? '去程' : '返程'}
              </button>
            ))}
          </div>

          {/* 公車站列表 */}
          {busStops.slice(0, 6).map((stop, i) => (
            <div key={i}
              onClick={() => setActiveStop(activeStop?.stop_name === stop.stop_name ? null : stop)}
              style={{
                background: '#12141e', borderRadius: '8px',
                border: `1px solid ${activeStop?.stop_name === stop.stop_name ? '#60a5fa' : '#2a2d3a'}`,
                padding: '8px 12px', marginBottom: '6px', cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: '#ddd' }}>{stop.stop_name}</div>
                <div style={{ fontSize: '11px', color: '#555' }}>{stop.distance} 公尺</div>
              </div>

              {/* 展開：該站到站時間 */}
              {activeStop?.stop_name === stop.stop_name && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #2a2d3a', paddingTop: '8px' }}>
                  {busArrivals.length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#555' }}>無到站資料</div>
                  ) : (
                    busArrivals.map((a, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            onClick={(e) => { e.stopPropagation(); onSelectShape(a.route_id, goBack) }}
                            style={{
                              fontSize: '11px', fontWeight: 700, color: activeShape?.routeName === a.route_id ? '#facc15' : '#60a5fa',
                              cursor: 'pointer', textDecoration: 'underline'
                            }}
                          >
                            {a.route_id} 路
                          </span>
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
          ))}
        </>
      )}
    </div>
  )
}
