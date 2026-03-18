import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, X, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import ProfileCard from '../components/ui/ProfileCard'
import { Spinner, EmptyState } from '../components/ui'
import { toast } from 'react-hot-toast'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const SCHEDULES = ['morning', 'afternoon', 'night', 'flexible']
const CITIES = ['Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora', 'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este']

export default function SearchPage() {
  const navigate = useNavigate()

  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const [filters, setFilters] = useState({
    city: 'Asunción',
    pets: '',
    smoker: '',
    schedule: '',
    // --- Cambios realizados por Aaron Barrios ---
    min_age: '', // Agrego rango min para que el filtro sea recíproco
    max_age: '', // Agrego rango max para el filtro de edad
    // --------------------------------------------
  })

  const fetchProfiles = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      // --- Cambios realizados por Aaron Barrios ---
      // Seteo los parámetros incluyendo el rango de edad para que el back filtre la visibilidad mutua
      const params = new URLSearchParams({ 
        page: p, 
        per_page: 20, 
        city: filters.city,
        min_age: filters.min_age, // Envío edad mínima al servidor para el match de edad
        max_age: filters.max_age  // Envío edad máxima al servidor para el match de edad
      })
      // --------------------------------------------
      
      const { data } = await api.get(`/profiles/search?${params}`)
      const profilesWithCoords = await Promise.all(data.profiles.map(async profile => {
        const coords = await getCoordinates(profile.city)
        return { ...profile, location: coords }
      }))
      setProfiles(p === 1 ? profilesWithCoords : (prev) => [...prev, ...profilesWithCoords])
      setPage(p)
    } catch {
      toast.error('Error al buscar perfiles')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchProfiles(1) }, [filters.city])

  const handleSearch = (e) => { e.preventDefault(); fetchProfiles(1) }

  // Geocoding ciudad → lat/lng
  const getCoordinates = async (city) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`)
      const data = await res.json()
      if (data.length === 0) return { lat: -25.2637, lng: -57.5759 } // fallback Asunción
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {
      return { lat: -25.2637, lng: -57.5759 }
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-3xl">Buscar roomies</h1>
          <p className="text-orange-400 text-sm mt-1">Perfiles con 80%+ de compatibilidad con vos</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 btn-secondary py-2 px-4 text-sm"
          >
            <SlidersHorizontal size={16} />
            Filtros
            {showFilters && <X size={14} />}
          </button>

          <button
            onClick={() => setShowMap(prev => !prev)}
            className="flex items-center gap-2 btn-secondary py-2 px-4 text-sm"
          >
            <MapPin size={16} /> Ver en Mapa
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <form onSubmit={handleSearch} className="card mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Ciudad</label>
            <select
              className="input"
              value={filters.city}
              onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Mascotas</label>
            <select className="input" value={filters.pets}
              onChange={e => setFilters(f => ({ ...f, pets: e.target.value }))}>
              <option value="">Cualquiera</option>
              <option value="true">Con mascotas</option>
              <option value="false">Sin mascotas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Fumador</label>
            <select className="input" value={filters.smoker}
              onChange={e => setFilters(f => ({ ...f, smoker: e.target.value }))}>
              <option value="">Cualquiera</option>
              <option value="false">No fuma</option>
              <option value="true">Fumador</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Horario</label>
            <select className="input" value={filters.schedule}
              onChange={e => setFilters(f => ({ ...f, schedule: e.target.value }))}>
              <option value="">Cualquiera</option>
              {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* --- Cambios realizados por Aaron Barrios --- */}
          {/* Agrego inputs numéricos para filtrar edad y asegurar visibilidad mutua */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Edad Mín.</label>
            <input 
              type="number" 
              className="input" 
              placeholder="18"
              value={filters.min_age}
              onChange={e => setFilters(f => ({ ...f, min_age: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Edad Máx.</label>
            <input 
              type="number" 
              className="input" 
              placeholder="99"
              value={filters.max_age}
              onChange={e => setFilters(f => ({ ...f, max_age: e.target.value }))}
            />
          </div>
          {/* -------------------------------------------- */}

          <div className="col-span-2 md:col-span-2 flex justify-end items-end">
            <button type="submit" className="btn-primary w-full md:w-auto">Aplicar filtros</button>
          </div>
        </form>
      )}

      {/* Results / Map */}
      {loading && profiles.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No encontramos roomies compatibles"
          description="Probá ajustar tus preferencias en tu perfil o cambiar el filtro de ciudad."
        />
      ) : showMap ? (
        <MapContainer center={[-25.2637, -57.5759]} zoom={14} style={{ height: '500px', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {profiles.map(p => (
            <Marker key={p.user_id} position={[p.location.lat, p.location.lng]}>
              <Popup>
                <div
                  className="cursor-pointer w-60 p-2"
                  onClick={() => navigate(`/profile/${p.user_id}`)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <img src={p.avatar_url} alt={p.name} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.city}</p>
                    </div>
                  </div>
                  <p className="text-sm mb-1">{p.description || 'Sin descripción'}</p>
                  <p className="text-xs text-gray-400 mb-1">
                    {p.smoker === 'true' ? 'Fumador' : 'No fuma'} • {p.schedule || 'Horario flexible'}
                  </p>
                  <div className="text-xs">
                    Compatibilidad: <span className="font-semibold">{p.compatibility}%</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {profiles.map(p => (
              <ProfileCard
                key={p.user_id}
                profile={p}
                compatibility={p.compatibility}
                matches={p.matches}
                mismatches={p.mismatches}
              />
            ))}
          </div>

          {/* Load more */}
          <div className="flex justify-center mt-10">
            <button
              onClick={() => fetchProfiles(page + 1)}
              disabled={loading}
              className="btn-secondary flex items-center gap-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              Cargar más
            </button>
          </div>
        </>
      )}
    </div>
  )
}