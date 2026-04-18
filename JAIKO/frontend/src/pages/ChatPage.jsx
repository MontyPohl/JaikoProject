import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, MessageSquare, MoreVertical, Phone, Video } from 'lucide-react';
import api from '../services/api';
import { getSocket, onSocketConnect } from '../services/socket';
import useAuthStore from '../context/authStore';
import { Avatar, Spinner, EmptyState } from '../components/ui';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatPage() {
  const { chatId } = useParams();
  const { user }   = useAuthStore();
  const navigate   = useNavigate();

  const [chats,   setChats]   = useState([]);
  const [active,  setActive]  = useState(null);
  const [messages,setMessages]= useState([]);
  const [text,    setText]    = useState('');
  const [typing,  setTyping]  = useState(false);
  const [loading, setLoading] = useState(false);

  const bottomRef          = useRef(null);
  const typingTimer        = useRef(null);
  const lastTypingEmit     = useRef(0);
  const isLoadingHistory   = useRef(false);
  const activeChatIdRef    = useRef(null);
  const socketRef          = useRef(null);
  const textareaRef        = useRef(null);
  /**
   * ✅ FIX CRÍTICO — Layout Shift (salto hacia abajo al navegar a chats)
   *
   * Problema anterior:
   *   scrollIntoView({ behavior: 'instant' }) scrolleaba el DOCUMENTO ENTERO
   *   (window), no solo el contenedor de mensajes. Esto causaba un "salto"
   *   visible de la página completa cada vez que se cargaba un chat.
   *
   * Solución:
   *   En vez de usar bottomRef con scrollIntoView, ahora referenciamos
   *   directamente el div scrollable que contiene los mensajes y
   *   manipulamos su scrollTop.
   *
   *   scrollTop = scrollHeight siempre lleva al final,
   *   sin tocar el scroll del documento (window), eliminando el salto.
   *
   * Beneficio para el usuario: navegación fluida, sin saltos visuales.
   */
  const messagesContainerRef = useRef(null);

  const MAX_MESSAGES = 100;

  // ── Socket: mensajes en tiempo real ────────────────────────────────────────
  useEffect(() => {
    const handleMsg = (msg) => {
      if (msg.chat_id === activeChatIdRef.current) {
        setMessages((m) => {
          if (m.some((ex) => ex.id === msg.id)) return m;
          const updated = [...m, msg];
          return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
        });
      }
      setChats((cs) =>
        cs.map((c) => (c.id === msg.chat_id ? { ...c, last_message: msg } : c)),
      );
    };

    const handleTyping     = ({ user_id }) => { if (user_id !== user?.id) setTyping(true); };
    const handleStopTyping = () => setTyping(false);

    const unsub = onSocketConnect((s) => {
      socketRef.current = s;
      s.off('receive_message',   handleMsg);
      s.off('user_typing',       handleTyping);
      s.off('user_stop_typing',  handleStopTyping);
      s.on( 'receive_message',   handleMsg);
      s.on( 'user_typing',       handleTyping);
      s.on( 'user_stop_typing',  handleStopTyping);
      if (activeChatIdRef.current) {
        s.emit('join_chat', { chat_id: activeChatIdRef.current });
      }
    });

    return () => {
      unsub();
      const s = socketRef.current;
      if (s) {
        s.off('receive_message',  handleMsg);
        s.off('user_typing',      handleTyping);
        s.off('user_stop_typing', handleStopTyping);
      }
    };
  }, [user?.id]);

  // ── Carga inicial de chats ─────────────────────────────────────────────────
  useEffect(() => {
    api.get('/chats/').then(({ data }) => {
      setChats(data.chats || []);
      if (chatId) {
        const found = data.chats?.find((c) => c.id === parseInt(chatId));
        if (found) selectChat(found);
      }
    });
  }, []);

  // ── Seleccionar chat ───────────────────────────────────────────────────────
  const selectChat = useCallback(
    async (chat) => {
      const s = socketRef.current;
      if (activeChatIdRef.current && activeChatIdRef.current !== chat.id && s?.connected) {
        s.emit('leave_chat', { chat_id: activeChatIdRef.current });
      }
      activeChatIdRef.current = chat.id;
      setActive(chat);
      navigate(`/chat/${chat.id}`, { replace: true });
      setLoading(true);
      isLoadingHistory.current = true;

      try {
        const { data } = await api.get(`/chats/${chat.id}/messages`);
        setMessages(data.messages || []);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }

      if (s?.connected) {
        s.emit('join_chat', { chat_id: chat.id });
      }
    },
    [navigate],
  );

  /**
   * ✅ FIX: Auto-scroll al final de mensajes.
   *
   * Antes: scrollIntoView() en bottomRef → scrolleaba el window entero.
   * Ahora: manipulamos scrollTop del contenedor de mensajes directamente.
   *
   * - Cuando se carga el historial (isLoadingHistory.current === true):
   *   scroll instantáneo al final (sin animación, para evitar el efecto
   *   de "rodar" todos los mensajes).
   *
   * - Cuando llega un mensaje nuevo:
   *   scroll suave (behavior: 'smooth') para una experiencia más fluida.
   */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isLoadingHistory.current) {
      // Instantáneo al cargar historial (sin animación de scroll)
      container.scrollTop = container.scrollHeight;
      isLoadingHistory.current = false;
    } else {
      // Suave al llegar un nuevo mensaje
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // ── Enviar mensaje ─────────────────────────────────────────────────────────
  const sendMessage = () => {
    const s = socketRef.current;
    if (!text.trim() || !activeChatIdRef.current || !s?.connected) return;
    s.emit('send_message', { chat_id: activeChatIdRef.current, content: text.trim() });
    setText('');
    clearTimeout(typingTimer.current);
    s.emit('stop_typing', { chat_id: activeChatIdRef.current });
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTypingInput = (e) => {
    const s  = socketRef.current;
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 112) + 'px';

    if (s?.connected && activeChatIdRef.current) {
      const now = Date.now();
      if (now - lastTypingEmit.current > 500) {
        s.emit('typing', { chat_id: activeChatIdRef.current });
        lastTypingEmit.current = now;
      }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(
        () => s.emit('stop_typing', { chat_id: activeChatIdRef.current }),
        1500,
      );
    }
  };

  const getChatName = (chat) => {
    if (chat.type === 'group') return `Grupo #${chat.group_id}`;
    const other = chat.members?.find((m) => m.user_id !== user?.id);
    return other?.name ?? `Usuario #${other?.user_id}`;
  };

  const getChatPhoto = (chat) => {
    const other = chat.members?.find((m) => m.user_id !== user?.id);
    return other?.photo ?? null;
  };

  const handleBack = () => {
    const s = socketRef.current;
    if (s?.connected && activeChatIdRef.current) {
      s.emit('leave_chat', { chat_id: activeChatIdRef.current });
    }
    setActive(null);
    activeChatIdRef.current = null;
    navigate('/chat', { replace: true });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 h-[calc(100vh-80px)]">
      <div className="flex h-full bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">

        {/* ── Sidebar: lista de chats ──────────────────────────────────────── */}
        <div className={clsx(
          'w-72 lg:w-80 flex-col border-r border-slate-100',
          active ? 'hidden md:flex' : 'flex',
        )}>
          {/* Header del sidebar */}
          <div className="p-8 border-b border-slate-100">
            <h1 className="font-display font-extrabold text-3xl text-blue-950 mb-2">
              Mensajes
            </h1>
            <p className="text-blue-900/40 text-sm font-bold">
              {chats.length} conversaciones activas
            </p>
          </div>

          {/* Lista de chats */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chats.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-4xl mb-4 opacity-20">💬</div>
                <p className="text-slate-400 font-medium">Sin chats aún</p>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => selectChat(chat)}
                  /**
                   * ✅ FIX LÍNEAS FANTASMA: Agregamos la clase `border` base.
                   *
                   * Problema anterior: `border-blue-100` y `border-transparent`
                   * sin `border` solo cambiaban el COLOR pero nunca reservaban
                   * el espacio del borde → al activar el chat, el layout
                   * "saltaba" 1px porque el borde de repente aparecía.
                   *
                   * Solución: `border` siempre presente; solo cambia el color.
                   * El espacio del borde está siempre reservado → sin saltos.
                   */
                  className={clsx(
                    'w-full flex items-center gap-4 p-4 rounded-3xl transition-all text-left group border',
                    active?.id === chat.id
                      ? 'bg-blue-50 border-blue-100'
                      : 'hover:bg-slate-50 border-transparent',
                  )}
                >
                  <Avatar
                    src={getChatPhoto(chat)}
                    name={getChatName(chat)}
                    size="md"
                    className="border-2 border-white shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className={clsx(
                        'font-bold truncate',
                        active?.id === chat.id ? 'text-blue-700' : 'text-blue-950',
                      )}>
                        {getChatName(chat)}
                      </p>
                      {chat.last_message && (
                        <span className="text-[10px] text-blue-900/40 font-bold uppercase">
                          {formatDistanceToNow(new Date(chat.last_message.created_at), { locale: es })}
                        </span>
                      )}
                    </div>
                    {chat.last_message ? (
                      <p className="text-xs text-blue-900/40 truncate font-bold">
                        {chat.last_message.content}
                      </p>
                    ) : (
                      <p className="text-xs text-blue-900/20 italic">
                        Inicia una conversación
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Panel de mensajes ────────────────────────────────────────────── */}
        <div className={clsx(
          'flex-col flex-1 bg-slate-50/30',
          active ? 'flex' : 'hidden md:flex',
        )}>
          {active ? (
            <>
              {/* Header del chat activo */}
              <div className="flex items-center justify-between p-6 bg-white border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <button
                    className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all"
                    onClick={handleBack}
                    aria-label="Volver a la lista de chats"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <Avatar
                    src={getChatPhoto(active)}
                    name={getChatName(active)}
                    size="md"
                    className="border-2 border-slate-100"
                  />
                  <div>
                    <p className="font-display font-extrabold text-blue-950">
                      {getChatName(active)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[10px] font-bold text-blue-900/40 uppercase tracking-widest">
                        En línea
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                    <Phone size={20} />
                  </button>
                  <button className="p-2.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                    <Video size={20} />
                  </button>
                  <button className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>

              {/* Área de mensajes — referenciamos el contenedor para el scroll */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-8 space-y-6"
              >
                {loading && (
                  <div className="flex justify-center py-10">
                    <Spinner size="lg" />
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => {
                    const isMe       = msg.sender_id === user?.id;
                    const showAvatar = !isMe && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={clsx(
                          'flex items-end gap-3',
                          isMe ? 'flex-row-reverse' : 'flex-row',
                        )}
                      >
                        <div className="w-8 flex-shrink-0">
                          {showAvatar && (
                            <Avatar
                              src={msg.sender_photo}
                              name={msg.sender_name}
                              size="sm"
                              className="w-8 h-8"
                            />
                          )}
                        </div>
                        <div
                          className={clsx(
                            'max-w-[70%] px-5 py-3.5 rounded-[1.5rem] text-sm shadow-sm relative group',
                            isMe
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none',
                          )}
                        >
                          <p className="leading-relaxed break-words font-medium">
                            {msg.content}
                          </p>
                          <p className={clsx(
                            'text-[9px] font-bold uppercase tracking-widest mt-2 opacity-0 group-hover:opacity-60 transition-opacity',
                            isMe ? 'text-white' : 'text-slate-400',
                          )}>
                            {formatDistanceToNow(new Date(msg.created_at), { locale: es })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {typing && (
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-widest animate-pulse ml-11">
                    <span className="flex gap-1">
                      <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" />
                      <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </span>
                    Escribiendo...
                  </div>
                )}

                {/* ✅ FIX: div vacío con h-0 para no añadir espacio fantasma al final */}
                <div ref={bottomRef} className="h-0" />
              </div>

              {/* Input de mensaje */}
              <div className="p-6 bg-white border-t border-slate-100 flex items-end gap-4">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTypingInput}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Escribí un mensaje..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none leading-relaxed"
                    style={{ maxHeight: '112px' }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!text.trim()}
                  className="w-14 h-14 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Send size={22} className="ml-1" />
                </button>
              </div>
            </>
          ) : (
            /* Estado vacío: ningún chat seleccionado */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mb-6">
                <MessageSquare size={40} className="text-blue-500" />
              </div>
              <h2 className="text-2xl font-display font-extrabold text-slate-900 mb-2">
                Tus conversaciones
              </h2>
              <p className="text-slate-400 max-w-xs mx-auto">
                Seleccioná un chat de la lista para empezar a hablar con tus futuros roomies.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
