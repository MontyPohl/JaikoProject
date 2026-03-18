import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, ArrowLeft } from 'lucide-react'
import api from '../services/api'
import { getSocket, onSocketConnect } from '../services/socket'
import useAuthStore from '../context/authStore'
import { Avatar, Spinner, EmptyState } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'

export default function ChatPage() {
  const { chatId } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [chats, setChats] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [loading, setLoading] = useState(false)

  const bottomRef = useRef(null)
  const typingTimer = useRef(null)
  const isLoadingHistory = useRef(false)

  // CORRECCIÓN CRÍTICA: activeChatIdRef se actualiza SINCRÓNICAMENTE
  // dentro de selectChat, no a través de useEffect (que es asíncrono).
  // Antes, cuando llegaba un mensaje justo después de abrir el chat,
  // activeRef.current era null y el mensaje se descartaba silenciosamente.
  const activeChatIdRef = useRef(null)

  const socketRef = useRef(getSocket())
  const [, forceRender] = useState(0)

  const MAX_MESSAGES = 100

  // ── Socket: conectar y mantener referencia actualizada ───────────────────
  useEffect(() => {
    const unsub = onSocketConnect((s) => {
      socketRef.current = s
      forceRender(n => n + 1)
    })
    if (!socketRef.current) {
      socketRef.current = getSocket()
    }
    return unsub
  }, [])

  // ── Socket: registrar listener de mensajes ───────────────────────────────
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handleMsg = (msg) => {
      // Usamos activeChatIdRef que se actualiza sincrónicamente
      console.log('MSG chat_id:', msg.chat_id, typeof msg.chat_id)
      console.log('REF valor:', activeChatIdRef.current, typeof activeChatIdRef.current)



      if (msg.chat_id === activeChatIdRef.current) {
        setMessages(m => {
          if (m.some(ex => ex.id === msg.id)) return m
          const updated = [...m, msg]
          return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated
        })
      }
      // Siempre actualizar el último mensaje en la lista de chats
      setChats(cs => cs.map(c =>
        c.id === msg.chat_id ? { ...c, last_message: msg } : c
      ))
    }

    const handleTyping = ({ user_id }) => { if (user_id !== user?.id) setTyping(true) }
    const handleStopTyping = () => setTyping(false)

    socket.on('receive_message', handleMsg)
    socket.on('user_typing', handleTyping)
    socket.on('user_stop_typing', handleStopTyping)

    return () => {
      socket.off('receive_message', handleMsg)
      socket.off('user_typing', handleTyping)
      socket.off('user_stop_typing', handleStopTyping)
    }
  })  // Sin dependencias: se re-registra en cada render para garantizar
  // que handleMsg siempre cierra sobre el activeChatIdRef más reciente.
  // El off/on es instantáneo y no genera problemas de rendimiento.

  // ── Cargar lista de chats al montar ──────────────────────────────────────
  useEffect(() => {
    api.get('/chats/').then(({ data }) => {
      setChats(data.chats)
      if (chatId) {
        const found = data.chats.find(c => c.id === parseInt(chatId))
        if (found) selectChat(found)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seleccionar un chat ───────────────────────────────────────────────────
  const selectChat = useCallback(async (chat) => {
    // CORRECCIÓN: actualizar el ref SINCRÓNICAMENTE antes de cualquier await
    activeChatIdRef.current = chat.id
    setActive(chat)
    navigate(`/chat/${chat.id}`, { replace: true })

    setLoading(true)
    isLoadingHistory.current = true
    const { data } = await api.get(`/chats/${chat.id}/messages`)
    setMessages(data.messages)
    setLoading(false)

    // Unirse al room del chat en el socket
    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit('join_chat', { chat_id: chat.id })
    }
  }, [navigate])

  // ── Re-join si el socket se reconecta con un chat ya activo ──────────────
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !activeChatIdRef.current) return
    socket.emit('join_chat', { chat_id: activeChatIdRef.current })
  }, [socketRef.current]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingHistory.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      isLoadingHistory.current = false
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const sendMessage = () => {
    const socket = socketRef.current
    if (!text.trim() || !activeChatIdRef.current || !socket?.connected) return
    socket.emit('send_message', { chat_id: activeChatIdRef.current, content: text.trim() })
    setText('')
    socket.emit('stop_typing', { chat_id: activeChatIdRef.current })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleTypingInput = (e) => {
    const socket = socketRef.current
    setText(e.target.value)
    if (socket?.connected && activeChatIdRef.current) {
      socket.emit('typing', { chat_id: activeChatIdRef.current })
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(
        () => socket.emit('stop_typing', { chat_id: activeChatIdRef.current }),
        1500
      )
    }
  }

  const getChatName = (chat) => {
    if (chat.type === 'group') return `Grupo #${chat.group_id}`
    const other = chat.members?.find(m => m.user_id !== user?.id)
    return other?.name ?? `Usuario #${other?.user_id}`
  }

  const getChatPhoto = (chat) => {
    const other = chat.members?.find(m => m.user_id !== user?.id)
    return other?.photo ?? null
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display font-extrabold text-3xl mb-6">Chats</h1>

      <div className="flex h-[70vh] bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">

        {/* Sidebar */}
        <div className={clsx(
          'w-72 flex-shrink-0 border-r border-orange-100 flex flex-col',
          active && 'hidden md:flex'
        )}>
          <div className="p-4 border-b border-orange-100">
            <p className="font-semibold text-sm text-orange-400">{chats.length} conversaciones</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-6 text-center text-orange-300 text-sm">Sin chats aún</div>
            ) : chats.map(chat => (
              <button key={chat.id} onClick={() => selectChat(chat)}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 hover:bg-orange-50 transition-colors text-left border-b border-orange-50',
                  active?.id === chat.id && 'bg-primary-50 border-l-4 border-l-primary-500'
                )}>
                <Avatar src={getChatPhoto(chat)} name={getChatName(chat)} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{getChatName(chat)}</p>
                  {chat.last_message && (
                    <p className="text-xs text-orange-400 truncate">{chat.last_message.content}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat window */}
        {active ? (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-orange-100">
              <button className="md:hidden p-1" onClick={() => {
                setActive(null)
                activeChatIdRef.current = null
              }}>
                <ArrowLeft size={18} />
              </button>
              <Avatar src={getChatPhoto(active)} name={getChatName(active)} size="sm" />
              <div>
                <p className="font-display font-bold">{getChatName(active)}</p>
                {typing && <p className="text-xs text-primary-500 animate-pulse">Escribiendo...</p>}
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && <div className="flex justify-center"><Spinner /></div>}
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={clsx('flex items-end gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                    {!isMe && <Avatar src={msg.sender_photo} name={msg.sender_name} size="sm" />}
                    <div className={clsx(
                      'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                      isMe
                        ? 'bg-primary-500 text-white rounded-br-sm'
                        : 'bg-orange-50 text-brand-dark rounded-bl-sm'
                    )}>
                      {!isMe && <p className="font-semibold text-xs text-primary-600 mb-0.5">{msg.sender_name}</p>}
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={clsx('text-[10px] mt-1', isMe ? 'text-primary-200' : 'text-orange-300')}>
                        {formatDistanceToNow(new Date(msg.created_at), { locale: es, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-orange-100 flex items-end gap-3">
              <textarea
                value={text}
                onChange={handleTypingInput}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Escribí un mensaje..."
                className="flex-1 input resize-none max-h-28 py-2.5"
              />
              <button onClick={sendMessage} disabled={!text.trim()}
                className="btn-primary p-2.5 rounded-xl flex-shrink-0">
                <Send size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon="💬" title="Seleccioná un chat" description="Elegí una conversación de la lista." />
          </div>
        )}
      </div>
    </div>
  )
}