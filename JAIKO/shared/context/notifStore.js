import { create } from 'zustand'
import api from '../services/api'

const useNotifStore = create((set, get) => ({
  notifications: [],
  unread: 0,

  fetch: async () => {
    try {
      const { data } = await api.get('/notifications/')
      set({ notifications: data.notifications, unread: data.unread })
    } catch { /* noop */ }
  },

  markRead: async (id) => {
    await api.put(`/notifications/${id}/read`)
    set((s) => ({
      notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      unread: Math.max(0, s.unread - 1),
    }))
  },

  markAllRead: async () => {
    await api.put('/notifications/read-all')
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unread: 0,
    }))
  },

  addRealtime: (notif) => {
    set((s) => ({
      notifications: [notif, ...s.notifications],
      unread: s.unread + 1,
    }))
  },
}))

export default useNotifStore
