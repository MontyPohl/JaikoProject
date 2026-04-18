import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Map, LayoutGrid, Plus, SlidersHorizontal, X } from 'lucide-react';
import api, { getRoomies } from '../services/api';
import ListingCard from '../components/ui/ListingCard';
import { Spinner, EmptyState } from '../components/ui';
import useAuthStore from '../context/authStore';

const CITIES = [
  'Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora',
  'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este',
];

const CITY_CENTERS = {
  'Asunción':           [-25.2867, -57.647 ],
  'San Lorenzo':        [-25.3355, -57.5178],
  'Luque':              [-25.2635, -57.4857],
  'Fernando de la Mora':[-25.3085, -57.5225],
  'Lambaré':            [-25.3404, -57.6075],
  'Capiatá':            [-25.356,  -57.4455],
  'Encarnación':        [-27.3333, -55.8667],
  'Ciudad del Este':    [-25.5097, -54.611 ],
};

export default function ListingsPage() {
  const { isAuthenticated } = useAuthStore();
  const [listings,   setListings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState('grid');
  const [showFilters,setShowFilters]= useState(false);

  /**
   * ✅ NUEVO: estado para el componente del mapa.
   *
   * JaikoMap usa react-leaflet (que no soporta SSR y es pesado).
   * Lo cargamos de forma dinámica con import() solamente cuando el
   * usuario activa la vista de mapa — no antes.
   * Esto evita que leaflet se incluya en el bundle inicial de la página.
   */
  const [MapComp, setMapComp] = useState(null);

  const [filters, setFilters] = useState({
    city:            'Asunción',
    min_price:       '',
    max_price:       '',
    pets_allowed:    '',
    smoking_allowed: '',
    type:            '',
  });

  // ── Cargar listados ────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams({ page: 1, per_page: 24, city: filters.city });
    if (filters.min_price)       params.set('min_price',       filters.min_price);
    if (filters.max_price)       params.set('max_price',       filters.max_price);
    if (filters.pets_allowed)    params.set('pets_allowed',    filters.pets_allowed);
    if (filters.smoking_allowed) params.set('smoking_allowed', filters.smoking_allowed);
    if (filters.type)            params.set('type',            filters.type);

    setLoading(true);
    api.get(`/listings/?${params}`)
      .then(({ data }) => setListings(data.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [filters]);

  /**
   * ✅ NUEVO: cargar JaikoMap de forma dinámica al activar la vista mapa.
   *
   * Por qué no lo cargamos al montar el componente:
   *   react-leaflet incluye todo Leaflet (~40kb gzipped) más el CSS del mapa.
   *   Si el usuario nunca toca "Mapa", pagaría ese costo sin necesidad.
   *   Con import() diferido, el chunk solo se descarga si se activa la vista.
   *
   * Por qué setMapComp(() => m.default) y no setMapComp(m.default):
   *   Si pasás una función directamente a setState, React la llama como
   *   "updater function". Al envolverla en () => m.default le indicamos
   *   que el nuevo estado ES esa función, no el resultado de llamarla.
   */
  const handleViewChange = (newView) => {
    setView(newView);
    if (newView === 'map' && !MapComp) {
      import('../components/map/JaikoMap')
        .then(m => setMapComp(() => m.default))
        .catch(() => {}); // silencioso: si falla, la vista queda vacía
    }
  };

  // Convertir listings a formato listingMarkers que acepta JaikoMap
  const listingMarkers = listings
    .filter(l => l.latitude != null && l.longitude != null)
    .map(l => ({
      lat:          l.latitude,
      lng:          l.longitude,
      id:           l.id,
      title:        l.title,
      price:        l.total_price,
      neighborhood: l.neighborhood,
    }));

  const activeFilterCount = [
    filters.min_price, filters.max_price, filters.pets_allowed,
    filters.smoking_allowed, filters.type,
  ].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
            Departamentos
          </h1>
          <p className="text-orange-500 font-medium mt-1">
            {listings.length} publicaciones disponibles
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle Grid / Mapa */}
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => handleViewChange('grid')}
              className={`px-4 py-2 flex items-center gap-2 text-sm font-bold rounded-xl transition-all
                ${view === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={16} /> Grid
            </button>
            <button
              onClick={() => handleViewChange('map')}
              className={`px-4 py-2 flex items-center gap-2 text-sm font-bold rounded-xl transition-all
                ${view === 'map'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Map size={16} /> Mapa
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all relative"
          >
            <SlidersHorizontal size={16} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>

          {isAuthenticated() && (
            <Link to="/listings/new" className="btn-primary flex items-center gap-2 py-2.5">
              <Plus size={18} /> Publicar
            </Link>
          )}
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className={`card mb-10 overflow-hidden transition-all duration-500 ${
        showFilters
          ? 'max-h-[1000px] opacity-100 p-8'
          : 'max-h-0 opacity-0 p-0 border-none shadow-none'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
              Ciudad
            </label>
            <select
              className="input"
              value={filters.city}
              onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
              Tipo
            </label>
            <select
              className="input"
              value={filters.type}
              onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="apartment">Departamento</option>
              <option value="room">Habitación</option>
              <option value="house">Casa</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
              Precio mín
            </label>
            <input
              type="number" className="input" value={filters.min_price} placeholder="0"
              onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
              Precio máx
            </label>
            <input
              type="number" className="input" value={filters.max_price} placeholder="Sin límite"
              onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3 pt-4 border-t border-slate-50">
            {[
              ['pets_allowed',    '🐾 Mascotas' ],
              ['smoking_allowed', '🚬 Fumadores'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilters(f => ({
                  ...f, [key]: f[key] === 'true' ? '' : 'true',
                }))}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all
                  ${filters[key] === 'true'
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setFilters({
                city: 'Asunción', min_price: '', max_price: '',
                pets_allowed: '', smoking_allowed: '', type: '',
              })}
              className="ml-auto text-sm font-bold text-red-400 hover:text-red-500 flex items-center gap-1"
            >
              <X size={14} /> Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenido: Grid o Mapa ────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-32"><Spinner size="lg" /></div>

      ) : listings.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="No hay publicaciones"
          description="Sé el primero en publicar en esta ciudad."
        />

      ) : view === 'grid' ? (
        /* ── Vista grilla ─────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {listings.map(l => <ListingCard key={l.id} listing={l} />)}
        </div>

      ) : (
        /* ── Vista mapa ───────────────────────────────────────────────────────
         *
         * ✅ FIX: Esta sección no existía antes.
         *
         * El botón "Mapa" cambiaba view a 'map' pero el JSX no tenía
         * ninguna rama para ese estado — el contenido desaparecía por completo.
         *
         * Ahora:
         *  1. Si MapComp aún no cargó (import() en curso) → muestra spinner.
         *  2. Si no hay departamentos con coords → muestra mensaje informativo.
         *  3. Si todo está listo → renderiza JaikoMap con listingMarkers.
         *
         * Por qué un contenedor con altura fija (h-[500px]):
         *   JaikoMap necesita que el padre tenga altura definida.
         *   Con height: '100%' sin un padre con altura, el mapa queda en 0px.
         *   500px en mobile, 600px en sm+ da una experiencia cómoda.
         */
        <div>
          {/* Contador de pins disponibles */}
          {listingMarkers.length < listings.length && (
            <p className="text-sm text-slate-400 mb-3">
              Mostrando {listingMarkers.length} de {listings.length} departamentos en el mapa
              (los demás no tienen coordenadas registradas).
            </p>
          )}

          <div className="h-[500px] sm:h-[600px] w-full rounded-2xl overflow-hidden shadow-lg">
            {!MapComp ? (
              // Mapa aún cargando (import() en progreso)
              <div className="flex items-center justify-center h-full bg-slate-50 rounded-2xl border border-slate-100">
                <Spinner size="lg" />
              </div>
            ) : listingMarkers.length === 0 ? (
              // Ningún listing tiene coordenadas
              <div className="flex flex-col items-center justify-center h-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 gap-4">
                <span className="text-5xl opacity-30">🗺️</span>
                <p className="text-slate-400 font-medium text-center max-w-xs">
                  Ningún departamento de esta ciudad tiene coordenadas registradas todavía.
                </p>
              </div>
            ) : (
              <MapComp
                center={CITY_CENTERS[filters.city] || [-25.2867, -57.647]}
                listingMarkers={listingMarkers}
                height="100%"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
