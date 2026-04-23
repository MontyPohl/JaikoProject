import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, UserPlus, CheckCircle2,
  XCircle, ShieldCheck, AlertCircle, Users, X,
} from 'lucide-react';
import useNotifStore from '../context/notifStore';
import { EmptyState } from '../components/ui';
import { motion, AnimatePresence } from 'motion/react';

const ICONS = {
  message:          { icon: <MessageSquare size={20} />, color: 'bg-blue-500'    },
  match_request:    { icon: <UserPlus size={20} />,      color: 'bg-orange-500'  },
  join_request:     { icon: <Users size={20} />,         color: 'bg-purple-500'  },
  request_accepted: { icon: <CheckCircle2 size={20} />,  color: 'bg-emerald-500' },
  request_rejected: { icon: <XCircle size={20} />,       color: 'bg-red-500'     },
  system:           { icon: <ShieldCheck size={20} />,   color: 'bg-slate-900'   },
  alert:            { icon: <AlertCircle size={20} />,   color: 'bg-amber-500'   },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unread, markRead, markAllRead, remove } = useNotifStore();

  const handleClick = (n) => {
    markRead(n.id);
    const d = n.data || {};
    if (n.type === 'match_request' && d.sender_id)
      return navigate(`/profile/${d.sender_id}`, { state: { pendingRequestId: d.request_id } });
    if (n.type === 'join_request'     && d.group_id)  return navigate(`/groups/${d.group_id}`);
    if (n.type === 'message'          && d.chat_id)   return navigate(`/chat/${d.chat_id}`);
    if (n.type === 'request_accepted' && d.sender_id) return navigate(`/profile/${d.sender_id}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 md:pb-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
            Notificaciones
          </h1>
          <p className="text-orange-500 font-medium mt-1">
            {unread > 0 ? `Tenés ${unread} sin leer` : 'Estás al día'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn-ghost text-sm py-2.5">
            Marcar todas como leídas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="Sin notificaciones"
          description="Cuando alguien te contacte o haya novedades en tu cuenta, aparecerán aquí."
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {notifications.map((n, i) => {
              const cfg = ICONS[n.type] || ICONS.system;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`w-full p-6 rounded-[2rem] border flex items-start gap-6
                    transition-colors duration-300
                    ${!n.read
                      ? 'bg-white border-blue-100 shadow-xl shadow-blue-500/5'
                      : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                >
                  {/* Zona clickeable */}
                  <button
                    onClick={() => handleClick(n)}
                    className="flex items-start gap-6 flex-1 min-w-0 text-left group"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${cfg.color} text-white
                      flex items-center justify-center shadow-lg flex-shrink-0
                      group-hover:scale-110 transition-transform`}
                    >
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 mb-1">{n.title}</p>
                      <p className="text-slate-500 text-sm leading-relaxed">{n.content}</p>
                      {n.type === 'match_request' && (
                        <p className="text-xs text-orange-500 font-bold mt-2">
                          Tocá para ver el perfil y responder →
                        </p>
                      )}
                      {n.type === 'join_request' && (
                        <p className="text-xs text-purple-500 font-bold mt-2">
                          Tocá para ir al grupo y decidir →
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Indicador + botón eliminar */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-1">
                    {!n.read && (
                      <div className="w-2.5 h-2.5 bg-blue-600 rounded-full shadow-lg shadow-blue-600/40" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      aria-label="Eliminar notificación"
                      className="p-1.5 rounded-xl text-slate-300
                        hover:text-red-400 hover:bg-red-50
                        transition-all duration-150 active:scale-90"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
