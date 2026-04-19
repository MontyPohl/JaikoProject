import axios from 'axios'
import storage from '../utils/storage'

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
  : 'http://192.168.0.17:5000/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItem('jaiko_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (e) {
    // silencioso
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await storage.removeItem('jaiko_token')
      onUnauthorized()
    }
    return Promise.reject(err)
  }
)

export async function getRoomies(city = 'Asunción') {
  const token = await storage.getItem('jaiko_token')
  if (!token) return []

  try {
    const response = await api.get('/profiles/search', {
      params: { city, per_page: 100, page: 1 },
    })

    return (response.data.profiles || [])
      .filter((r) => r.lat != null && r.lng != null && isFinite(r.lat) && isFinite(r.lng))
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
    return []
  }
}

export async function updateProfile(data) {
  try {
    const response = await api.put('/profiles/me', data)
    return response.data
  } catch (err) {
    throw err
  }
}

export default api