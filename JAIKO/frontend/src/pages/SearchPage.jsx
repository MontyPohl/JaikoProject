import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, X, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import ProfileCard from '../components/ui/ProfileCard'
import { Spinner, EmptyState } from '../components/ui'
import { toast } from 'react-hot-toast'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// FIX íconos Leaflet con Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SCHEDULES = ['morning', 'afternoon', 'night', 'flexible']
const SCHEDULE_LABELS = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  night: 'Noche',
  flexible: 'Flexible',
}
const CITIES = [
  'Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora',
  'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este',
]
const CITY_CENTERS = {
  'Asunción': [-25.2867, -57.647],
  'San Lorenzo': [-25.3355, -57.5178],
  'Luque': [-25.2635, -57.4857],
  'Fernando de la Mora': [-25.3085, -57.5225],
  'Lambaré': [-25.3404, -57.6075],
  'Capiatá': [-25.356, -57.4455],
  'Encarnación': [-27.3333, -55.8667],
  'Ciudad del Este': [-25.5097, -54.611],
}

export default function SearchPage() {
  const navigate = useNavigate()

  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const [filters, setFilters] = useState({
    city: 'Asunción',
    pets: '',      // "" | "true" | "false"
    smoker: '',    // "" | "true" | "false"
    schedule: '',  // "" | "morning" | ...
    min_age: '',
    max_age: '',
  })

  const fetchProfiles = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, per_page: 20, city: filters.city })

      if (filters.min_age) params.append('min_age', filters.min_age)
      if (filters.max_age) params.append('max_age', filters.max_age)
      if (filters.pets !== '') params.append('pets', filters.pets)
      if (filters.smoker !== '') params.append('smoker', filters.smoker)
      if (filters.schedule) params.append('schedule', filters.schedule)

      const { data } = await api.get(`/profiles/search?${params}`)

      const profilesWithCoords = (data.profiles || []).map((profile) => ({
        ...profile,
        location: {
          lat: profile.lat ?? CITY_CENTERS[profile.city]?.[0] ?? -25.2637,
          lng: profile.lng ?? CITY_CENTERS[profile.city]?.[1] ?? -57.5759,
        },
      }))

      setProfiles(p === 1 ? profilesWithCoords : (prev) => [...prev, ...profilesWithCoords])
      setPage(p)
      setHasMore(data.has_more ?? false)
    } catch {
      toast.error('Error al buscar perfiles')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchProfiles(1)
  }, [filters.city]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault()
    fetchProfiles(1)
  }

  const mapCenter = CITY_CENTERS[filters.city] || [-25.2867, -57.647]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-3xl">Buscar roomies</h1>
          <p className="text-orange-400 text-sm mt-1">
            Perfiles con 80%+ de compatibilidad con vos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((f) => !f)}
            className="flex items-center gap-2 btn-secondary py-2 px-4 text-sm"
          >
            <SlidersHorizontal size={16} /> Filtros {showFilters && <X size={14} />}
          </button>

          <button
            onClick={() => setShowMap((prev) => !prev)}
            className="flex items-center gap-2 btn-secondary py-2 px-4 text-sm"
          >
            <MapPin size={16} /> {showMap ? 'Ver lista' : 'Ver en mapa'}
          </button>
        </div>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <form onSubmit={handleSearch} className="card mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Ciudad */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">
              Ciudad
            </label>
            <select
              className="input"
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
            >
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Mascotas */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">
              Mascotas
            </label>
            <select
              className="input"
              value={filters.pets}
              onChange={(e) => setFilters((f) => ({ ...f, pets: e.target.value }))}
            >
              <option value="">Cualquiera</option>
              <option value="true">Con mascotas</option>
              <option value="false">Sin mascotas</option>
            </select>
          </div>

          {/* Fumador */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">
              Fumador
            </label>
            <select
              className="input"
              value={filters.smoker}
              onChange={(e) => setFilters((f) => ({ ...f, smoker: e.target.value }))}
            >
              <option value="">Cualquiera</option>
              <option value="false">No fuma</option>
              <option value="true">Fumador</option>
            </select>
          </div>

          {/* Horario */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">
              Horario
            </label>
            <select
              className="input"
              value={filters.schedule}
              onChange={(e) => setFilters((f) => ({ ...f, schedule: e.target.value }))}
            >
              <option value="">Cualquiera</option>
              {SCHEDULES.map((s) => <option key={s} value={s}>{SCHEDULE_LABELS[s]}</option>)}
            </select>
          </div>

          {/* Edad mínima */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">
              Edad mín.
            </label>
            <input
              type="number"
              className="input"
              placeholder="18"
              min={18}
              max={80}
              value={filters.min_age}
              onChange={(e) => setFilters((f) => ({ ...f, min_age: e.target.value }))}
            />
          </div>

          {/* Edad máxima */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">
              Edad máx.
            </label>
            <input
              type="number"
              className="input"
              placeholder="99"
              min={18}
              max={99}
              value={filters.max_age}
              onChange={(e) => setFilters((f) => ({ ...f, max_age: e.target.value }))}
            />
          </div>

          <div className="col-span-2 flex justify-end items-end">
            <button type="submit" className="btn-primary w-full md:w-auto">
              Aplicar filtros
            </button>
          </div>
        </form>
      )}

      {/* Loading o resultados */}
      {loading && profiles.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No encontramos roomies compatibles"
          description="Probá ajustar tus preferencias en tu perfil o cambiar el filtro de ciudad."
        />
      ) : showMap ? (
        <MapContainer center={mapCenter} zoom={13} style={{ height: '500px', width: '100%', borderRadius: '16px' }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {profiles.map((p) => (
            <Marker key={p.user_id} position={[p.location.lat, p.location.lng]}>
              <Popup>
                <div className="cursor-pointer w-60 p-2" onClick={() => navigate(`/profile/${p.user_id}`)}>
                  <div className="flex items-center gap-2 mb-2">
                    <img src={p.profile_photo_url || 'https://via.placeholder.com/40'} alt={p.name} className="w-10 h-10 rounded-full object-cover" loading="lazy"/>
                    <div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.city}</p>
                    </div>
                  </div>
                  {p.bio && <p className="text-xs text-gray-600 mb-1 line-clamp-2">{p.bio}</p>}
                  <p className="text-xs text-gray-400 mb-1">
                    {p.smoker ? 'Fumador' : 'No fuma'} {p.schedule ? `• ${SCHEDULE_LABELS[p.schedule] || p.schedule}` : ''}
                  </p>
                  <div className="text-xs">Compatibilidad: <span className="font-semibold text-primary-600">{p.compatibility}%</span></div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map((p) => (
            <ProfileCard key={p.user_id} profile={p} compatibility={p.compatibility} matches={p.matches} mismatches={p.mismatches} />
          ))}
          {hasMore && (
            <div className="flex justify-center mt-10">
              <button onClick={() => fetchProfiles(page + 1)} disabled={loading} className="btn-secondary flex items-center gap-2">
                {loading ? <Spinner size="sm" /> : null} Cargar más
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}