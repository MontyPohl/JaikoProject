import { io } from 'socket.io-client'

let socket = null
const connectListeners = new Set()

// connectSocket ahora recibe el token como parámetro.
// Ya no lo lee de localStorage porque:
//   1. En web, el token ya no está en localStorage (cookie httpOnly)
//   2. El caller (authStore) tiene el token en su estado de Zustand
//      y lo pasa directamente acá.
// Esto también elimina el acoplamiento entre socket.js y localStorage.
export const connectSocket = (token) => {
  if (!token || socket) return

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

  socket = io(backendUrl, {
    // El token viaja en auth{}, no en query params (fix de Fase 2).
    // Recibimos el token como parámetro — viene del estado de Zustand,
    // nunca de localStorage.
    auth: { token },
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

  socket.on('disconnect', (reason) =>
    console.log('🔴 Socket disconnected:', reason)
  )
  socket.on('connect_error', (e) =>
    console.error('Socket error:', e.message)
  )

  return socket
}

export const getSocket = () => socket

export const onSocketConnect = (fn) => {
  if (socket?.connected) {
    fn(socket)
  }
  connectListeners.add(fn)
  return () => connectListeners.delete(fn)
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
  connectListeners.clear()
}