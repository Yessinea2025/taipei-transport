import { useState } from 'react'

export default function StatusBar({ status, lastRefresh, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false)
  const fmt = (d) => d ? new Date(d).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

  const handleRefresh = () => {
    setRefreshing(true)
    onRefresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  return (
    <div style={{
      display: 'flex', gap: '20px', marginBottom: '10px',
      padding: '8px 14px', background: '#1a1d27',
      borderRadius: '10px', border: '1px solid #2a2d3a',
      fontSize: '12px', color: '#666', flexWrap: 'wrap', alignItems: 'center',
    }}>
      <span>
        <span style={{ color: '#22c55e', marginRight: '6px' }}>●</span>
        即時更新中（每1分鐘）
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        最後更新：<strong style={{ color: '#aaa' }}>{fmt(lastRefresh)}</strong>
        <button onClick={handleRefresh} style={{
          padding: '3px 10px', borderRadius: '6px', border: '1px solid #2a2d3a',
          background: refreshing ? '#22c55e' : '#2a2d3a',
          color: refreshing ? '#000' : '#aaa',
          fontSize: '11px', cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          {refreshing ? '✓ 已刷新' : '↻ 刷新'}
        </button>
      </span>
    </div>
  )
}
