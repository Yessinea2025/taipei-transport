import { useState, useEffect } from 'react'
import axios from 'axios'
import TransportMap from './components/Map.jsx'
import YouBikeChart from './components/YouBikeChart.jsx'
import AreaSummary from './components/AreaSummary.jsx'
import BusPanel from './components/BusPanel.jsx'
import StatusBar from './components/StatusBar.jsx'

const API = import.meta.env.VITE_API_URL || ''

const styles = {
  app: { minHeight: '100vh', background: '#0f1117', padding: '16px' },
  header: { marginBottom: '20px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' },
  subtitle: { fontSize: '13px', color: '#888', marginTop: '4px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  gridFull: { display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' },
  card: { background: '#1a1d27', borderRadius: '12px', padding: '16px', border: '1px solid #2a2d3a' },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' },
}

export default function App() {
  const [stations, setStations] = useState([])
  const [status, setStatus] = useState(null)
  const [selectedStation, setSelectedStation] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchStations = async () => {
    try {
      const res = await axios.get(`${API}/api/youbike/stations`)
      setStations(res.data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('無法取得站點資料', e)
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API}/api/status`)
      setStatus(res.data)
    } catch (e) {
      console.error('無法取得狀態', e)
    }
  }

  useEffect(() => {
    fetchStations()
    fetchStatus()
    const interval = setInterval(() => {
      fetchStations()
      fetchStatus()
    }, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.title}>台北市交通即時儀表板</div>
        <div style={styles.subtitle}>YouBike 2.0 × 公車到站 × 捷運站點</div>
      </div>

      <StatusBar status={status} lastRefresh={lastRefresh} />

      <div style={{ marginBottom: '16px' }}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>即時地圖 — YouBike 可借車輛 / 捷運站</div>
          <TransportMap
            stations={stations}
            onSelectStation={setSelectedStation}
            apiBase={API}
          />
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            {selectedStation ? `${selectedStation.station_name} — 24小時趨勢` : '點選地圖站點查看趨勢'}
          </div>
          <YouBikeChart stationId={selectedStation?.station_id} apiBase={API} />
        </div>
        <div style={styles.card}>
          <div style={styles.cardTitle}>各行政區 YouBike 可借量</div>
          <AreaSummary apiBase={API} />
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>公車即時到站</div>
        <BusPanel apiBase={API} />
      </div>
    </div>
  )
}
