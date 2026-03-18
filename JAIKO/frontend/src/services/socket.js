import { io } from 'socket.io-client'

let socket = null
const connectListeners = new Set()

export const connectSocket = () => {
  const token = localStorage.getItem('jaiko_token')
  // Don't recreate if socket already exists (even while connecting)
  if (!token || socket) return

  socket = io('/', {
    query: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
  })

  socket.on('connect', () => {
    console.log('🟢 Socket connected')
    connectListeners.forEach(fn => fn(socket))
  })
  socket.on('disconnect', () => console.log('🔴 Socket disconnected'))
  socket.on('connect_error', (e) => console.error('Socket error:', e.message))

  return socket
}

export const getSocket = () => socket

/**
 * Subscribe to socket-ready. If socket already connected, calls fn immediately.
 * Returns an unsubscribe function.
 */
export const onSocketConnect = (fn) => {
  if (socket?.connected) {
    fn(socket)
    return () => {}
  }
  connectListeners.add(fn)
  return () => connectListeners.delete(fn)
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}
