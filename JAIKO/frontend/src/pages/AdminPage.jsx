import { useState, useEffect } from 'react'
import {
  Users, FileWarning, BarChart3, ShieldX, ShieldCheck, Eye,
  CheckCircle2, XCircle, Loader2, TrendingUp, Home, UsersRound,
  AlertTriangle, Ban, AlertCircle, CheckCheck, Search, X,
} from 'lucide-react'
import api from '../services/api'
import { Badge, Spinner } from '../components/ui'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const TABS = ['Estadísticas', 'Reportes', 'Usuarios', 'Verificaciones']

export default function AdminPage() {
  const [tab, setTab] = useState(0)
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal selfie
  const [selfieModal, setSelfieModal] = useState(null)   // { url, userName, vr }
  const [loadingSelfie, setLoadingSelfie] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Modal advertencia inline en reportes
  const [warnModal, setWarnModal] = useState(null)       // { id, note }

  // Búsqueda de usuarios
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, reportsRes, usersRes, verifsRes] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/reports?status=open'),
          api.get('/admin/users'),
          api.get('/verification/pending'),
        ])
        setStats(statsRes.data || {})
        setReports(reportsRes.data?.reports || [])
        setUsers(usersRes.data?.users || [])
        setVerifications(verifsRes.data?.pending || [])
      } catch (e) {
        toast.error('Error cargando datos de administración')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  /* ── Reportes ─────────────────────────────────────────────────────────── */
  const handleReport = async (id, action, status = 'reviewed', adminNote = '') => {
    try {
      await api.put(`/admin/reports/${id}`, { action, status, admin_note: adminNote })
      setReports(r => r.filter(rep => rep.id !== id))
      toast.success('Acción aplicada')
    } catch {
      toast.error('Error')
    }
  }

  /* ── Usuarios ─────────────────────────────────────────────────────────── */
  const handleUserStatus = async (userId, status) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { status })
      setUsers(us => us.map(u => u.id === userId ? { ...u, status } : u))
      toast.success('Estado actualizado')
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  /* ── Verificaciones ───────────────────────────────────────────────────── */
  const handleVerSelfie = async (vr) => {
    setLoadingSelfie(vr.id)
    try {
      const { data } = await api.get(`/verification/${vr.id}/selfie-url`)
      setSelfieModal({ url: data.signed_url, userName: vr.user_name || `Usuario #${vr.user_id}`, vr })
      setRejectReason('')
    } catch {
      toast.error('No se pudo obtener la selfie')
    } finally {
      setLoadingSelfie(null)
    }
  }

  const handleReview = async (vrId, action, reason = '') => {
    try {
      await api.put(`/verification/${vrId}/review`, { action, reason })
      setVerifications(v => v.filter(x => x.id !== vrId))
      setSelfieModal(null)
      toast.success(action === 'approve' ? '✅ Verificación aprobada' : '❌ Verificación rechazada')
    } catch {
      toast.error('Error al procesar')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const pendingCount = verifications?.length || 0

  /* ── Usuarios filtrados ───────────────────────────────────────────────── */
  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    return (
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      String(u.id).includes(q)
    )
  })

  /* ── Helpers de UI ───────────────────────────────────────────────────── */
  const statusBadge = (status) => {
    const map = {
      active: 'bg-green-100 text-green-700',
      blocked: 'bg-red-100 text-red-600',
      warned: 'bg-yellow-100 text-yellow-700',
    }
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
        {status ?? 'desconocido'}
      </span>
    )
  }

  const roleBadge = (role) => {
    const map = {
      admin: 'bg-purple-100 text-purple-700',
      verifier: 'bg-blue-100 text-blue-700',
      user: 'bg-gray-100 text-gray-500',
    }
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[role] ?? 'bg-gray-100 text-gray-500'}`}>
        {role ?? 'user'}
      </span>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-dark flex items-center justify-center">
          <ShieldX size={20} className="text-primary-400" />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-3xl">Panel de Administración</h1>
          <p className="text-orange-400 text-sm">Gestión de JAIKO!</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b border-orange-100 pb-0">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`relative px-4 py-2.5 font-semibold text-sm rounded-t-xl transition-all
              ${tab === i
                ? 'bg-blue-500 text-white border border-orange-400 border-[1px]'
                : 'text-orange-400 border border-transparent hover:text-primary-500'}`}
          >
            {t}
            {i === 3 && pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ESTADÍSTICAS ────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Usuarios */}
            <div className="card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Usuarios</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <UsersRound size={16} className="text-blue-500" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-gray-800">{stats?.users?.total ?? 0}</p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12} />Activos</span>
                  <span className="font-semibold">{stats?.users?.active ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-red-500"><Ban size={12} />Bloqueados</span>
                  <span className="font-semibold">{stats?.users?.blocked ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Listings */}
            <div className="card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Listings</span>
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Home size={16} className="text-orange-500" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-gray-800">{stats?.listings?.total ?? 0}</p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12} />Activos</span>
                  <span className="font-semibold">{stats?.listings?.active ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-blue-600"><TrendingUp size={12} />Ingresos</span>
                  <span className="font-semibold">
                    ₲ {((stats?.listings?.total_income ?? 0) / 1_000_000).toFixed(1)}M
                  </span>
                </div>
              </div>
            </div>

            {/* Grupos */}
            <div className="card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Grupos</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Users size={16} className="text-purple-500" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-gray-800">{stats?.groups?.total ?? 0}</p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12} />Abiertos</span>
                  <span className="font-semibold">{stats?.groups?.open ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-400"><XCircle size={12} />Cerrados</span>
                  <span className="font-semibold">
                    {(stats?.groups?.total ?? 0) - (stats?.groups?.open ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Reportes */}
            <div className="card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reportes</span>
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <FileWarning size={16} className="text-red-500" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-gray-800">{stats?.reports?.total ?? 0}</p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} />Abiertos</span>
                  <span className="font-semibold">{stats?.reports?.open ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12} />Revisados</span>
                  <span className="font-semibold">{stats?.reports?.reviewed ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen rápido */}
          <div className="card p-5">
            <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-4">Resumen de actividad</h2>
            <div className="grid grid-cols-3 divide-x divide-orange-100 text-center">
              <div className="px-4">
                <p className="text-2xl font-extrabold text-blue-500">{stats?.users?.active ?? 0}</p>
                <p className="text-xs text-gray-400 mt-1">Usuarios activos</p>
              </div>
              <div className="px-4">
                <p className="text-2xl font-extrabold text-orange-500">{stats?.listings?.active ?? 0}</p>
                <p className="text-xs text-gray-400 mt-1">Listings publicados</p>
              </div>
              <div className="px-4">
                <p className="text-2xl font-extrabold text-red-500">{stats?.reports?.open ?? 0}</p>
                <p className="text-xs text-gray-400 mt-1">Reportes pendientes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORTES ────────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div className="space-y-4">
          {(!reports || reports.length === 0) ? (
            <div className="card text-center py-16">
              <FileWarning size={48} className="text-orange-400 mx-auto mb-3" />
              <p className="font-display font-bold text-lg text-orange-600">De momento no hay reportes</p>
              <p className="text-gray-400 text-sm mt-1">Los reportes aparecerán aquí cuando se generen.</p>
            </div>
          ) : (
            reports.map(r => (
              <div key={r.id} className="card p-4 border border-orange-100 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm">Reporte #{r?.id}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Motivo: <span className="text-gray-600 font-medium">{r?.reason ?? 'Sin motivo'}</span>
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide
                    ${r?.status === 'open' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                    {r?.status ?? 'desconocido'}
                  </span>
                </div>

                {r?.description && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{r.description}</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  {r?.reported_user_id && (
                    <span className="flex items-center gap-1">
                      <Users size={11} /> Usuario reportado: <strong className="text-gray-600">#{r.reported_user_id}</strong>
                    </span>
                  )}
                  {r?.reporter_id && (
                    <span className="flex items-center gap-1">
                      <AlertCircle size={11} /> Reportado por: <strong className="text-gray-600">#{r.reporter_id}</strong>
                    </span>
                  )}
                  {r?.reported_listing_id && (
                    <span className="flex items-center gap-1">
                      <Home size={11} /> Listing: <strong className="text-gray-600">#{r.reported_listing_id}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-orange-50">
                  {r?.reported_user_id && (
                    <button
                      onClick={() => handleReport(r.id, 'block', 'reviewed')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                      <Ban size={13} /> Bloquear usuario
                    </button>
                  )}
                  {r?.reported_user_id && (
                    <button
                      onClick={() => setWarnModal(warnModal?.id === r.id ? null : { id: r.id, note: '' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold hover:bg-yellow-100 transition-colors">
                      <AlertTriangle size={13} /> Advertir
                    </button>
                  )}
                  <button
                    onClick={() => handleReport(r.id, 'dismiss', 'reviewed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-semibold hover:bg-gray-200 transition-colors ml-auto">
                    <XCircle size={13} /> Descartar
                  </button>
                </div>

                {warnModal?.id === r.id && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-yellow-700">Nota de advertencia para el usuario:</p>
                    <textarea
                      rows={2}
                      placeholder="Describe la razón de la advertencia..."
                      value={warnModal.note}
                      onChange={e => setWarnModal(w => ({ ...w, note: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-yellow-300 bg-white px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setWarnModal(null)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50">
                        Cancelar
                      </button>
                      <button
                        onClick={() => { handleReport(r.id, 'warn', 'reviewed', warnModal.note); setWarnModal(null) }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500 text-white font-semibold hover:bg-yellow-600">
                        Enviar advertencia
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── USUARIOS ────────────────────────────────────────────────────── */}
      {tab === 2 && (
        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre, email o ID..."
              className="input pl-9 pr-9 w-full"
            />
            {userSearch && (
              <button
                onClick={() => setUserSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="text-xs text-gray-400 font-semibold px-1">
            {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
          </div>

          {filteredUsers.length === 0 ? (
            <div className="card text-center py-16">
              <Users size={48} className="text-orange-200 mx-auto mb-3" />
              <p className="font-display font-bold text-lg text-orange-400">Sin usuarios</p>
              <p className="text-gray-400 text-sm mt-1">
                {userSearch ? 'No hay resultados para esa búsqueda.' : 'No hay usuarios registrados aún.'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-100 bg-orange-50/60">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Rol</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Registro</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-orange-50/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* Avatar fallback */}
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-200 to-primary-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-700">
                            {(u.name || u.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate max-w-[140px]">
                              {u.name || <span className="text-gray-400 italic">Sin nombre</span>}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[140px]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{roleBadge(u.role)}</td>
                      <td className="px-4 py-3">{statusBadge(u.status)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                        {u.created_at
                          ? formatDistanceToNow(new Date(u.created_at), { locale: es, addSuffix: true })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.status !== 'active' && (
                            <button
                              onClick={() => handleUserStatus(u.id, 'active')}
                              title="Activar"
                              className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {u.status !== 'warned' && u.role !== 'admin' && (
                            <button
                              onClick={() => handleUserStatus(u.id, 'warned')}
                              title="Advertir"
                              className="p-1.5 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
                            >
                              <AlertTriangle size={14} />
                            </button>
                          )}
                          {u.status !== 'blocked' && u.role !== 'admin' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`¿Bloquear a ${u.name || u.email}?`)) {
                                  handleUserStatus(u.id, 'blocked')
                                }
                              }}
                              title="Bloquear"
                              className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VERIFICACIONES ──────────────────────────────────────────────── */}
      {tab === 3 && (
        <div className="space-y-4">
          {(!verifications || verifications.length === 0) ? (
            <div className="card text-center py-16">
              <ShieldCheck size={48} className="text-emerald-300 mx-auto mb-3" />
              <p className="font-display font-bold text-lg text-emerald-600">Sin verificaciones pendientes</p>
              <p className="text-gray-400 text-sm mt-1">Cuando alguien suba una selfie aparecerá aquí.</p>
            </div>
          ) : (
            verifications.map(vr => (
              <div key={vr.id} className="card p-4 border border-orange-100 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-bold text-sm">
                      {vr.user_name || `Usuario #${vr.user_id}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Código: <span className="font-mono font-bold text-brand-dark">{vr.verification_code}</span>
                    </p>
                    {vr.created_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Solicitado {formatDistanceToNow(new Date(vr.created_at), { locale: es, addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-yellow-100 text-yellow-700">
                    pendiente
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-orange-50">
                  {/* Ver selfie */}
                  <button
                    onClick={() => handleVerSelfie(vr)}
                    disabled={loadingSelfie === vr.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-60"
                  >
                    {loadingSelfie === vr.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Eye size={13} />}
                    Ver selfie
                  </button>

                  {/* Aprobar directo (sin ver selfie) */}
                  <button
                    onClick={() => handleReview(vr.id, 'approve')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 size={13} /> Aprobar
                  </button>

                  {/* Rechazar directo */}
                  <button
                    onClick={() => {
                      const reason = window.prompt('Motivo de rechazo (opcional):') ?? ''
                      handleReview(vr.id, 'reject', reason)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors ml-auto"
                  >
                    <XCircle size={13} /> Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODAL SELFIE ────────────────────────────────────────────────── */}
      {selfieModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelfieModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-extrabold text-xl">Selfie de verificación</h2>
                <p className="text-sm text-orange-400">{selfieModal.userName}</p>
              </div>
              <button
                onClick={() => setSelfieModal(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Código */}
            <div className="bg-gray-900 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-gray-400 mb-1">Código esperado</p>
              <p className="font-mono font-extrabold text-2xl text-primary-400 tracking-widest">
                {selfieModal.vr.verification_code}
              </p>
            </div>

            {/* Imagen */}
            <div className="rounded-xl overflow-hidden border-2 border-orange-100 bg-gray-50 max-h-80">
              <img
                src={selfieModal.url}
                alt="Selfie de verificación"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Input motivo rechazo */}
            <div>
              <label className="block text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">
                Motivo de rechazo (opcional)
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Ej: El código no es visible en la imagen"
                className="input w-full text-sm"
              />
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2 border-t border-orange-100">
              <button
                onClick={() => handleReview(selfieModal.vr.id, 'reject', rejectReason)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200"
              >
                <XCircle size={15} /> Rechazar
              </button>
              <button
                onClick={() => handleReview(selfieModal.vr.id, 'approve')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <CheckCircle2 size={15} /> Aprobar verificación
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}