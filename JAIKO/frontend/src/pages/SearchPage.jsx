import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, X, MapPin, Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ProfileCard from '../components/ui/ProfileCard';
import { Spinner, EmptyState } from '../components/ui';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SCHEDULES = ['morning', 'afternoon', 'night', 'flexible'];
const SCHEDULE_LABELS = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche', flexible: 'Flexible' };
const CITIES = ['Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora', 'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este'];
const CITY_CENTERS = {
  'Asunción': [-25.2867, -57.647], 'San Lorenzo': [-25.3355, -57.5178], 'Luque': [-25.2635, -57.4857],
  'Fernando de la Mora': [-25.3085, -57.5225], 'Lambaré': [-25.3404, -57.6075], 'Capiatá': [-25.356, -57.4455],
  'Encarnación': [-27.3333, -55.8667], 'Ciudad del Este': [-25.5097, -54.611],
};
const AVATAR_FALLBACK = 'https://ui-avatars.com/api/?background=fde8d0&color=c2550a&size=40&name=';

export default function SearchPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [filters, setFilters] = useState({
    city: 'Asunción', pets: '', smoker: '', schedule: '', min_age: '', max_age: ''
  });

  const fetchProfiles = useCallback(async (p = 1, currentFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, per_page: 20, city: currentFilters.city });
      if (currentFilters.min_age) params.append('min_age', currentFilters.min_age);
      if (currentFilters.max_age) params.append('max_age', currentFilters.max_age);
      if (currentFilters.pets !== '') params.append('pets', currentFilters.pets);
      if (currentFilters.smoker !== '') params.append('smoker', currentFilters.smoker);
      if (currentFilters.schedule) params.append('schedule', currentFilters.schedule);

      const { data } = await api.get(`/profiles/search?${params}`);
      
      const profilesWithCoords = (data.profiles || []).map((profile) => ({
        ...profile,
        location: {
          lat: profile.lat ?? CITY_CENTERS[profile.city]?.[0] ?? -25.2867,
          lng: profile.lng ?? CITY_CENTERS[profile.city]?.[1] ?? -57.647,
        },
      }));

      setProfiles(p === 1 ? profilesWithCoords : (prev) => [...prev, ...profilesWithCoords]);
      setPage(p);
      setHasMore(data.has_more ?? false);
    } catch {
      toast.error('Error al buscar perfiles');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => { 
      fetchProfiles(1, filters); 
    }, filters.min_age || filters.max_age ? 400 : 0);
    return () => clearTimeout(timer);
  }, [filters, fetchProfiles]);

  const activeFilterCount = [
    filters.pets, filters.smoker, filters.schedule, filters.min_age, filters.max_age
  ].filter(Boolean).length;

  const mapCenter = CITY_CENTERS[filters.city] || [-25.2867, -57.647];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">Buscar Roomies</h1>
          <p className="text-orange-500 font-medium mt-1">
            {profiles.length > 0 ? `${profiles.length} roomies compatibles encontrados` : 'Perfiles compatibles con vos'}
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <MapPin size={16} /> {showMap ? 'Ver lista' : 'Ver en mapa'}
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all relative"
          >
            <SlidersHorizontal size={16} />
            Filtros {showFilters && <X size={14} className="ml-1" />}
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className={`card mb-10 overflow-hidden transition-all duration-500 ${showFilters ? 'max-h-[1000px] opacity-100 p-8' : 'max-h-0 opacity-0 p-0 border-none shadow-none'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Ciudad</label>
            <select className="input" value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Mascotas</label>
            <select className="input" value={filters.pets} onChange={(e) => setFilters((f) => ({ ...f, pets: e.target.value }))}>
              <option value="">Cualquiera</option>
              <option value="true">Con mascotas</option>
              <option value="false">Sin mascotas</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Fumador</label>
            <select className="input" value={filters.smoker} onChange={(e) => setFilters((f) => ({ ...f, smoker: e.target.value }))}>
              <option value="">Cualquiera</option>
              <option value="false">No fuma</option>
              <option value="true">Fumador</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Horario</label>
            <select className="input" value={filters.schedule} onChange={(e) => setFilters((f) => ({ ...f, schedule: e.target.value }))}>
              <option value="">Cualquiera</option>
              {SCHEDULES.map((s) => <option key={s} value={s}>{SCHEDULE_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Edad mín.</label>
            <input type="number" className="input" placeholder="18" min={18} max={80} value={filters.min_age}
              onChange={(e) => setFilters((f) => ({ ...f, min_age: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Edad máx.</label>
            <input type="number" className="input" placeholder="99" min={18} max={99} value={filters.max_age}
              onChange={(e) => setFilters((f) => ({ ...f, max_age: e.target.value }))} />
          </div>
          
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-50">
            <button type="button"
              onClick={() => setFilters({ city: 'Asunción', pets: '', smoker: '', schedule: '', min_age: '', max_age: '' })}
              className="btn-ghost text-sm">
              Limpiar filtros
            </button>
            <button onClick={() => fetchProfiles(1, filters)} className="btn-primary px-8">Aplicar filtros</button>
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      {loading && profiles.length === 0 ? (
        <div className="flex justify-center py-32"><Spinner size="lg" /></div>
      ) : profiles.length === 0 ? (
        <EmptyState icon="🔍" title="No encontramos roomies compatibles"
          description="Probá ajustar tus preferencias en tu perfil o cambiar el filtro de ciudad." />
      ) : showMap ? (
        <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-2xl h-[600px] relative z-0">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            {profiles.map((p) => (
              <Marker key={p.user_id} position={[p.location.lat, p.location.lng]}>
                <Popup>
                  <div className="cursor-pointer w-60 p-2" onClick={() => navigate(`/profile/${p.user_id}`)}>
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={p.profile_photo_url || `${AVATAR_FALLBACK}${encodeURIComponent(p.name || 'U')}`}
                        alt={p.name} className="w-10 h-10 rounded-full object-cover" loading="lazy"
                        onError={(e) => { e.target.src = `${AVATAR_FALLBACK}${encodeURIComponent(p.name || 'U')}` }}
                      />
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.city}</p>
                      </div>
                    </div>
                    {p.bio && <p className="text-xs text-gray-600 mb-1 line-clamp-2">{p.bio}</p>}
                    <p className="text-xs text-gray-400 mb-1">
                      {p.smoker ? 'Fumador' : 'No fuma'}
                      {p.schedule ? ` • ${SCHEDULE_LABELS[p.schedule] || p.schedule}` : ''}
                    </p>
                    <div className="text-xs font-bold text-orange-600">Compatibilidad: {p.compatibility}%</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {profiles.map((p) => (
              <ProfileCard 
                key={p.user_id} 
                profile={p} 
                compatibility={p.compatibility} 
                matches={p.matches} 
                mismatches={p.mismatches} 
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-12">
              <button 
                onClick={() => fetchProfiles(page + 1, filters)} 
                disabled={loading} 
                className="btn-secondary px-10 flex items-center gap-2"
              >
                {loading && <Spinner size="sm" />} Cargar más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}