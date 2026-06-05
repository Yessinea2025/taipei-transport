import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

export default function YouBikeChart({ stationId, apiBase }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!stationId) return
    setLoading(true)
    axios.get(`${apiBase}/api/youbike/trend/${stationId}?hours=24`)
      .then(r => {
        const formatted = r.data.map(d => ({
          ...d,
          time: new Date(d.time_bucket + 'Z').toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }),
          avg_bikes: Number(d.avg_bikes),
          avg_spaces: Number(d.avg_spaces),
        }))
        setData(formatted)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [stationId])

  if (!stationId) return (
    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '13px' }}>
      點選地圖上的站點查看趨勢
    </div>
  )

  if (loading) return (
    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '13px' }}>
      載入中...
    </div>
  )

  if (data.length === 0) return (
    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '13px' }}>
      資料累積中，請稍後再試
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#666' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#666' }} />
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', fontSize: '12px' }}
          labelStyle={{ color: '#aaa' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
        <Line type="monotone" dataKey="avg_bikes" name="可借車輛" stroke="#22c55e" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="avg_spaces" name="可還車格" stroke="#60a5fa" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
