import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Circle, Tooltip, useMap } from 'react-leaflet'
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

export default function TransportMap({ apiBase, selectedMrt, onSelectMrt, nearbyData, activeShape, onSelectYoubike }) {
  const [mrtStations, setMrtStations] = useState([])

  useEffect(() => {
    axios.get(`${apiBase}/api/mrt/stations`).then(r => setMrtStations(r.data)).catch(() => {})
  }, [])

  const nearbyIds = new Set((nearbyData?.youbike || []).map(s => s.station_id))

  return (
    <MapContainer center={[25.045, 121.525]} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; CARTO'
      />
      <MapController selectedMrt={selectedMrt} />

      {/* 捷運站 */}
      {mrtStations.map((s, i) => (
        <CircleMarker
          key={i}
          center={[s.lat, s.lng]}
          radius={7}
          pathOptions={{
            color: s.line_color,
            fillColor: selectedMrt?.station_name === s.station_name ? '#fff' : s.line_color,
            fillOpacity: selectedMrt?.station_name === s.station_name ? 1 : 0.85,
            weight: selectedMrt?.station_name === s.station_name ? 3 : 1.5,
          }}
          eventHandlers={{ click: () => onSelectMrt(s) }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
            <div style={{ fontSize: '12px' }}>
              <strong>{s.station_name}站</strong><br />
              <span style={{ color: '#aaa' }}>{s.line}</span>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* 1公里範圍圈 */}
      {selectedMrt && (
        <Circle
          center={[selectedMrt.lat, selectedMrt.lng]}
          radius={1000}
          pathOptions={{ color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.04, weight: 1, dashArray: '6 4' }}
        />
      )}

      {/* 附近 YouBike 站 */}
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
