import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Map, LayoutGrid, Plus } from 'lucide-react'
import api, { getRoomies } from '../services/api'
import ListingCard from '../components/ui/ListingCard'
import ProfileCard from '../components/ui/ProfileCard'
import { Spinner, EmptyState } from '../components/ui'
import useAuthStore from '../context/authStore'

const CITIES = ['Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora', 'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este']

export default function ListingsPage() {
  const { isAuthenticated } = useAuthStore()
  const [listings, setListings] = useState([])
  const [roomies, setRoomies] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('grid') // grid | map
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [JaikoMap, setJaikoMap] = useState(null)

  const [filters, setFilters] = useState({
    city: 'Asunción',
    min_price: '',
    max_price: '',
    pets_allowed: '',
    smoking_allowed: '',
  })

  // Traer listings según filtros
  useEffect(() => {
    const params = new URLSearchParams({ page: 1, per_page: 24, city: filters.city })
    if (filters.min_price) params.set('min_price', filters.min_price)
    if (filters.max_price) params.set('max_price', filters.max_price)
    if (filters.pets_allowed) params.set('pets_allowed', filters.pets_allowed)
    if (filters.smoking_allowed) params.set('smoking_allowed', filters.smoking_allowed)

    setLoading(true)
    api.get(`/listings/?${params}`)
      .then(({ data }) => {
        setListings(data.listings)
        setTotalPages(data.pages)
        setPage(1)
      })
      .finally(() => setLoading(false))
  }, [filters])

  // Lazy-load JaikoMap
  useEffect(() => {
    if (view === 'map' && !JaikoMap) {
      import('../components/map/JaikoMap').then(m => setJaikoMap(() => m.default))
    }
  }, [view])

  // Traer roomies para el mapa
  useEffect(() => {
    if (view === 'map') {
      getRoomies().then(setRoomies)
    }
  }, [view])

  // Markers de listings (grid view)
  const mapMarkers = listings
    .filter(l => l.latitude && l.longitude)
    .map(l => ({
      lat: l.latitude,
      lng: l.longitude,
      title: l.title,
      description: `₲ ${(l.total_price / 1_000_000).toFixed(1)}M/mes`,
      link: `/listings/${l.id}`
    }))

  // Markers de roomies (map view) con filtros originales
  const filteredRoomies = roomies.filter(r => {
    const cityOk = !filters.city || r.profile.city === filters.city
    const petsOk = !filters.pets_allowed || r.profile.pets
    const smokingOk = !filters.smoking_allowed || !r.profile.smoker
    const budgetOk = (!filters.min_price || r.profile.budget_min >= filters.min_price) &&
                     (!filters.max_price || r.profile.budget_max <= filters.max_price)
    return cityOk && petsOk && smokingOk && budgetOk
  }).map(r => ({
    lat: r.lat,
    lng: r.lng,
    profile: r.profile,
    compatibility: r.compatibility,
    matches: r.matches,
    mismatches: r.mismatches
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display font-extrabold text-3xl">Departamentos</h1>
          <p className="text-[#F5A623] text-sm mt-1">{listings.length} publicaciones disponibles</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-xl border border-[#E2E8F0] overflow-hidden">
            <button onClick={() => setView('grid')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-semibold transition-colors ${view === 'grid' ? 'bg-[#2563C8] text-white' : 'text-[#64748B] hover:bg-[#F4F7FF]'}`}>
              <LayoutGrid size={15} /> Grid
            </button>
            <button onClick={() => setView('map')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-semibold transition-colors ${view === 'map' ? 'bg-[#2563C8] text-white' : 'text-[#64748B] hover:bg-[#F4F7FF]'}`}>
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

      {/* Filters */}
      <div className="card mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wide">Ciudad</label>
          <select className="input w-44 h-11 appearance-none pr-8" value={filters.city}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wide">Precio min (₲)</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" className="input w-36 h-11"
            value={filters.min_price} placeholder="0"
            onKeyDown={e => ['-', '+', 'e', '.'].includes(e.key) && e.preventDefault()}
            onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setFilters(f => ({ ...f, min_price: v })) }} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1 uppercase tracking-wide">Precio max (₲)</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" className="input w-36 h-11"
            value={filters.max_price} placeholder="Sin límite"
            onKeyDown={e => ['-', '+', 'e', '.'].includes(e.key) && e.preventDefault()}
            onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setFilters(f => ({ ...f, max_price: v })) }} />
        </div>
        <div className="flex gap-2">
          {[['pets_allowed', '🐾 Mascotas'], ['smoking_allowed', '🚬 Fumadores']].map(([key, label]) => (
            <button key={key} type="button"
              onClick={() => setFilters(f => ({ ...f, [key]: f[key] === 'true' ? '' : 'true' })) }
              className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${filters[key] === 'true' ? 'border-[#2563C8] bg-[#EFF6FF] text-[#2563C8]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#BFDBFE]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : view === 'map' ? (
        <div className="h-[600px]">
          {JaikoMap ? (
            <JaikoMap markers={filteredRoomies} height="600px" />
          ) : (
            <div className="flex justify-center items-center h-full"><Spinner /></div>
          )}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState icon="🏠" title="No hay publicaciones" description="Sé el primero en publicar en esta ciudad." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {listings.map(l => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  )
}