export default function StatusBar({ status, lastRefresh, onRefresh }) {
  const fmt = (d) => d ? new Date(d).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

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
        <button onClick={onRefresh} style={{
          padding: '3px 10px', borderRadius: '6px', border: '1px solid #2a2d3a',
          background: '#2a2d3a', color: '#aaa', fontSize: '11px', cursor: 'pointer',
        }}>
          ↻ 刷新
        </button>
      </span>
    </div>
  )
}
