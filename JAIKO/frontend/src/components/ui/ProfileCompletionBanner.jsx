// ProfileCompletionBanner.jsx
// Banner pegajoso que aparece en todas las páginas si el usuario
// no completó los campos obligatorios del perfil.
//
// ¿Por qué estos 3 campos?
//   - name:   sin nombre no podés aparecer en búsquedas
//   - age:    sin edad no podés ser filtrado correctamente
//   - gender: sin género los filtros de compatibilidad no funcionan
//   city tiene default 'Asunción' así que siempre tiene valor.

import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import useAuthStore from '../../context/authStore'

// ── Qué campos son obligatorios y cómo se llaman en pantalla ──────────────────
const REQUIRED_FIELDS = [
  { key: 'name',   label: 'nombre'  },
  { key: 'age',    label: 'edad'    },
  { key: 'gender', label: 'sexo'    },
]

// ── Páginas donde el banner NO debe mostrarse ─────────────────────────────────
// (auth, la propia pantalla de edición, y la home pública)
const HIDDEN_PATHS = ['/', '/login', '/register', '/profile/edit']

/**
 * Devuelve true si el perfil está completo (todos los campos obligatorios OK).
 * Acepta 0, false y otros valores falsy como válidos.
 * Solo bloquea: null, undefined y string vacío.
 */
function isProfileComplete(profile) {
  if (!profile) return false
  return REQUIRED_FIELDS.every(({ key }) => {
    const val = profile[key]
    return val !== null && val !== undefined && val !== ''
  })
}

export default function ProfileCompletionBanner() {
  const { user, profile, isAuthenticated } = useAuthStore()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)

  // No mostrar si: no está logueado, ruta excluida, perfil completo o ya cerró
  if (!isAuthenticated() || !user) return null
  if (HIDDEN_PATHS.includes(location.pathname)) return null
  if (isProfileComplete(profile)) return null
  if (dismissed) return null

  // Qué campos faltan puntualmente
  const missing = REQUIRED_FIELDS
    .filter(({ key }) => {
      const val = profile?.[key]
      return val === null || val === undefined || val === ''
    })
    .map(({ label }) => label)

  return (
    <div
      role="alert"
      className="w-full bg-orange-500 text-white px-4 py-3
        flex items-center justify-between gap-3
        border-b border-orange-600/30"
    >
      {/* Ícono + mensaje */}
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle
          size={18}
          className="flex-shrink-0 text-orange-100"
          aria-hidden
        />
        <p className="text-sm font-bold leading-tight">
          <span className="hidden sm:inline">
            Tu perfil está incompleto — falta: {missing.join(', ')}.{' '}
          </span>
          <span className="sm:hidden">
            Perfil incompleto ({missing.join(', ')}).{' '}
          </span>
          <span className="font-normal opacity-90">
            Completalo para usar todas las funciones de Jaiko.
          </span>
        </p>
      </div>

      {/* Botón + cerrar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          to="/profile/edit"
          className="inline-flex items-center gap-1
            bg-white text-orange-500 font-extrabold text-xs
            px-3 py-1.5 rounded-xl
            hover:bg-orange-50 active:scale-95
            transition-all duration-150"
        >
          Completar
          <ChevronRight size={13} />
        </Link>

        {/* Botón para cerrar el banner SOLO en esta sesión */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="p-1 rounded-lg text-orange-100
            hover:text-white hover:bg-orange-600/50
            transition-colors duration-150"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
