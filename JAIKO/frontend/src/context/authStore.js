import { create } from 'zustand'
import api from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  token: localStorage.getItem('jaiko_token') || null,
  loading: false,
  isNewUser: false,

  // ── Registro con email + contraseña + nombre ──────────────────────────────
  register: async ({ name, email, password }) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/register', { name, email, password })
      localStorage.setItem('jaiko_token', data.access_token)
      set({
        token: data.access_token,
        user: data.user,
        profile: data.profile || null,
        loading: false,
      })
      connectSocket()
      return { success: true }
    } catch (err) {
      set({ loading: false })
      return { success: false, error: err.response?.data?.error }
    }
  },

  // ── Login con email + contraseña ──────────────────────────────────────────
  login: async ({ email, password }) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('jaiko_token', data.access_token)
      set({
        token: data.access_token,
        user: data.user,
        profile: data.profile || null,
        loading: false,
      })
      connectSocket()
      return { success: true, role: data.user?.role }
    } catch (err) {
      set({ loading: false })
      return { success: false, error: err.response?.data?.error }
    }
  },

  // ── Login con Google ──────────────────────────────────────────────────────
  loginWithGoogle: async (idToken) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/google', { id_token: idToken })
      localStorage.setItem('jaiko_token', data.access_token)
      set({
        token: data.access_token,
        user: data.user,
        profile: data.profile,
        isNewUser: data.is_new_user,
        loading: false,
      })
      connectSocket()
      return { success: true, isNewUser: data.is_new_user, role: data.user?.role }
    } catch (err) {
      set({ loading: false })
      return { success: false, error: err.response?.data?.error }
    }
  },

  // ── Obtener usuario actual ────────────────────────────────────────────────
  fetchMe: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data.user, profile: data.profile, loading: false })
      connectSocket()
    } catch {
      set({ loading: false })
      localStorage.removeItem('jaiko_token')
    }
  },

  updateProfile: (profile) => set({ profile }),

  logout: () => {
    localStorage.removeItem('jaiko_token')
    disconnectSocket()
    set({ user: null, profile: null, token: null })
  },

  isAuthenticated: () => !!get().token,
  isAdmin: () => get().user?.role === 'admin',
  isVerifier: () => ['admin', 'verifier'].includes(get().user?.role),
}))

export default useAuthStore