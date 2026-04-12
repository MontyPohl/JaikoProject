// GroupsPage.jsx — Rediseño moderno
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Users, ChevronRight } from 'lucide-react'
import api from '../services/api'
import { Badge, Spinner, EmptyState, Modal } from '../components/ui'
import { toast } from 'react-hot-toast'

export function GroupsPage() {
  const [groups, setGroups] = useState([])
  const [myGroups, setMyGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', city: 'Asunción', max_members: 3 })
  const [requestingGroupId, setRequestingGroupId] = useState(null)
  const navigate = useNavigate()

  const load = () => {
    Promise.all([
      api.get('/groups/?city=Asunción'),
      api.get('/groups/my'),
    ]).then(([g, m]) => {
      setGroups(g.data.groups)
      setMyGroups(m.data.groups)
    }).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Nombre requerido'); return }
    try {
      const { data } = await api.post('/groups/', form)
      toast.success('Grupo creado')
      setShowCreate(false)
      navigate(`/groups/${data.group.id}`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al crear grupo')
    }
  }

  const handleRequestJoin = async (groupId) => {
    try {
      setRequestingGroupId(groupId)
      const { data } = await api.post(`/groups/${groupId}/join-request`)
      toast.success(data.message || 'Solicitud enviada')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al enviar solicitud')
    } finally {
      setRequestingGroupId(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8 pb-24 md:pb-8">

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-5 sm:mb-7 gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1E293B]">Grupos</h1>
          <p className="text-[#94A3B8] text-sm mt-0.5">Armá equipo para buscar departamento juntos</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563C8] text-white
            text-sm font-bold shadow-[0_4px_12px_rgba(37,99,200,0.3)]
            hover:bg-[#1D4ED8] active:scale-95 transition-all flex-shrink-0"
        >
          <Plus size={15} /> Crear grupo
        </button>
      </div>

      {/* Mis grupos */}
      {myGroups.length > 0 && (
        <div className="mb-7">
          <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-3">Mis grupos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {myGroups.map(g => (
              <GroupCard key={g.id} group={g} isOwn onView={() => navigate(`/groups/${g.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Grupos abiertos */}
      <div>
        <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-3">Grupos abiertos</p>
        {groups.length === 0 ? (
          <EmptyState icon="👥" title="No hay grupos abiertos" description="Creá el primero y empezá a buscar roomies." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {groups.map(g => (
              <GroupCard
                key={g.id} group={g}
                onJoin={() => handleRequestJoin(g.id)}
                onView={() => navigate(`/groups/${g.id}`)}
                requesting={requestingGroupId === g.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal crear grupo */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear grupo">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#94A3B8] mb-1.5 uppercase tracking-wider">Nombre *</label>
            <input className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Buscamos 2 roomies en Asunción" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#94A3B8] mb-1.5 uppercase tracking-wider">Descripción</label>
            <textarea className="input h-20 resize-none" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="¿Qué busca el grupo?" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#94A3B8] mb-1.5 uppercase tracking-wider">Máx. miembros</label>
            <input className="input" type="number" min={2} max={6} value={form.max_members}
              onChange={e => setForm(f => ({ ...f, max_members: parseInt(e.target.value) }))} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-[#F1F5F9]">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
            <button onClick={handleCreate} className="btn-primary">Crear grupo</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function GroupCard({ group, isOwn, onJoin, onView, requesting }) {
  const pct = Math.round((group.current_members / group.max_members) * 100)
  const isFull = group.current_members >= group.max_members

  return (
    <div
      className="bg-white border border-[#F1F5F9] rounded-2xl p-4 sm:p-5
        hover:border-[#BFDBFE] hover:shadow-[0_4px_20px_rgba(37,99,200,0.08)]
        transition-all cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isOwn && (
              <span className="text-[10px] font-bold bg-[#EFF6FF] text-[#2563C8] px-2 py-0.5 rounded-full uppercase tracking-wide">
                Mi grupo
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide
              ${group.status === 'open'
                ? 'bg-[#F0FDF4] text-[#16A34A]'
                : 'bg-[#F8FAFF] text-[#94A3B8]'}`}>
              {group.status === 'open' ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
          <h3 className="font-bold text-[#1E293B] text-base truncate group-hover:text-[#2563C8] transition-colors">
            {group.name}
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">{group.city}</p>
        </div>
        <ChevronRight size={16} className="text-[#CBD5E1] flex-shrink-0 mt-1 group-hover:text-[#2563C8] transition-colors" />
      </div>

      {group.description && (
        <p className="text-sm text-[#64748B] mb-3 line-clamp-2 leading-relaxed">{group.description}</p>
      )}

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-[#64748B] font-medium flex items-center gap-1">
            <Users size={11} /> {group.current_members} / {group.max_members} miembros
          </span>
          <span className={`font-bold ${isFull ? 'text-[#F5A623]' : 'text-[#16A34A]'}`}>
            {isFull ? 'Completo' : `${group.max_members - group.current_members} lugar${group.max_members - group.current_members !== 1 ? 'es' : ''} libre`}
          </span>
        </div>
        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isFull ? 'bg-[#F5A623]' : 'bg-[#2563C8]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!isOwn && !isFull && (
        <button
          onClick={e => { e.stopPropagation(); onJoin() }}
          disabled={requesting}
          className="w-full py-2 rounded-xl border-2 border-[#2563C8] text-[#2563C8] text-sm font-bold
            hover:bg-[#2563C8] hover:text-white transition-all active:scale-95 disabled:opacity-50"
        >
          {requesting ? 'Enviando...' : 'Solicitar ingreso'}
        </button>
      )}
    </div>
  )
}

export default GroupsPage
