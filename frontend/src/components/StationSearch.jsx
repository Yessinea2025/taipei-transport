import { useState, useRef, useEffect } from 'react'

export default function StationSearch({ stations, onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

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
    // 去重：同站名只保留一個
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
      if (highlighted >= 0) {
        handleSelect(suggestions[highlighted])
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '220px' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#12141e', border: '1px solid #2a2d3a', borderRadius: '8px', padding: '5px 10px', gap: '6px' }}>
        <span style={{ color: '#555', fontSize: '13px' }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="搜尋捷運站..."
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#ddd', fontSize: '12px', width: '100%',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false) }}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', padding: 0 }}>
            ✕
          </button>
        )}
      </div>

      {showSuggestions && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px',
          marginTop: '4px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                background: highlighted === i ? '#2a2d3a' : 'transparent',
                color: highlighted === i ? '#fff' : '#ccc',
                display: 'flex', alignItems: 'center', gap: '8px',
                borderBottom: i < suggestions.length - 1 ? '1px solid #2a2d3a' : 'none',
              }}
            >
              <span style={{ display: 'inline-block', width: '10px', height: '10px', background: s.line_color, borderRadius: '2px', transform: 'rotate(45deg)', flexShrink: 0 }}></span>
              <span>{s.station_name}站</span>
              <span style={{ color: '#555', fontSize: '11px', marginLeft: 'auto' }}>{s.line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
