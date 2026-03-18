import { io } from 'socket.io-client'

let socket = null
const connectListeners = new Set()

export const connectSocket = () => {
  const token = localStorage.getItem('jaiko_token')
  if (!token || socket) return

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
  socket = io(backendUrl, {
    query: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    // MEJORA: tiempo entre reintentos de reconexión (en ms)
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    console.log('🟢 Socket connected')
    // Notificar a todos los suscriptores que el socket ya está listo
    connectListeners.forEach(fn => fn(socket))
  })

  // MEJORA: al reconectarse (por corte de red, etc.) re-notificar suscriptores
  socket.on('reconnect', () => {
    console.log('🔄 Socket reconnected')
    connectListeners.forEach(fn => fn(socket))
  })

  socket.on('disconnect', (reason) => console.log('🔴 Socket disconnected:', reason))
  socket.on('connect_error', (e) => console.error('Socket error:', e.message))

  return socket
}

export const getSocket = () => socket

/**
 * Suscribirse al evento de conexión del socket.
 * Si el socket ya está conectado, llama fn inmediatamente.
 * Devuelve una función para cancelar la suscripción.
 *
 * CORRECCIÓN: el listener queda registrado en connectListeners para que
 * también se ejecute en reconexiones futuras (no solo la primera conexión).
 */
export const onSocketConnect = (fn) => {
  if (socket?.connected) {
    fn(socket)
  }
  // Siempre registramos el listener para manejar reconexiones
  connectListeners.add(fn)
  return () => connectListeners.delete(fn)
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
  // Limpiar listeners para evitar memory leaks al cerrar sesión
  connectListeners.clear()
}