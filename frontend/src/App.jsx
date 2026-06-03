import { useState, useEffect } from 'react'
import axios from 'axios'
import TransportMap from './components/Map.jsx'
import NearbyPanel from './components/NearbyPanel.jsx'
import YouBikeChart from './components/YouBikeChart.jsx'
import StatusBar from './components/StatusBar.jsx'

const API = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [status, setStatus] = useState(null)
  const [selectedMrt, setSelectedMrt] = useState(null)
  const [nearbyData, setNearbyData] = useState(null)
  const [selectedYoubike, setSelectedYoubike] = useState(null)
  const [activeShape, setActiveShape] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  useEffect(() => {
    const fetchStatus = () =>
      axios.get(`${API}/api/status`).then(r => setStatus(r.data)).catch(() => {})
    fetchStatus()
    const id = setInterval(fetchStatus, 1 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const handleSelectMrt = async (station) => {
    // 點同一個捷運站 → 取消選取
    if (selectedMrt?.station_name === station.station_name) {
      setSelectedMrt(null)
      setNearbyData(null)
      setSelectedYoubike(null)
      setActiveShape(null)
      return
    }
    setSelectedMrt(station)
    setSelectedYoubike(null)
    setActiveShape(null)
    setNearbyData(null)
    try {
      const res = await axios.get(`${API}/api/nearby`, {
        params: { lat: station.lat, lng: station.lng, radius: 1000 }
      })
      setNearbyData(res.data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
    }
  }

  const handleSelectShape = async (routeName, goBack) => {
    if (activeShape?.routeName === routeName && activeShape?.goBack === goBack) {
      setActiveShape(null)
      return
    }
    try {
      const res = await axios.get(`${API}/api/bus/shape/${routeName}`, { params: { go_back: goBack } })
      setActiveShape({ routeName, goBack, coordinates: res.data.coordinates })
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e0e0e0', fontFamily: '-apple-system, "Noto Sans TC", sans-serif' }}>
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>台北市交通即時儀表板</div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>點選捷運站，查看 1 公里內 YouBike × 公車即時資訊</div>
      </div>

      <div style={{ padding: '10px 20px 0' }}>
        <StatusBar status={status} lastRefresh={lastRefresh} />
      </div>

      <div style={{ display: 'flex', gap: '14px', padding: '10px 20px', height: 'calc(100vh - 110px)' }}>
        {/* Map */}
        <div style={{ flex: '1 1 0', background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', fontSize: '12px', color: '#888', borderBottom: '1px solid #2a2d3a', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#e3002c', transform: 'rotate(45deg)', marginRight: '4px' }}></span>淡水信義線</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#008659', transform: 'rotate(45deg)', marginRight: '4px' }}></span>松山新店線</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#0070bd', transform: 'rotate(45deg)', marginRight: '4px' }}></span>板南線</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#f8a217', transform: 'rotate(45deg)', marginRight: '4px' }}></span>中和新蘆線</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#a05a2c', transform: 'rotate(45deg)', marginRight: '4px' }}></span>文湖線</span>
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
              onSelectMrt={handleSelectMrt}
              nearbyData={nearbyData}
              activeShape={activeShape}
              onSelectYoubike={setSelectedYoubike}
            />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {!selectedMrt ? (
            <div style={{ background: '#1a1d27', borderRadius: '12px', border: '1px solid #2a2d3a', padding: '40px 20px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
              點選地圖上的捷運站<br />查看附近交通資訊
            </div>
          ) : (
            <>
              <NearbyPanel
                nearbyData={nearbyData}
                selectedMrt={selectedMrt}
                activeShape={activeShape}
                onSelectShape={handleSelectShape}
                apiBase={API}
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
