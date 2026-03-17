import { useState, useEffect } from 'react'
import { Users, FileWarning, BarChart3, ShieldX, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import { Badge, Spinner } from '../components/ui'
import { toast } from 'react-hot-toast'

const TABS = ['Estadísticas', 'Reportes', 'Usuarios']

export default function AdminPage() {
  const [tab, setTab] = useState(0)
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data))
    api.get('/admin/reports?status=open').then(({ data }) => setReports(data.reports))
    api.get('/admin/users').then(({ data }) => setUsers(data.users))
      .finally(() => setLoading(false))
  }, [])

  const handleReport = async (id, action, status = 'reviewed') => {
    try {
      await api.put(`/admin/reports/${id}`, { action, status })
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

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  // Separar admin y usuarios normales, pero sin alterar IDs de los demás
  const adminUser = users.find(u => u.role === 'admin')
  const normalUsers = users.filter(u => u.role !== 'admin')

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-dark flex items-center justify-center">
          <ShieldX size={20} className="text-primary-400" />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-3xl">Panel de Administración</h1>
          <p className="text-orange-400 text-sm">Gestión de JAIKO!</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-orange-100 pb-0">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2.5 font-semibold text-sm rounded-t-xl transition-all
              ${tab === i
                ? 'bg-blue-500 text-white border border-orange-400 border-[1px]'
                : 'text-orange-400 border border-transparent hover:text-primary-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* USERS */}
      {tab === 2 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-orange-50 text-orange-500 font-semibold text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {/* 🔥 ADMIN ARRIBA DEL TODO */}
              {adminUser && (
                <tr key={adminUser.id} className="border-t border-orange-50 bg-yellow-50">
                  <td className="px-4 py-3 font-mono text-xs text-orange-400">Admin</td>
                  <td className="px-4 py-3">{adminUser.email}</td>
                  <td className="px-4 py-3"><Badge variant="dark">{adminUser.role}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={adminUser.status === 'active' ? 'green' : 'red'}>{adminUser.status}</Badge></td>
                  <td className="px-4 py-3">{/* Bloquear oculto para admin */}</td>
                </tr>
              )}

              {/* 🔥 RESTO DE USUARIOS EN ORDEN ORIGINAL */}
              {normalUsers.map(u => (
                <tr key={u.id} className="border-t border-orange-50 hover:bg-orange-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-orange-400">#{u.id}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3"><Badge variant="gray">{u.role}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.status !== 'blocked' && (
                        <button
                          onClick={() => handleUserStatus(u.id, 'blocked')}
                          className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-lg font-semibold"
                        >
                          Bloquear
                        </button>
                      )}
                      {u.status !== 'active' && (
                        <button
                          onClick={() => handleUserStatus(u.id, 'active')}
                          className="text-xs bg-emerald-100 text-emerald-600 hover:bg-emerald-200 px-2 py-1 rounded-lg font-semibold"
                        >
                          Activar
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
  )
}