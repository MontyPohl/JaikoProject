// GroupDetailPage.jsx — Responsive
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, MessageCircle, LogOut, Users, MapPin, Edit2, Save } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../context/authStore'
import { Avatar, Badge, Spinner, EmptyState } from '../components/ui'
import { toast } from 'react-hot-toast'

export default function GroupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [myGroups, setMyGroups] = useState([])
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const loadGroup = api.get(`/groups/${id}`)
    const loadMyGroups = api.get('/groups/my-groups').catch(() => ({ data: { groups: [] } }))

    Promise.all([loadGroup, loadMyGroups])
      .then(([groupRes, myGroupsRes]) => {
        const currentGroup = groupRes.data.group
        const userGroups = myGroupsRes?.data?.groups || []
        setGroup(currentGroup)
        setMyGroups(userGroups)
        setFormData({
          name: currentGroup.name,
          description: currentGroup.description || '',
          city: currentGroup.city,
          status: currentGroup.status,
          budget_max: currentGroup.budget_max || 0,
          pets_allowed: currentGroup.pets_allowed || false,
          smoking_allowed: currentGroup.smoking_allowed || false
        })
        const inAnotherGroup = userGroups.find(g => Number(g.id) !== Number(id))
        if (inAnotherGroup && !currentGroup.members.some(m => m.user_id === user?.id)) {
          navigate(`/groups/${inAnotherGroup.id}`)
        }
      })
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false))
  }, [id, navigate, user?.id])

  const isMember = group?.members?.some(m => m.user_id === user?.id)
  const anotherGroupMembership = myGroups.find(g => Number(g.id) !== Number(id))
  const isInAnotherGroup = Boolean(anotherGroupMembership)
  const currentOtherGroupName = anotherGroupMembership?.name

  const handleRequestJoin = async () => {
    if (isInAnotherGroup) { toast.error('Primero debes salir de tu grupo actual'); return }
    try {
      setRequesting(true)
      await api.post(`/groups/${id}/join-request`)
      const { data } = await api.get(`/groups/${id}`)
      setGroup(data.group)
      const joined = data.group.members.some(m => m.user_id === user?.id && m.status === "active")
      if (joined) {
        toast.success('¡Te uniste al grupo!')
        const { data: chatData } = await api.get('/chats/')
        const groupChat = chatData.chats.find(c => c.group_id === parseInt(id))
        if (groupChat) navigate(`/chat/${groupChat.id}`)
        else toast.error('Chat no encontrado')
      } else {
        toast.success('Solicitud enviada al grupo')
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo enviar la solicitud')
    } finally {
      setRequesting(false)
    }
  }

  const handleLeave = async () => {
    try {
      await api.post(`/groups/${id}/leave`)
      toast.success('Saliste del grupo')
      navigate('/groups')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error')
    }
  }

  const handleOpenChat = async () => {
    try {
      const { data } = await api.get('/chats/')
      const groupChat = data.chats.find(c => c.group_id === parseInt(id))
      if (groupChat) navigate(`/chat/${groupChat.id}`)
      else toast.error('Chat no encontrado')
    } catch { toast.error('Error al abrir chat') }
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    try {
      const { data } = await api.put(`/groups/${id}`, formData)
      setGroup(data.group)
      setEditing(false)
      toast.success('Grupo actualizado')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!group) return null

  const pct = Math.round((group.current_members / group.max_members) * 100)

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
      {!isInAnotherGroup && !isMember && (
        <Link to="/groups"
          className="flex items-center gap-1 text-orange-400 hover:text-primary-600 mb-4 sm:mb-6 text-sm font-semibold transition-colors">
          <ChevronLeft size={16} /> Volver a grupos
        </Link>
      )}

      <div className="card mb-4 sm:mb-6 space-y-4 sm:space-y-6">
        {/* Group header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={group.status === 'open' ? 'green' : 'gray'}>{group.status}</Badge>
              {isMember && <Badge variant="dark">Miembro</Badge>}
            </div>

            {editing ? (
              <div className="space-y-2">
                <input name="name" value={formData.name} onChange={handleFormChange}
                  className="border px-2 py-1 rounded w-full text-sm" placeholder="Nombre del grupo" />
                <input name="city" value={formData.city} onChange={handleFormChange}
                  className="border px-2 py-1 rounded w-full text-sm" placeholder="Ciudad" />
                <textarea name="description" value={formData.description} onChange={handleFormChange}
                  className="border px-2 py-1 rounded w-full text-sm" placeholder="Descripción" rows={2} />
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" name="pets_allowed" checked={formData.pets_allowed} onChange={handleFormChange} />
                    Mascotas
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" name="smoking_allowed" checked={formData.smoking_allowed} onChange={handleFormChange} />
                    Fumadores
                  </label>
                </div>
                <input name="budget_max" type="number" value={formData.budget_max} onChange={handleFormChange}
                  className="border px-2 py-1 rounded w-full text-sm" placeholder="Presupuesto máximo" />
              </div>
            ) : (
              <>
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl truncate">{group.name}</h1>
                <div className="flex items-center gap-1 text-orange-400 text-sm mt-1">
                  <MapPin size={13} /> {group.city}
                </div>
                {group.description && (
                  <p className="text-gray-600 text-sm leading-relaxed mt-2">{group.description}</p>
                )}
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isMember && (
              <button onClick={editing ? handleSave : () => setEditing(e => !e)}
                className="btn-primary flex items-center gap-1.5 text-sm py-2">
                {editing ? <><Save size={13} /> Guardar</> : <><Edit2 size={13} /> Editar</>}
              </button>
            )}
            {isMember && (
              <>
                <button onClick={handleOpenChat} className="btn-primary flex items-center gap-1.5 text-sm py-2">
                  <MessageCircle size={13} /> Chat del grupo
                </button>
                <button onClick={handleLeave}
                  className="btn-secondary flex items-center gap-1.5 text-sm py-2 border-red-300 text-red-500 hover:bg-red-50">
                  <LogOut size={13} /> Salir
                </button>
              </>
            )}
            {!isMember && !isInAnotherGroup && !group.is_full && (
              <button onClick={handleRequestJoin} disabled={requesting}
                className="btn-primary flex items-center gap-1.5 text-sm py-2">
                <Users size={13} /> {requesting ? 'Enviando...' : 'Solicitar ingreso'}
              </button>
            )}
            {!isMember && isInAnotherGroup && (
              <Badge variant="gray" className="text-xs">Salí de {currentOtherGroupName || 'tu grupo'} primero</Badge>
            )}
            {!isMember && !isInAnotherGroup && group.is_full && (
              <Badge variant="gray">Grupo lleno</Badge>
            )}
          </div>
        </div>

        {/* Warning: in another group */}
        {!isMember && isInAnotherGroup && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 sm:px-4 py-3 text-sm text-orange-700">
            Ya perteneces a <span className="font-semibold">{currentOtherGroupName || 'otro grupo'}</span>. Para entrar aquí primero debés salir.
          </div>
        )}

        {/* Members progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-orange-500 flex items-center gap-1">
              <Users size={13} /> {group.current_members} / {group.max_members} miembros
            </span>
            <span className="text-xs text-orange-300">
              {group.max_members - group.current_members} lugar{group.max_members - group.current_members !== 1 ? 'es' : ''} libre{group.max_members - group.current_members !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {group.budget_max && <Badge variant="dark">₲ máx. {(group.budget_max / 1_000_000).toFixed(1)}M</Badge>}
          {group.pets_allowed && <Badge variant="orange">🐾 Mascotas ok</Badge>}
          {group.smoking_allowed && <Badge variant="gray">🚬 Fumadores ok</Badge>}
        </div>

        {/* Members list */}
        <div>
          <h2 className="font-display font-bold text-lg sm:text-xl mb-4">Miembros del grupo</h2>
          {group.members.length === 0 ? (
            <EmptyState icon="👤" title="Sin miembros" />
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {group.members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <Avatar src={m.profile?.profile_photo_url} name={m.profile?.name} size="md" verified={m.profile?.verified} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/profile/${m.user_id}`} className="font-semibold hover:text-primary-600 transition-colors truncate">
                        {m.profile?.name || `Usuario #${m.user_id}`}
                      </Link>
                      {m.role === 'admin' && <Badge variant="dark">Admin</Badge>}
                      {m.profile?.verified && <Badge variant="green">✓</Badge>}
                    </div>
                    {m.profile?.profession && <p className="text-xs text-orange-400 truncate">{m.profile.profession}</p>}
                  </div>
                  {m.user_id !== user?.id && (
                    <Link to={`/profile/${m.user_id}`} className="btn-ghost text-xs py-1.5 px-2.5 flex-shrink-0">Ver</Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending join requests */}
        {isMember && group.join_requests?.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-lg sm:text-xl mb-4">Solicitudes pendientes</h2>
            <div className="space-y-3">
              {group.join_requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 border p-3 rounded-xl flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={req.user.profile?.profile_photo_url} name={req.user.profile?.name} size="md" verified={req.user.profile?.verified} />
                    <div className="min-w-0">
                      <Link to={`/profile/${req.user.id}`} className="font-semibold hover:text-primary-600 transition-colors text-sm truncate block">
                        {req.user.profile?.name || `Usuario #${req.user.id}`}
                      </Link>
                      {req.user.profile?.profession && (
                        <p className="text-xs text-orange-400 truncate">{req.user.profile.profession}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs py-1.5 px-3"
                      onClick={async () => {
                        try {
                          await api.post(`/groups/${id}/join-request/${req.id}/accept`)
                          toast.success('Usuario agregado')
                          const { data } = await api.get(`/groups/${id}`)
                          setGroup(data.group)
                        } catch (e) { toast.error(e.response?.data?.error || 'Error al aceptar') }
                      }}>
                      Aceptar
                    </button>
                    <button className="btn-secondary text-xs py-1.5 px-3"
                      onClick={async () => {
                        try {
                          await api.post(`/groups/${id}/join-request/${req.id}/reject`)
                          toast.success('Solicitud rechazada')
                          const { data } = await api.get(`/groups/${id}`)
                          setGroup(data.group)
                        } catch (e) { toast.error(e.response?.data?.error || 'Error al rechazar') }
                      }}>
                      Denegar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
