import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, X, MapPin, Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ProfileCard from '../components/ui/ProfileCard';
import { Spinner, EmptyState } from '../components/ui';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';

const SCHEDULES = ['morning', 'afternoon', 'night', 'flexible'];
const SCHEDULE_LABELS = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche', flexible: 'Flexible' };
const CITIES = ['Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora', 'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este'];

export default function SearchPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    city: 'Asunción', pets: '', smoker: '', schedule: '', min_age: '', max_age: ''
  });

  const fetchProfiles = useCallback(async (currentFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: 1, per_page: 20, city: currentFilters.city });
      if (currentFilters.min_age) params.append('min_age', currentFilters.min_age);
      if (currentFilters.max_age) params.append('max_age', currentFilters.max_age);
      if (currentFilters.pets !== '') params.append('pets', currentFilters.pets);
      if (currentFilters.smoker !== '') params.append('smoker', currentFilters.smoker);
      if (currentFilters.schedule) params.append('schedule', currentFilters.schedule);

      const { data } = await api.get(`/profiles/search?${params}`);
      setProfiles(data.profiles || []);
    } catch {
      toast.error('Error al buscar perfiles');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProfiles();
  }, [filters, fetchProfiles]);

  const activeFilterCount = [
    filters.pets, filters.smoker, filters.schedule, filters.min_age, filters.max_age
  ].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">Buscar Roomies</h1>
          <p className="text-orange-500 font-medium mt-1">{profiles.length} perfiles compatibles encontrados</p>
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
      </div>

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
            <button onClick={() => fetchProfiles()} className="btn-primary">Aplicar filtros</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-32"><Spinner size="lg" /></div>
      ) : profiles.length === 0 ? (
        <EmptyState icon="🔍" title="No encontramos roomies compatibles"
          description="Probá ajustar tus preferencias en tu perfil o cambiar el filtro de ciudad." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {profiles.map((p) => (
            <ProfileCard key={p.user_id} profile={p} compatibility={p.compatibility} />
          ))}
        </div>
      )}
    </div>
  );
}
