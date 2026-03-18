import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Map, LayoutGrid, Plus } from 'lucide-react'
import api, { getRoomies } from '../services/api'
import ListingCard from '../components/ui/ListingCard'
import { Spinner, EmptyState } from '../components/ui'
import useAuthStore from '../context/authStore'

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

export default function ListingsPage() {
  const { isAuthenticated } = useAuthStore()
  const [listings, setListings] = useState([])
  const [roomies, setRoomies] = useState([])
  const [loading, setLoading] = useState(true)
  const [roomiesLoading, setRoomiesLoading] = useState(false)
  const [view, setView] = useState('grid') // 'grid' | 'map'
  const [JaikoMap, setJaikoMap] = useState(null)

  const [filters, setFilters] = useState({
    city: 'Asunción',
    min_price: '',
    max_price: '',
    pets_allowed: '',
    smoking_allowed: '',
  })

  // ── Cargar listings (solo departamentos) ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams({ page: 1, per_page: 24, city: filters.city })
    if (filters.min_price) params.set('min_price', filters.min_price)
    if (filters.max_price) params.set('max_price', filters.max_price)
    if (filters.pets_allowed) params.set('pets_allowed', filters.pets_allowed)
    if (filters.smoking_allowed) params.set('smoking_allowed', filters.smoking_allowed)

    setLoading(true)
    api.get(`/listings/?${params}`)
      .then(({ data }) => {
        // ✅ Solo departamentos
        const onlyListings = (data.listings || []).filter(l => l.type === 'listing')
        setListings(onlyListings)
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [filters])

  // ── Lazy-load JaikoMap solo cuando se necesita ───────────────────────────
  useEffect(() => {
    if (view === 'map' && !JaikoMap) {
      import('../components/map/JaikoMap').then((m) => setJaikoMap(() => m.default))
    }
  }, [view, JaikoMap])

  // ── Cargar roomies solo para el mapa ────────────────────────────────────
  useEffect(() => {
    if (view !== 'map' || !isAuthenticated()) {
      setRoomies([])
      return
    }

    setRoomiesLoading(true)
    getRoomies(filters.city)
      .then(setRoomies)
      .catch(() => setRoomies([]))
      .finally(() => setRoomiesLoading(false))
  }, [view, filters.city, isAuthenticated])

  // ── Marcadores departamentos ────────────────────────────────────────────
  const listingMarkers = listings
    .filter(l => l.latitude != null && l.longitude != null && isFinite(l.latitude) && isFinite(l.longitude))
    .map(l => ({
      lat: l.latitude,
      lng: l.longitude,
      id: l.id,
      title: l.title,
      price: l.total_price,
      neighborhood: l.neighborhood,
    }))

  // ── Marcadores roomies ─────────────────────────────────────────────────
  const roomiMarkers = roomies
    .filter(r => r && r.lat != null && r.lng != null && isFinite(r.lat) && isFinite(r.lng) && r.profile)

  const mapCenter = CITY_CENTERS[filters.city] || [-25.2867, -57.647]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-extrabold text-3xl">Departamentos</h1>
          <p className="text-[#F5A623] text-sm mt-1">{listings.length} publicaciones disponibles</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-[#E2E8F0] overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-semibold transition-colors ${view === 'grid'
                  ? 'bg-[#2563C8] text-white'
                  : 'text-[#64748B] hover:bg-[#F4F7FF]'
                }`}
            >
              <LayoutGrid size={15} /> Grid
            </button>
            <button
              onClick={() => setView('map')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-semibold transition-colors ${view === 'map'
                  ? 'bg-[#2563C8] text-white'
                  : 'text-[#64748B] hover:bg-[#F4F7FF]'
                }`}
            >
              <Map size={15} /> Mapa
            </button>
          </div>
          {isAuthenticated() && (
            <Link to="/listings/new" className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={15} /> Publicar
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6 flex flex-wrap gap-4 items-end">
        {/* Ciudad y precios */}
        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wide">Ciudad</label>
          <select
            className="input w-44 h-11 appearance-none pr-8"
            value={filters.city}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
          >
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wide">Precio min (₲)</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*"
            className="input w-36 h-11"
            placeholder="0"
            value={filters.min_price}
            onChange={e => setFilters(f => ({ ...f, min_price: e.target.value.replace(/[^0-9]/g,'') }))}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wide">Precio max (₲)</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*"
            className="input w-36 h-11"
            placeholder="Sin límite"
            value={filters.max_price}
            onChange={e => setFilters(f => ({ ...f, max_price: e.target.value.replace(/[^0-9]/g,'') }))}
          />
        </div>

        <div className="flex gap-2">
          {[['pets_allowed','🐾 Mascotas'], ['smoking_allowed','🚬 Fumadores']].map(([key,label]) => (
            <button key={key} type="button"
              onClick={() => setFilters(f => ({ ...f, [key]: f[key] === 'true' ? '' : 'true' }))}
              className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${filters[key]==='true'
                ? 'border-[#2563C8] bg-[#EFF6FF] text-[#2563C8]'
                : 'border-[#E2E8F0] text-[#64748B] hover:border-[#BFDBFE]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : view === 'map' ? (
        <div className="space-y-3">
          {/* Leyenda */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              {listingMarkers.length} departamentos
            </span>
            {isAuthenticated() && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
                {roomiesLoading ? 'cargando roomies...' : `${roomiMarkers.length} roomies compatibles`}
              </span>
            )}
          </div>

          <div className="h-[600px]">
            {JaikoMap ? (
              <JaikoMap
                center={mapCenter}
                markers={roomiMarkers}
                listingMarkers={listingMarkers}
                height="600px"
              />
            ) : (
              <div className="flex justify-center items-center h-full"><Spinner /></div>
            )}
          </div>

          {listingMarkers.length === 0 && !loading && (
            <p className="text-center text-sm text-orange-300 mt-2">
              Ningún departamento de esta ciudad tiene coordenadas guardadas aún.
            </p>
          )}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="No hay publicaciones"
          description="Sé el primero en publicar en esta ciudad."
        />
      ) : (
        // ── Grid solo con departamentos
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {listings.map(l => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  )
}