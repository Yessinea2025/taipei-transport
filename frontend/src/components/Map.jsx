import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Circle, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import axios from 'axios'

function MapController({ selectedMrt }) {
  const map = useMap()
  useEffect(() => {
    if (selectedMrt) {
      map.flyTo([selectedMrt.lat, selectedMrt.lng], 15, { duration: 1 })
    } else {
      map.flyTo([25.045, 121.525], 13, { duration: 1 })
    }
  }, [selectedMrt])
  return null
}

function getBikeColor(rate) {
  if (rate >= 50) return '#22c55e'
  if (rate >= 20) return '#f59e0b'
  return '#ef4444'
}

// 捷運站用方形圖示
function makeSquareIcon(color, isSelected) {
  const size = isSelected ? 14 : 10
  const border = isSelected ? `3px solid #fff` : `2px solid ${color}`
  return new L.DivIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:${border};border-radius:2px;transform:rotate(45deg);"></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    className: '',
  })
}

export default function TransportMap({ apiBase, selectedMrt, onSelectMrt, nearbyData, activeShape, onSelectYoubike }) {
  const [mrtStations, setMrtStations] = useState([])

  useEffect(() => {
    axios.get(`${apiBase}/api/mrt/stations`).then(r => setMrtStations(r.data)).catch(() => {})
  }, [])

  return (
    <MapContainer center={[25.045, 121.525]} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; CARTO'
      />
      <MapController selectedMrt={selectedMrt} />

      {/* 捷運站 — 方形鑽石圖示 */}
      {mrtStations.map((s, i) => (
        <Marker
          key={i}
          position={[s.lat, s.lng]}
          icon={makeSquareIcon(s.line_color, selectedMrt?.station_name === s.station_name)}
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

      {/* 1公里範圍圈 */}
      {selectedMrt && (
        <Circle
          center={[selectedMrt.lat, selectedMrt.lng]}
          radius={1000}
          pathOptions={{ color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.04, weight: 1, dashArray: '6 4' }}
        />
      )}

      {/* 附近 YouBike 站 — 圓形 */}
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
    </MapContainer>
  )
}
