// shared/services/socket.js
import { io } from 'socket.io-client'
import storage from '../utils/storage'

let socket = null
const connectListeners = new Set()

export const connectSocket = async () => {
  const token = await storage.getItem('jaiko_token')  // ← usa storage
  if (!token || socket) return

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL
    || process.env.VITE_BACKEND_URL
    || 'http://localhost:5000'

  socket = io(backendUrl, {
    query: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    console.log('🟢 Socket connected')
    connectListeners.forEach(fn => fn(socket))
  })

  socket.on('reconnect', () => {
    console.log('🔄 Socket reconnected')
    connectListeners.forEach(fn => fn(socket))
  })

  socket.on('disconnect', (reason) => console.log('🔴 Socket disconnected:', reason))
  socket.on('connect_error', (e) => console.error('Socket error:', e.message))

  return socket
}

export const getSocket = () => socket

export const onSocketConnect = (fn) => {
  connectListeners.add(fn)
  if (socket?.connected) fn(socket)
  return () => connectListeners.delete(fn)
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}