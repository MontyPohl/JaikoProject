import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Map, LayoutGrid, MapPin } from 'lucide-react';
import api from '../services/api';
import ProfileCard from '../components/ui/ProfileCard';
import { Spinner, EmptyState } from '../components/ui';
import { toast } from 'react-hot-toast';

// ─── Constantes ───────────────────────────────────────────────────────────────
const SCHEDULES = ['morning', 'afternoon', 'night', 'flexible'];
const SCHEDULE_LABELS = {
  morning:   'Mañana',
  afternoon: 'Tarde',
  night:     'Noche',
  flexible:  'Flexible',
};
const CITIES = [
  'Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora',
  'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este',
];
const CITY_CENTERS = {
  'Asunción':            [-25.2867, -57.647 ],
  'San Lorenzo':         [-25.3355, -57.5178],
  'Luque':               [-25.2635, -57.4857],
  'Fernando de la Mora': [-25.3085, -57.5225],
  'Lambaré':             [-25.3404, -57.6075],
  'Capiatá':             [-25.356,  -57.4455],
  'Encarnación':         [-27.3333, -55.8667],
  'Ciudad del Este':     [-25.5097, -54.611 ],
};
const GENDER_OPTIONS = [
  { value: '',       label: 'Cualquiera'            },
  { value: 'male',   label: 'Hombre'                },
  { value: 'female', label: 'Mujer'                 },
  { value: 'other',  label: 'Otro / No especificado'},
];
const INITIAL_FILTERS = {
  city: 'Asunción', gender: '', pets: '', smoker: '', schedule: '',
  min_age: '', max_age: '',
};

// ─── Página principal ─────────────────────────────────────────────────────────
export default function SearchPage() {
  const [profiles,     setProfiles]    = useState([]);
  const [loading,      setLoading]     = useState(false);
  const [showFilters,  setShowFilters] = useState(false);
  const [filters,      setFilters]     = useState(INITIAL_FILTERS);

  // ── Vista: 'grid' | 'map' ────────────────────────────────────────────────
  const [view,    setView]    = useState('grid');
  // MapComp se carga de forma diferida solo cuando el usuario activa el mapa
  const [MapComp, setMapComp] = useState(null);

  // ─── Fetch perfiles ────────────────────────────────────────────────────────
  const fetchProfiles = useCallback(async (currentFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: 1, per_page: 100, city: currentFilters.city,
      });
      if (currentFilters.min_age)       params.append('min_age',  currentFilters.min_age);
      if (currentFilters.max_age)       params.append('max_age',  currentFilters.max_age);
      if (currentFilters.pets  !== '')  params.append('pets',     currentFilters.pets);
      if (currentFilters.smoker !== '') params.append('smoker',   currentFilters.smoker);
      if (currentFilters.schedule)      params.append('schedule', currentFilters.schedule);
      if (currentFilters.gender)        params.append('gender',   currentFilters.gender);

      const { data } = await api.get(`/profiles/search?${params}`);
      setProfiles(data.profiles || []);
    } catch {
      toast.error('Error al buscar perfiles');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchProfiles(); }, [filters, fetchProfiles]);

  // ─── Cambio de vista con carga diferida del mapa ───────────────────────────
  /*
   * Por qué cargamos JaikoMap con import() solo cuando se pide:
   * react-leaflet pesa ~40 kb gzipped. Si el usuario nunca abre la vista de
   * mapa, no tiene sentido incluirlo en el bundle inicial de la página.
   * Al hacer import() en el momento exacto que se necesita, el chunk se
   * descarga una sola vez y queda en caché.
   */
  const handleViewChange = (newView) => {
    setView(newView);
    if (newView === 'map' && !MapComp) {
      import('../components/map/JaikoMap')
        .then(m => setMapComp(() => m.default))
        .catch(() => toast.error('No se pudo cargar el mapa'));
    }
  };

  // ─── Convertir profiles → markers para JaikoMap ───────────────────────────
  /*
   * JaikoMap espera para roomies: { lat, lng, profile, compatibility, matches, mismatches }
   * Solo incluimos los que tienen coordenadas válidas.
   */
  const roomieMarkers = profiles
    .filter(p => p.lat != null && p.lng != null && isFinite(p.lat) && isFinite(p.lng))
    .map(p => ({
      lat:           p.lat,
      lng:           p.lng,
      profile:       p,
      compatibility: p.compatibility ?? null,
      matches:       p.matches    || [],
      mismatches:    p.mismatches || [],
    }));

  const activeFilterCount = [
    filters.gender, filters.pets, filters.smoker,
    filters.schedule, filters.min_age, filters.max_age,
  ].filter(Boolean).length;

  const handleFilterChange = (key, value) =>
    setFilters(f => ({ ...f, [key]: value }));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-blue-950">
            Buscar Roomies
          </h1>
          <p className="text-orange-500 font-bold mt-1">
            {profiles.length} perfiles compatibles encontrados
          </p>
        </div>

        {/* Controles: toggle vista + filtros */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Toggle Grid / Mapa — igual al de ListingsPage */}
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => handleViewChange('grid')}
              className={`px-4 py-2 flex items-center gap-2 text-sm font-bold rounded-xl transition-all
                ${view === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={16} /> Lista
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

          {/* Botón Filtros */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-orange-100 text-sm font-bold text-blue-900 bg-white hover:bg-orange-50 transition-all relative shadow-sm"
          >
            <SlidersHorizontal size={16} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Panel de filtros colapsable ──────────────────────────────────────── */}
      <div className={`card mb-10 overflow-hidden transition-all duration-500 ${
        showFilters
          ? 'max-h-[1000px] opacity-100 p-8'
          : 'max-h-0 opacity-0 p-0 border-none shadow-none'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">

          <div className="space-y-2">
            <label className="block text-xs font-bold text-blue-900/40 uppercase tracking-widest ml-1">Ciudad</label>
            <select className="input" value={filters.city}
              onChange={e => handleFilterChange('city', e.target.value)}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Género</label>
            <select className="input" value={filters.gender}
              onChange={e => handleFilterChange('gender', e.target.value)}>
              {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Mascotas</label>
            <select className="input" value={filters.pets}
              onChange={e => handleFilterChange('pets', e.target.value)}>
              <option value="">Cualquiera</option>
              <option value="true">Con mascotas</option>
              <option value="false">Sin mascotas</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Fumador</label>
            <select className="input" value={filters.smoker}
              onChange={e => handleFilterChange('smoker', e.target.value)}>
              <option value="">Cualquiera</option>
              <option value="false">No fuma</option>
              <option value="true">Fumador</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Horario</label>
            <select className="input" value={filters.schedule}
              onChange={e => handleFilterChange('schedule', e.target.value)}>
              <option value="">Cualquiera</option>
              {SCHEDULES.map(s => <option key={s} value={s}>{SCHEDULE_LABELS[s]}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Edad mín.</label>
            <input type="number" className="input" placeholder="18" min={18} max={80}
              value={filters.min_age} onChange={e => handleFilterChange('min_age', e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Edad máx.</label>
            <input type="number" className="input" placeholder="99" min={18} max={99}
              value={filters.max_age} onChange={e => handleFilterChange('max_age', e.target.value)} />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-50">
            <button type="button" onClick={() => setFilters(INITIAL_FILTERS)} className="btn-ghost text-sm">
              Limpiar filtros
            </button>
            <button onClick={() => fetchProfiles()} className="btn-primary">
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenido: lista o mapa ──────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-32"><Spinner size="lg" /></div>

      ) : view === 'grid' ? (
        /* ── Vista lista de perfiles ── */
        profiles.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No encontramos roomies compatibles"
            description="Probá ajustar tus preferencias en tu perfil o cambiar el filtro de ciudad."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {profiles.map(p => (
              <ProfileCard key={p.user_id} profile={p} compatibility={p.compatibility} />
            ))}
          </div>
        )

      ) : (
        /* ── Vista mapa ──────────────────────────────────────────────────────
         *
         * Muestra todos los roomies que tienen coordenadas (lat/lng) como
         * marcadores naranja sobre el mapa de la ciudad seleccionada.
         * Al hacer clic en un marcador, aparece la ProfileCard del roomie.
         */
        <div>
          {/* Aviso si algunos perfiles no tienen ubicación */}
          {profiles.length > 0 && roomieMarkers.length < profiles.length && (
            <p className="text-sm text-slate-400 mb-3 flex items-center gap-1.5">
              <MapPin size={13} />
              Mostrando {roomieMarkers.length} de {profiles.length} roomies en el mapa
              (los demás no tienen ubicación registrada).
            </p>
          )}

          {/* Contenedor del mapa con altura fija — leaflet necesita altura definida */}
          <div className="h-[420px] sm:h-[560px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-100">
            {!MapComp ? (
              /* Mapa aún cargando el chunk de leaflet */
              <div className="flex items-center justify-center h-full bg-slate-50 rounded-2xl">
                <Spinner size="lg" />
              </div>

            ) : roomieMarkers.length === 0 ? (
              /* Sin roomies con coordenadas */
              <div className="flex flex-col items-center justify-center h-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 gap-4">
                <span className="text-5xl opacity-30">📍</span>
                <p className="text-slate-400 font-medium text-center max-w-xs leading-relaxed">
                  Ningún roomie de esta ciudad tiene su ubicación registrada todavía.
                </p>
              </div>

            ) : (
              <MapComp
                center={CITY_CENTERS[filters.city] || [-25.2867, -57.647]}
                markers={roomieMarkers}
                height="100%"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
