import axios from 'axios'

// 1. Detectamos la URL base según el entorno
// En Railway (Producción), usamos la variable VITE_API_URL que configuramos.
// En Local (Desarrollo), usamos '/api' para que funcione el proxy de vite.config.js.
const isProduction = import.meta.env.PROD;
const BASE_URL = isProduction
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// 2. Adjuntar JWT automáticamente en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jaiko_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 3. Manejar errores 401 (Sesión expirada) globalmente
// ✅ Interceptor actualizado
api.interceptors.request.use((config) => {
  // Para la app web: la cookie httpOnly se envía automáticamente
  // gracias a withCredentials: true — no necesitamos hacer nada acá.
  //
  // Para la app mobile (React Native): sigue enviando el header
  // Authorization porque mobile no usa cookies del browser.
  // La detección es simple: si hay token en localStorage, es mobile.
  const token = localStorage.getItem('jaiko_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Trae roomies compatibles para el mapa.
 */
export async function getRoomies(city = 'Asunción') {
  const token = localStorage.getItem('jaiko_token')
  if (!token) return []

  try {
    const response = await api.get('/profiles/search', {
      params: { city, per_page: 100, page: 1 },
    })

    return (response.data.profiles || [])
      .filter(
        (r) =>
          r.lat != null &&
          r.lng != null &&
          isFinite(r.lat) &&
          isFinite(r.lng)
      )
      .map((r) => ({
        id: r.user_id,
        lat: r.lat,
        lng: r.lng,
        profile: r,
        compatibility: r.compatibility ?? null,
        matches: r.matches || [],
        mismatches: r.mismatches || [],
      }))
  } catch (error) {
    console.error('Error al traer roomies:', error)
    return []
  }
}

/**
 * Actualiza el perfil del usuario autenticado.
 */
export async function updateProfile(data) {
  try {
    const response = await api.put('/profiles/me', data)
    return response.data
  } catch (err) {
    console.error('Error al actualizar perfil:', err)
    throw err
  }
}

export default api
