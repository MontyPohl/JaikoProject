import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import ProfileCard from '../ui/ProfileCard'

// Fix íconos rotos por Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Marcador naranja para roomies
const orangeIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

// Marcador azul para departamentos
const blueIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

function FlyTo({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, 14, { duration: 1 })
  }, [center, map])
  return null
}

/**
 * Valida que lat y lng sean números finitos y en rango válido.
 */
function isValidCoord(lat, lng) {
  return (
    lat != null &&
    lng != null &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

/**
 * Props:
 *  center         – [lat, lng]         (default: Asunción)
 *  markers        – roomie markers [{ lat, lng, profile, compatibility, matches, mismatches }]
 *  listingMarkers – listing markers [{ lat, lng, id, title, price, neighborhood }]
 *  height         – CSS height string  (default: '400px')
 *  flyTo          – [lat, lng] | null
 */
export default function JaikoMap({
  center = [-25.2867, -57.647],
  markers = [],
  listingMarkers = [],
  height = '400px',
  flyTo = null,
}) {
  const navigate = useNavigate()

  // FIX: filtrar coords inválidas antes de renderizar — evita "Invalid LatLng" de Leaflet
  const validRoomieMarkers = markers.filter(
    (m) => m && isValidCoord(m.lat, m.lng) && m.profile
  )
  const validListingMarkers = listingMarkers.filter(
    (m) => m && isValidCoord(m.lat, m.lng)
  )

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height, width: '100%', borderRadius: '16px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {flyTo && <FlyTo center={flyTo} />}

      {/* Marcadores de roomies (naranja) */}
      {validRoomieMarkers.map((m, i) => (
        <Marker key={`roomie-${i}`} position={[m.lat, m.lng]} icon={orangeIcon}>
          <Popup minWidth={240} maxWidth={280}>
            <ProfileCard
              profile={m.profile}
              compatibility={m.compatibility}
              matches={m.matches}
              mismatches={m.mismatches}
            />
          </Popup>
        </Marker>
      ))}

      {/* Marcadores de departamentos (azul) */}
      {validListingMarkers.map((m, i) => (
        <Marker key={`listing-${i}`} position={[m.lat, m.lng]} icon={blueIcon}>
          <Popup>
            <div className="min-w-[180px]">
              <p className="font-bold text-sm text-gray-800 mb-1">{m.title}</p>
              {m.neighborhood && (
                <p className="text-xs text-gray-500 mb-1">📍 {m.neighborhood}</p>
              )}
              {m.price && (
                <p className="text-sm font-semibold text-primary-600 mb-2">
                  ₲ {(m.price / 1_000_000).toFixed(1)}M / mes
                </p>
              )}
              <button
                onClick={() => navigate(`/listings/${m.id}`)}
                className="text-xs bg-primary-500 text-white px-3 py-1 rounded-lg hover:bg-primary-600 transition-colors w-full"
              >
                Ver departamento →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}