import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import TransportMap from './components/Map.jsx'
import NearbyPanel from './components/NearbyPanel.jsx'
import YouBikeChart from './components/YouBikeChart.jsx'
import StatusBar from './components/StatusBar.jsx'
import StationSearch from './components/StationSearch.jsx'

const API = import.meta.env.VITE_API_URL || ''
const REFRESH_MS = 60 * 1000

export default function App() {
  const [status, setStatus] = useState(null)
  const [mrtStations, setMrtStations] = useState([])
  const [selectedMrt, setSelectedMrt] = useState(null)
  const [selectedExit, setSelectedExit] = useState(null)
  const [exits, setExits] = useState([])
  const [nearbyData, setNearbyData] = useState(null)
  const [selectedYoubike, setSelectedYoubike] = useState(null)
  const [activeShape, setActiveShape] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [refreshTick, setRefreshTick] = useState(0)

  const selectedExitRef = { current: null }

  const fetchStatus = useCallback(() => {
    axios.get(`${API}/api/status`).then(r => setStatus(r.data)).catch(() => {})
  }, [])

  const fetchNearby = useCallback(async (exit) => {
    if (!exit) return
    try {
      const res = await axios.get(`${API}/api/nearby`, {
        params: { lat: exit.lat, lng: exit.lng, radius: 1000 }
      })
      setNearbyData(res.data)
      setLastRefresh(new Date())
    } catch (e) {}
  }, [])

  // 每分鐘自動刷新
  useEffect(() => {
    axios.get(`${API}/api/mrt/stations`).then(r => setMrtStations(r.data)).catch(() => {})
    fetchStatus()
    const id = setInterval(() => {
      fetchStatus()
      setRefreshTick(t => t + 1)
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  // refreshTick 變動時，重新抓 nearby 資料（更新 YouBike）
  useEffect(() => {
    if (refreshTick === 0 || !selectedExit) return
    fetchNearby(selectedExit)
  }, [refreshTick])

  const handleRefresh = () => {
    fetchStatus()
    if (selectedExit) fetchNearby(selectedExit)
    setRefreshTick(t => t + 1)
  }

  const handleSelectMrt = async (station) => {
    if (selectedMrt?.station_name === station.station_name) {
      setSelectedMrt(null)
      setExits([])
      setSelectedExit(null)
      setNearbyData(null)
      setSelectedYoubike(null)
      setActiveShape(null)
      return
    }
    setSelectedMrt(station)
    setSelectedExit(null)
    setNearbyData(null)
    setSelectedYoubike(null)
    setActiveShape(null)
    try {
      const res = await axios.get(`${API}/api/mrt/exits`, {
        params: { station_name: station.station_name }
      })
      setExits(res.data)
    } catch (e) {
      setExits([])
    }
  }

  const handleSelectExit = async (exit) => {
    if (selectedExit?.exit_name === exit.exit_name) {
      setSelectedExit(null)
      setNearbyData(null)
      return
    }
    setSelectedExit(exit)
    setNearbyData(null)
    setSelectedYoubike(null)
    setActiveShape(null)
    fetchNearby(exit)
  }
  const handleSelectShape = async (routeName, goBack) => {
    if (activeShape?.routeName === routeName && activeShape?.goBack === goBack) {
      setActiveShape(null)
      return
    }
    try {
      const res = await axios.get(`${API}/api/bus/shape/${routeName}`, { params: { go_back: goBack } })
      setActiveShape({ routeName, goBack, coordinates: res.data.coordinates })
    } catch (e) {}
  }

  const lineColors = [
    { color: '#e3002c', label: '淡水信義線' },
    { color: '#008659', label: '松山新店線' },
    { color: '#0070bd', label: '板南線' },
    { color: '#f8a217', label: '中和新蘆線' },
    { color: '#a05a2c', label: '文湖線' },
    { color: '#ffd700', label: '環狀線' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e0e0e0', fontFamily: '-apple-system, "Noto Sans TC", sans-serif' }}>
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>台北市捷運出口即時交通儀表板</div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>點選捷運站 → 選擇出口 → 查看 1 公里內 YouBike × 公車即時資訊</div>
      </div>
      <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1000 }}>
        <StationSearch stations={mrtStations} onSelect={handleSelectMrt} />
        <div style={{ flex: 1 }}>
          <StatusBar lastRefresh={lastRefresh} onRefresh={handleRefresh} />
        </div>
      </div>
      </div>
      <div style={{ display: 'flex', gap: '14px', padding: '10px 20px', height: 'calc(100vh - 110px)' }}>
        <div style={{ flex: '1 1 0', background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', fontSize: '12px', color: '#888', borderBottom: '1px solid #2a2d3a', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {lineColors.map(l => (
              <span key={l.label}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: l.color, transform: 'rotate(45deg)', marginRight: '4px' }}></span>
                {l.label}
              </span>
            ))}
            <span style={{ marginLeft: 'auto' }}>
              <span style={{ color: '#22c55e' }}>●</span> YouBike 充足 &nbsp;
              <span style={{ color: '#f59e0b' }}>●</span> 一般 &nbsp;
              <span style={{ color: '#ef4444' }}>●</span> 不足
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <TransportMap
              apiBase={API}
              selectedMrt={selectedMrt}
              selectedExit={selectedExit}
              exits={exits}
              onSelectMrt={handleSelectMrt}
              onSelectExit={handleSelectExit}
              nearbyData={nearbyData}
              activeShape={activeShape}
              onSelectYoubike={(s) => setSelectedYoubike(prev => prev?.station_id === s.station_id ? null : s)}
            />
          </div>
        </div>

        <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {!selectedMrt ? (
            <div style={{ background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', padding: '40px 20px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
              點選地圖上的捷運站<br />查看附近交通資訊
            </div>
          ) : !selectedExit ? (
            <div style={{ background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', padding: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                🚉 {selectedMrt.station_name}站
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>請選擇出口：</div>
              {exits.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#555' }}>無出口資料</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {exits.map((e, i) => (
                    <button key={i} onClick={() => handleSelectExit(e)} style={{
                      padding: '6px 14px', borderRadius: '8px', border: '1px solid #2a2d3a',
                      background: '#12141e', color: '#ddd', fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                    }}>
                      {e.exit_number || e.exit_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <NearbyPanel
                nearbyData={nearbyData}
                selectedMrt={selectedMrt}
                selectedExit={selectedExit}
                activeShape={activeShape}
                onSelectShape={handleSelectShape}
                onBack={() => { setSelectedExit(null); setNearbyData(null); setActiveShape(null); setSelectedYoubike(null) }}
                apiBase={API}
                refreshTick={refreshTick}
              />
              {selectedYoubike && (
                <div style={{ background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', padding: '14px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px', fontWeight: 600 }}>
                    {selectedYoubike.station_name.replace('YouBike2.0_', '')} — 24小時趨勢
                  </div>
                  <YouBikeChart stationId={selectedYoubike.station_id} apiBase={API} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
