import { create } from 'zustand'
import api from '../services/api'
import storage from '../utils/storage'
import { connectSocket, disconnectSocket } from '../services/socket'

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  token: null,
  loading: false,
  isNewUser: false,

  register: async ({ name, email, password, captcha_token }) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/register', {
        name, email, password, captcha_token,
      })
      await storage.setItem('jaiko_token', data.access_token)
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
      await storage.setItem('jaiko_token', data.access_token)
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
      await storage.setItem('jaiko_token', data.access_token)
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

  fetchMe: async () => {
    const token = await storage.getItem('jaiko_token')

    if (!token || isTokenExpired(token)) {
      await storage.removeItem('jaiko_token')
      set({ token: null, user: null, profile: null, loading: false })
      return
    }

    set({ loading: true })
    try {
      const { data } = await api.get('/auth/me')
      set({
        token,
        user: data.user,
        profile: data.profile,
        loading: false,
      })
      connectSocket()
    } catch {
      await storage.removeItem('jaiko_token')
      set({ loading: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // silencioso
    } finally {
      await storage.removeItem('jaiko_token')
      disconnectSocket()
      set({ user: null, profile: null, token: null })
    }
  },

  updateProfile: (profile) => set({ profile }),

  isAuthenticated: () => {
    const token = get().token
    if (!token) return false
    if (isTokenExpired(token)) {
      storage.removeItem('jaiko_token')
      set({ token: null, user: null, profile: null })
      return false
    }
    return true
  },

  isAdmin: () => get().user?.role === 'admin',
  isVerifier: () => ['admin', 'verifier'].includes(get().user?.role),
}))

export default useAuthStore