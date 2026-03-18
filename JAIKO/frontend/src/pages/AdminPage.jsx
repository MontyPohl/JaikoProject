import { useState, useEffect } from 'react'
import { Users, FileWarning, BarChart3, ShieldX, ShieldCheck, Eye, CheckCircle2, XCircle, Loader2, TrendingUp, Home, UsersRound, AlertTriangle, Ban, AlertCircle, CheckCheck } from 'lucide-react'
import api from '../services/api'
import { Badge, Spinner } from '../components/ui'
import { toast } from 'react-hot-toast'

const TABS = ['Estadísticas', 'Reportes', 'Usuarios', 'Verificaciones']

export default function AdminPage() {
  const [tab, setTab] = useState(0)
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(true)

  const [selfieModal, setSelfieModal] = useState(null)
  const [loadingSelfie, setLoadingSelfie] = useState(null)

  // Para el campo admin_note del modal de advertencia
  const [warnModal, setWarnModal] = useState(null) // { id, note }

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

  const handleReport = async (id, action, status = 'reviewed', adminNote = '') => {
    try {
      await api.put(`/admin/reports/${id}`, { action, status, admin_note: adminNote })
      setReports(r => r.filter(rep => rep.id !== id))
      toast.success('Acción aplicada')
    } catch {
      toast.error('Error')
    }
  }

  const handleUserStatus = async (userId, status) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { status })
      setUsers(us => us.map(u => u.id === userId ? { ...u, status } : u))
      toast.success('Estado actualizado')
    } catch {
      toast.error('Error')
    }
  }

  const handleVerSelfie = async (vr) => {
    setLoadingSelfie(vr.id)
    try {
      const { data } = await api.get(`/verification/${vr.id}/selfie-url`)
      setSelfieModal({ url: data.signed_url, userName: vr.user_name || `Usuario #${vr.user_id}`, vr })
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

  const adminUser = users?.find(u => u.role === 'admin')
  const normalUsers = users?.filter(u => u.role !== 'admin')
  const pendingCount = verifications?.length || 0

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
              ${tab === i ? 'bg-blue-500 text-white border border-orange-400 border-[1px]'
                          : 'text-orange-400 border border-transparent hover:text-primary-500'}`}>
            {t}
            {i === 3 && pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ESTADÍSTICAS ── */}
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
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12}/>Activos</span>
                  <span className="font-semibold">{stats?.users?.active ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-red-500"><Ban size={12}/>Bloqueados</span>
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
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12}/>Activos</span>
                  <span className="font-semibold">{stats?.listings?.active ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-blue-600"><TrendingUp size={12}/>Ingresos</span>
                  <span className="font-semibold">${stats?.listings?.total_income ?? 0}</span>
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
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12}/>Abiertos</span>
                  <span className="font-semibold">{stats?.groups?.open ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-400"><XCircle size={12}/>Cerrados</span>
                  <span className="font-semibold">{(stats?.groups?.total ?? 0) - (stats?.groups?.open ?? 0)}</span>
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
                  <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12}/>Abiertos</span>
                  <span className="font-semibold">{stats?.reports?.open ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-green-600"><CheckCheck size={12}/>Revisados</span>
                  <span className="font-semibold">{stats?.reports?.reviewed ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de actividad rápida */}
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

      {/* ── REPORTES ── */}
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
                {/* Cabecera del reporte */}
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

                {/* Descripción */}
                {r?.description && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    {r.description}
                  </p>
                )}

                {/* Info extra */}
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

                {/* Acciones */}
                <div className="flex items-center gap-2 pt-1 border-t border-orange-50">
                  {/* Bloquear usuario (solo si hay reported_user_id) */}
                  {r?.reported_user_id && (
                    <button
                      onClick={() => handleReport(r.id, 'block', 'reviewed')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                      <Ban size={13} /> Bloquear usuario
                    </button>
                  )}

                  {/* Advertir usuario (abre mini-modal inline) */}
                  {r?.reported_user_id && (
                    <button
                      onClick={() => setWarnModal(warnModal?.id === r.id ? null : { id: r.id, note: '' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold hover:bg-yellow-100 transition-colors">
                      <AlertTriangle size={13} /> Advertir
                    </button>
                  )}

                  {/* Descartar */}
                  <button
                    onClick={() => handleReport(r.id, 'dismiss', 'reviewed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-semibold hover:bg-gray-200 transition-colors ml-auto">
                    <XCircle size={13} /> Descartar
                  </button>
                </div>

                {/* Panel de advertencia inline */}
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
                        onClick={() => {
                          handleReport(r.id, 'warn', 'reviewed', warnModal.note)
                          setWarnModal(null)
                        }}
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

      {/* ── USUARIOS ── EXACTO DEL ORIGINAL */}
      {tab === 2 && (
        <div className="card overflow-hidden p-0">
          {/* TODO: pega tu código original de usuarios aquí tal como estaba */}
        </div>
      )}

      {/* ── VERIFICACIONES ── EXACTO DEL ORIGINAL */}
      {tab === 3 && (
        <div className="space-y-4">
          {/* TODO: pega tu código original de verificaciones aquí tal como estaba */}
        </div>
      )}
    </div>
  )
}