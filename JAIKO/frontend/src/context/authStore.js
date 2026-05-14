import { create } from 'zustand'
import api from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'

// isTokenExpired ya no es necesaria para la web:
// el servidor maneja la expiración de la cookie.
// La mantenemos solo para compatibilidad con mobile (shared store).

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  // socketToken: vive SOLO en memoria (Zustand state).
  // NO se persiste en localStorage. Se pierde al recargar la página,
  // pero fetchMe() lo renueva desde el servidor automáticamente.
  // Se usa exclusivamente para autenticar la conexión WebSocket.
  socketToken: null,
  loading: false,
  isNewUser: false,

  register: async ({ name, email, password, captcha_token }) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/register', {
        name, email, password, captcha_token,
      })
      // El servidor seteó la cookie httpOnly automáticamente.
      // Nosotros solo guardamos en estado lo que necesitamos en JS.
      set({
        socketToken: data.socket_token,   // Para WebSocket, solo en memoria
        user: data.user,
        profile: data.profile || null,
        loading: false,
      })
      connectSocket(data.socket_token)
      return { success: true }
    } catch (err) {
      set({ loading: false })
      const mensaje = err.response?.status === 429
        ? 'Demasiados intentos. Esperá un minuto e intentá de nuevo.'
        : err.response?.data?.error
      return { success: false, error: mensaje }
    }
  },

  login: async ({ email, password }) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      set({
        socketToken: data.socket_token,
        user: data.user,
        profile: data.profile || null,
        loading: false,
      })
      connectSocket(data.socket_token)
      return { success: true, role: data.user?.role }
    } catch (err) {
      set({ loading: false })
      const mensaje = err.response?.status === 429
        ? 'Demasiados intentos. Esperá un minuto e intentá de nuevo.'
        : err.response?.data?.error
      return { success: false, error: mensaje }
    }
  },

  loginWithGoogle: async (idToken) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/google', { id_token: idToken })
      set({
        socketToken: data.socket_token,
        user: data.user,
        profile: data.profile,
        isNewUser: data.is_new_user,
        loading: false,
      })
      connectSocket(data.socket_token)
      return { success: true, isNewUser: data.is_new_user, role: data.user?.role }
    } catch (err) {
      set({ loading: false })
      return { success: false, error: err.response?.data?.error }
    }
  },

  fetchMe: async () => {
    // En el nuevo modelo, no hay token en localStorage que verificar.
    // Simplemente le preguntamos al servidor si la cookie sigue siendo válida.
    // Si no lo es, el servidor devuelve 401 y el interceptor de axios
    // redirige al login automáticamente.
    set({ loading: true })
    try {
      const { data } = await api.get('/auth/me')
      set({
        user: data.user,
        profile: data.profile,
        socketToken: data.socket_token,  // El servidor renueva el token
        loading: false,
      })
      if (data.socket_token) {
        connectSocket(data.socket_token)
      }
    } catch {
      // 401 → el interceptor de api.js ya limpia y redirige al login
      set({ loading: false, user: null, profile: null, socketToken: null })
    }
  },

  updateProfile: (profile) => set({ profile }),

  logout: async () => {
    try {
      // El servidor limpia la cookie httpOnly y agrega el token a la blocklist
      await api.post('/auth/logout')
    } catch {
      // Aunque falle, limpiamos el estado local igualmente
    } finally {
      disconnectSocket()
      // Limpiamos todo el estado — la cookie la limpió el servidor
      set({ user: null, profile: null, socketToken: null })
    }
  },

  isAuthenticated: () => {
    // Antes verificábamos el token en localStorage.
    // Ahora la fuente de verdad es si tenemos un usuario cargado en estado.
    // La cookie la verifica el servidor en cada request protegido.
    return get().user !== null
  },

  isAdmin: () => get().user?.role === 'admin',
  isVerifier: () => ['admin', 'verifier'].includes(get().user?.role),
}))

export default useAuthStore