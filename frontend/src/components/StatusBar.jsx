import { useState } from 'react'

export default function StatusBar({ lastRefresh, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false)
  const fmt = (d) => d ? new Date(d).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

  const handleRefresh = () => {
    setRefreshing(true)
    onRefresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      gap: '10px', marginBottom: '10px', padding: '6px 14px',
      background: '#1a1d27', borderRadius: '10px', border: '1px solid #2a2d3a',
      fontSize: '12px', color: '#666',
    }}>
      <span style={{ color: '#555' }}>最後更新</span>
      <strong style={{ color: '#aaa' }}>{fmt(lastRefresh)}</strong>
      <button onClick={handleRefresh} style={{
        padding: '3px 10px', borderRadius: '6px', border: '1px solid #2a2d3a',
        background: refreshing ? '#22c55e' : '#2a2d3a',
        color: refreshing ? '#000' : '#aaa',
        fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s',
      }}>
        {refreshing ? '✓ 已刷新' : '↻ 刷新'}
      </button>
    </div>
  )
}
