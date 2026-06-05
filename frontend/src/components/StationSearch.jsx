import { useState, useRef, useEffect } from 'react'

export default function StationSearch({ stations, onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // 交叉站對應的所有路線
  const TRANSFER_LINES = {
    "台北車站":   [{ line: "淡水信義線", color: "#e3002c" }, { line: "板南線", color: "#0070bd" }],
    "忠孝新生":   [{ line: "板南線", color: "#0070bd" }, { line: "中和新蘆線", color: "#f8a217" }],
    "忠孝復興":   [{ line: "板南線", color: "#0070bd" }, { line: "文湖線", color: "#a05a2c" }],
    "南京復興":   [{ line: "松山新店線", color: "#008659" }, { line: "文湖線", color: "#a05a2c" }],
    "古亭":       [{ line: "松山新店線", color: "#008659" }, { line: "中和新蘆線", color: "#f8a217" }],
    "民權西路":   [{ line: "淡水信義線", color: "#e3002c" }, { line: "中和新蘆線", color: "#f8a217" }],
    "大安":       [{ line: "淡水信義線", color: "#e3002c" }, { line: "文湖線", color: "#a05a2c" }],
    "東門":       [{ line: "淡水信義線", color: "#e3002c" }, { line: "中和新蘆線", color: "#f8a217" }],
    "中正紀念堂": [{ line: "淡水信義線", color: "#e3002c" }, { line: "松山新店線", color: "#008659" }],
    "南港展覽館": [{ line: "板南線", color: "#0070bd" }, { line: "文湖線", color: "#a05a2c" }],
    "中山":       [{ line: "淡水信義線", color: "#e3002c" }, { line: "松山新店線", color: "#008659" }],
    "松江南京":   [{ line: "松山新店線", color: "#008659" }, { line: "中和新蘆線", color: "#f8a217" }],
    "西門":       [{ line: "板南線", color: "#0070bd" }, { line: "松山新店線", color: "#008659" }],
    "頭前庄":     [{ line: "環狀線", color: "#ffd700" }, { line: "中和新蘆線", color: "#f8a217" }],
    "景安":       [{ line: "環狀線", color: "#ffd700" }, { line: "中和新蘆線", color: "#f8a217" }],
    "大坪林":     [{ line: "環狀線", color: "#ffd700" }, { line: "松山新店線", color: "#008659" }],
  }

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setHighlighted(-1)
    if (!val.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const seen = new Set()
    const matched = stations.filter(s => {
      if (s.station_name.includes(val) && !seen.has(s.station_name)) {
        seen.add(s.station_name)
        return true
      }
      return false
    }).slice(0, 8)
    setSuggestions(matched)
    setShowSuggestions(matched.length > 0)
  }

  const handleSelect = (station) => {
    setQuery(station.station_name)
    setShowSuggestions(false)
    setSuggestions([])
    onSelect(station)
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (highlighted >= 0) handleSelect(suggestions[highlighted])
      else if (suggestions.length > 0) handleSelect(suggestions[0])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const renderColorDot = (stationName, lineColor) => {
    const transfer = TRANSFER_LINES[stationName]
    if (transfer) {
      return (
        <div style={{ display: 'flex', width: '10px', height: '10px', borderRadius: '1px', transform: 'rotate(45deg)', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ flex: 1, background: transfer[0].color }}></div>
          <div style={{ flex: 1, background: transfer[1].color }}></div>
        </div>
      )
    }
    return (
      <div style={{ width: '10px', height: '10px', borderRadius: '1px', transform: 'rotate(45deg)', background: lineColor, flexShrink: 0 }}></div>
    )
  }

  const getLineLabel = (stationName, line) => {
    const transfer = TRANSFER_LINES[stationName]
    if (transfer) return transfer.map(t => t.line).join(' / ')
    return line
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '220px', zIndex: 1000 }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        padding: '5px 10px', gap: '6px',
      }}>
        <i className="ti ti-search" style={{ fontSize: '14px', color: 'var(--color-text-tertiary)' }} aria-hidden="true"></i>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="搜尋捷運站..."
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--color-text-primary)', fontSize: '12px', width: '100%',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false) }}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', fontSize: '12px', padding: 0 }}>
            ✕
          </button>
        )}
      </div>

      {showSuggestions && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: '#1a1d27',
          border: '1px solid #2a2d3a',
          borderRadius: '8px',
          marginTop: '4px', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                background: highlighted === i ? '#2a2d3a' : '#1a1d27',
                color: highlighted === i ? '#fff' : '#ccc',
                display: 'flex', alignItems: 'center', gap: '8px',
                borderBottom: i < suggestions.length - 1 ? '1px solid #2a2d3a' : 'none',
              }}
            >
              {renderColorDot(s.station_name, s.line_color)}
              <span>{s.station_name}站</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {getLineLabel(s.station_name, s.line)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
