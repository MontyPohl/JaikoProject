// GroupsPage.jsx
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import api from '../services/api'
import { Badge, Spinner, EmptyState, Modal } from '../components/ui'
import { toast } from 'react-hot-toast'

export function GroupsPage() {
  const [groups, setGroups]     = useState([])
  const [myGroups, setMyGroups] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', city: 'Asunción', max_members: 3 })
  const [requestingGroupId, setRequestingGroupId] = useState(null) // para bloquear botón individual
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

  // NUEVA FUNCIÓN para solicitar ingreso (join-request)
  const handleRequestJoin = async (id) => {
    try {
      setRequestingGroupId(id)
      await api.post(`/groups/${id}/join-request`)
      toast.success('Solicitud enviada al grupo')
      load() // recargar grupos
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al enviar solicitud')
    } finally {
      setRequestingGroupId(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-3xl">Grupos</h1>
          <p className="text-orange-400 text-sm mt-1">Armá equipo para buscar departamento juntos</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Crear grupo
        </button>
      </div>

      {myGroups.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display font-bold text-xl mb-4">Mis grupos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myGroups.map(g => <GroupCard key={g.id} group={g} isOwn onView={() => navigate(`/groups/${g.id}`)} />)}
          </div>
        </div>
      )}

      <h2 className="font-display font-bold text-xl mb-4">Grupos abiertos</h2>
      {groups.length === 0 ? (
        <EmptyState icon="👥" title="No hay grupos abiertos" description="Creá el primero." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(g => (
            <GroupCard 
              key={g.id} 
              group={g} 
              onJoin={() => handleRequestJoin(g.id)} 
              onView={() => navigate(`/groups/${g.id}`)}
              requesting={requestingGroupId === g.id}
            />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear grupo">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Buscamos 2 roomies" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Descripción</label>
            <textarea className="input h-20 resize-none" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="¿Qué busca el grupo?" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-orange-400 mb-1 uppercase tracking-wide">Máx. miembros</label>
            <input className="input" type="number" min={2} max={6} value={form.max_members}
              onChange={e => setForm(f => ({ ...f, max_members: parseInt(e.target.value) }))} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
            <button onClick={handleCreate} className="btn-primary">Crear</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function GroupCard({ group, isOwn, onJoin, onView, requesting }) {
  const pct = Math.round((group.current_members / group.max_members) * 100)
  return (
    <div className="card hover:shadow-md transition-all cursor-pointer" onClick={onView}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display font-bold text-lg">{group.name}</h3>
          <p className="text-sm text-orange-400">{group.city}</p>
        </div>
        <Badge variant={group.status === 'open' ? 'green' : 'gray'}>{group.status}</Badge>
      </div>
      {group.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{group.description}</p>}
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-orange-400" />
        <span className="text-sm text-orange-500">{group.current_members} / {group.max_members} miembros</span>
        <div className="flex-1 h-1.5 bg-orange-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {!isOwn && !group.is_full && (
        <button 
          onClick={e => { e.stopPropagation(); onJoin() }} 
          className="btn-secondary text-sm py-1.5 w-full mt-1"
          disabled={requesting}
        >
          <Users size={14} className="inline" /> {requesting ? 'Enviando solicitud...' : 'Solicitar ingreso'}
        </button>
      )}
    </div>
  )
}

export default GroupsPage