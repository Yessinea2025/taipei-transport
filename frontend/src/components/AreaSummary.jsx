import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const COLORS = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
                '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#f0fdf4']

export default function AreaSummary({ apiBase }) {
  const [data, setData] = useState([])

  useEffect(() => {
    axios.get(`${apiBase}/api/youbike/area-summary`)
      .then(r => setData(r.data.slice(0, 10)))
      .catch(() => {})

    const id = setInterval(() => {
      axios.get(`${apiBase}/api/youbike/area-summary`)
        .then(r => setData(r.data.slice(0, 10)))
        .catch(() => {})
    }, 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (data.length === 0) return (
    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '13px' }}>
      載入中...
    </div>
  )

  const formatted = data.map(d => ({
    ...d,
    area: d.area?.replace('區', '') || '未知',
    rate: d.total_capacity > 0 ? Math.round(d.total_available / d.total_capacity * 100) : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis dataKey="area" tick={{ fontSize: 11, fill: '#666' }} />
        <YAxis tick={{ fontSize: 11, fill: '#666' }} />
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', fontSize: '12px' }}
          labelStyle={{ color: '#aaa' }}
          formatter={(v, name) => [v, name === 'total_available' ? '可借車輛' : name]}
        />
        <Bar dataKey="total_available" name="可借車輛" radius={[4, 4, 0, 0]}>
          {formatted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
