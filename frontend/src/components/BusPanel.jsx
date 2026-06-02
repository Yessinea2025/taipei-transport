import { useEffect, useState } from 'react'
import axios from 'axios'

const ROUTES = ['0東', '1', '2', '3', '5', '15', '20', '22', '30', '37', '52', '74', '111', '204', '208', '214', '253', '295']

function formatWait(seconds) {
  if (seconds < 0) return '未發車'
  if (seconds < 60) return '進站中'
  const mins = Math.round(seconds / 60)
  return `${mins} 分鐘`
}

function waitColor(seconds) {
  if (seconds < 0) return '#555'
  if (seconds < 120) return '#22c55e'
  if (seconds < 300) return '#f59e0b'
  return '#ef4444'
}

export default function BusPanel({ apiBase }) {
  const [selected, setSelected] = useState('1')
  const [arrivals, setArrivals] = useState([])
  const [loading, setLoading] = useState(false)

  const fetch = (route) => {
    setLoading(true)
    axios.get(`${apiBase}/api/bus/arrivals?route_id=${route}`)
      .then(r => setArrivals(r.data))
      .catch(() => setArrivals([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch(selected)
    const id = setInterval(() => fetch(selected), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [selected])

  const btnStyle = (r) => ({
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    background: selected === r ? '#22c55e' : '#2a2d3a',
    color: selected === r ? '#000' : '#aaa',
    transition: 'all 0.15s',
  })

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
        {ROUTES.map(r => (
          <button key={r} style={btnStyle(r)} onClick={() => setSelected(r)}>
            {r} 路
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: '13px', padding: '20px 0' }}>載入中...</div>
      ) : arrivals.length === 0 ? (
        <div style={{ color: '#555', fontSize: '13px', padding: '20px 0' }}>目前無到站資料</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
          {arrivals.slice(0, 24).map((a, i) => (
            <div key={i} style={{
              background: '#12141e',
              borderRadius: '8px',
              padding: '10px 12px',
              border: '1px solid #2a2d3a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '13px', color: '#ddd', fontWeight: 500 }}>{a.stop_name}</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{a.plate_numb || '—'}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: waitColor(a.estimate_time) }}>
                {formatWait(a.estimate_time)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
