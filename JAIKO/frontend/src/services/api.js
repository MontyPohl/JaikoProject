import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT from localStorage automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jaiko_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jaiko_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/**
 * Trae todos los roomies para mostrar en el mapa.
 * Cada roomie debe incluir:
 *   - lat, lng
 *   - profile: objeto completo del usuario
 *   - compatibility: número (0-100)
 *   - matches: array de strings
 *   - mismatches: array de strings
 */
export async function getRoomies() {
  try {
    const response = await api.get('/roomies') // Ajusta la ruta según tu backend
    const data = response.data

    // Mapear al formato que JaikoMap y ProfileCard esperan
    return data.map((r) => ({
      id: r.user_id,
      lat: r.lat,
      lng: r.lng,
      profile: r,
      compatibility: r.compatibility,
      matches: r.matches || [],
      mismatches: r.mismatches || [],
    }))
  } catch (error) {
    console.error('Error al traer roomies:', error)
    return []
  }
}

/**
 * Actualiza el perfil del usuario autenticado
 * data debe incluir los campos del formulario, incluyendo city/ubicación
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