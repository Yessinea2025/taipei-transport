export default function StatusBar({ status, lastRefresh }) {
  const fmt = (d) => d ? new Date(d).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

  return (
    <div style={{
      display: 'flex',
      gap: '20px',
      marginBottom: '16px',
      padding: '10px 14px',
      background: '#1a1d27',
      borderRadius: '10px',
      border: '1px solid #2a2d3a',
      fontSize: '12px',
      color: '#666',
      flexWrap: 'wrap',
    }}>
      <span>
        <span style={{ color: '#22c55e', marginRight: '6px' }}>●</span>
        即時更新中（每1分鐘）
      </span>
      <span>YouBike 快照：<strong style={{ color: '#aaa' }}>{status?.youbike_recent_records ?? '—'}</strong> 筆</span>
      <span>公車資料：<strong style={{ color: '#aaa' }}>{status?.bus_recent_records ?? '—'}</strong> 筆</span>
      <span style={{ marginLeft: 'auto' }}>前端最後刷新：<strong style={{ color: '#aaa' }}>{fmt(lastRefresh)}</strong></span>
    </div>
  )
}
