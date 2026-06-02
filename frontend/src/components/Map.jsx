import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import axios from 'axios'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpökg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const mrtIcon = new L.DivIcon({
  html: `<div style="background:#a855f7;width:14px;height:14px;border-radius:50%;border:2px solid #fff;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
})

function getBikeColor(rate) {
  if (rate === null || rate === undefined) return '#555'
  if (rate >= 60) return '#22c55e'
  if (rate >= 30) return '#f59e0b'
  return '#ef4444'
}

export default function TransportMap({ stations, onSelectStation, apiBase }) {
  const [mrtStations, setMrtStations] = useState([])

  useEffect(() => {
    axios.get(`${apiBase}/api/mrt/stations`).then(r => setMrtStations(r.data)).catch(() => {})
  }, [])

  return (
    <div style={{ height: '420px', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        center={[25.033, 121.535]}
        zoom={13}
        style={{ height: '100%', width: '100%', background: '#1a1d27' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {stations.map(s => {
          const rate = s.total_spaces > 0
            ? Math.round((s.available_bikes / s.total_spaces) * 100)
            : 0
          const color = getBikeColor(rate)
          const radius = Math.max(5, Math.min(14, (s.available_bikes || 0) / 3))
          return (
            <CircleMarker
              key={s.station_id}
              center={[s.lat, s.lng]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 1 }}
              eventHandlers={{ click: () => onSelectStation(s) }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                  <strong>{s.station_name}</strong><br />
                  可借：{s.available_bikes ?? '-'} 台<br />
                  可還：{s.available_spaces ?? '-'} 格<br />
                  可借率：{rate}%
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}

        {mrtStations.map((s, i) => (
          <Marker key={i} position={[s.lat, s.lng]} icon={mrtIcon}>
            <Popup>
              <div style={{ fontSize: '12px' }}>
                <strong>{s.station_name}</strong><br />
                {s.line}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: '#888' }}>
        <span><span style={{ color: '#22c55e' }}>●</span> 可借率 ≥60%</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> 30–60%</span>
        <span><span style={{ color: '#ef4444' }}>●</span> &lt;30%</span>
        <span><span style={{ color: '#a855f7' }}>●</span> 捷運站</span>
        <span style={{ marginLeft: 'auto' }}>圓圈大小 = 可借車輛數</span>
      </div>
    </div>
  )
}
