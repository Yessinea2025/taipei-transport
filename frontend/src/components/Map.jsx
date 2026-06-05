import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Circle, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import axios from 'axios'

function MapController({ selectedMrt, selectedExit }) {
  const map = useMap()
  useEffect(() => {
    if (selectedExit) {
      map.flyTo([selectedExit.lat, selectedExit.lng], 16, { duration: 1 })
    } else if (selectedMrt) {
      map.flyTo([selectedMrt.lat, selectedMrt.lng], 15, { duration: 1 })
    } else {
      map.flyTo([25.045, 121.525], 13, { duration: 1 })
    }
  }, [selectedMrt, selectedExit])
  return null
}

function getBikeColor(rate) {
  if (rate >= 50) return '#22c55e'
  if (rate >= 20) return '#f59e0b'
  return '#ef4444'
}

function makeSquareIcon(colors, isSelected) {
  const size = isSelected ? 14 : 10
  if (colors.length === 1) {
    const border = isSelected ? `3px solid #fff` : `2px solid ${colors[0]}`
    return new L.DivIcon({
      html: `<div style="width:${size}px;height:${size}px;background:${colors[0]};border:${border};border-radius:2px;transform:rotate(45deg);"></div>`,
      iconSize: [size + 6, size + 6],
      iconAnchor: [(size + 6) / 2, (size + 6) / 2],
      className: '',
    })
  }
  const [c1, c2] = colors
  return new L.DivIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:2px;transform:rotate(45deg);overflow:hidden;border:${isSelected ? '3px solid #fff' : '2px solid #fff'};display:flex;">
      <div style="flex:1;background:${c1};"></div>
      <div style="flex:1;background:${c2};"></div>
    </div>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
    className: '',
  })
}

function makeExitIcon(exitNumber, isSelected) {
  const label = exitNumber || '?'
  const bg = isSelected ? '#facc15' : '#1a1d27'
  const border = isSelected ? '#facc15' : '#aaa'
  const color = isSelected ? '#000' : '#fff'
  return new L.DivIcon({
    html: `<div style="
      min-width:22px;height:22px;padding:0 4px;
      background:${bg};border-radius:11px;border:2px solid ${border};
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;color:${color};
      white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.5);
    ">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    className: '',
  })
}

export default function TransportMap({ apiBase, selectedMrt, selectedExit, exits, onSelectMrt, onSelectExit, nearbyData, activeShape, onSelectYoubike }) {
  const [mrtStations, setMrtStations] = useState([])
  const [routeStops, setRouteStops] = useState([])

  useEffect(() => {
    axios.get(`${apiBase}/api/mrt/stations`).then(r => setMrtStations(r.data)).catch(() => {})
  }, [])

  // 點了路線後抓站點
  useEffect(() => {
    if (!activeShape?.routeName) {
      setRouteStops([])
      return
    }
    // 立刻清空舊站點，避免延遲殘留
    setRouteStops([])
    axios.get(`${apiBase}/api/bus/stops/${encodeURIComponent(activeShape.routeName)}`, {
      params: { go_back: activeShape.goBack }
    }).then(r => setRouteStops(r.data)).catch(() => setRouteStops([]))
  }, [activeShape?.routeName, activeShape?.goBack])

  return (
    <MapContainer center={[25.045, 121.525]} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
      <MapController selectedMrt={selectedMrt} selectedExit={selectedExit} />

      {/* 捷運站 */}
      {mrtStations.map((s, i) => (
        <Marker
          key={i}
          position={[s.lat, s.lng]}
          icon={makeSquareIcon(s.colors, selectedMrt?.station_name === s.station_name)}
          eventHandlers={{ click: () => onSelectMrt(s) }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
            <div style={{ fontSize: '12px' }}>
              <strong>{s.station_name}站</strong><br />
              <span style={{ color: '#aaa' }}>{s.line}</span>
            </div>
          </Tooltip>
        </Marker>
      ))}

      {/* 出口標記 */}
      {exits.map((e, i) => (
        <Marker
          key={`exit-${i}`}
          position={[e.lat, e.lng]}
          icon={makeExitIcon(e.exit_number, selectedExit?.exit_name === e.exit_name)}
          eventHandlers={{ click: () => onSelectExit(e) }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
            <div style={{ fontSize: '12px' }}>
              <strong>{e.exit_name}</strong>
            </div>
          </Tooltip>
        </Marker>
      ))}

      {/* 1公里範圍圈 */}
      {selectedExit && (
        <Circle
          center={[selectedExit.lat, selectedExit.lng]}
          radius={1000}
          pathOptions={{ color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.04, weight: 1, dashArray: '6 4' }}
        />
      )}

      {/* 附近 YouBike */}
      {(nearbyData?.youbike || []).map(s => {
        const rate = s.total_spaces > 0 ? (s.available_bikes / s.total_spaces) * 100 : 0
        const color = getBikeColor(rate)
        return (
          <CircleMarker
            key={s.station_id}
            center={[s.lat, s.lng]}
            radius={Math.max(5, Math.min(12, (s.available_bikes || 0) / 3))}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1.5 }}
            eventHandlers={{ click: () => onSelectYoubike(s) }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                <strong>{s.station_name}</strong><br />
                可借：{s.available_bikes ?? '-'} 台 ／ 可還：{s.available_spaces ?? '-'} 格<br />
                距離：{s.distance} 公尺
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}

      {/* 路線軌跡 */}
      {activeShape?.coordinates?.length > 0 && (
        <Polyline
          positions={activeShape.coordinates}
          pathOptions={{ color: '#facc15', weight: 4, opacity: 0.9 }}
        />
      )}

      {/* 路線站點 */}
      {routeStops.map((s, i) => (
        <CircleMarker
          key={`rs-${i}`}
          center={[s.lat, s.lng]}
          radius={5}
          pathOptions={{ color: '#facc15', fillColor: '#1a1d27', fillOpacity: 1, weight: 2 }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
            <div style={{ fontSize: '12px' }}>
              <strong>{s.stop_name}</strong>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
