import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, UserPlus, CheckCircle2, XCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import useNotifStore from '../context/notifStore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { EmptyState } from '../components/ui';
import { motion } from 'motion/react';

const ICONS = {
  message: { icon: <MessageSquare size={20} />, color: 'bg-blue-500' },
  match_request: { icon: <UserPlus size={20} />, color: 'bg-orange-500' },
  request_accepted: { icon: <CheckCircle2 size={20} />, color: 'bg-emerald-500' },
  request_rejected: { icon: <XCircle size={20} />, color: 'bg-red-500' },
  system: { icon: <ShieldCheck size={20} />, color: 'bg-slate-900' },
  alert: { icon: <AlertCircle size={20} />, color: 'bg-amber-500' },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unread, markRead, markAllRead } = useNotifStore();

  const handleClick = (n) => {
    markRead(n.id);
    const d = n.data || {};
    if (n.type === 'message' && d.chat_id) return navigate(`/chat/${d.chat_id}`);
    if (n.type === 'match_request' && d.sender_id) return navigate(`/profile/${d.sender_id}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">Notificaciones</h1>
          <p className="text-orange-500 font-medium mt-1">
            {unread > 0 ? `Tenés ${unread} mensajes sin leer` : 'Estás al día'}
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
          {notifications.map((n, i) => {
            const cfg = ICONS[n.type] || ICONS.system;
            return (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleClick(n)}
                className={`w-full text-left p-6 rounded-[2rem] border transition-all duration-300 flex items-start gap-6 group
                  ${!n.read ? 'bg-white border-blue-100 shadow-xl shadow-blue-500/5' : 'bg-slate-50 border-slate-100 opacity-60'}`}
              >
                <div className={`w-12 h-12 rounded-2xl ${cfg.color} text-white flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-slate-900">{n.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {formatDistanceToNow(new Date(n.created_at), { locale: es, addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">{n.content}</p>
                </div>
                {!n.read && (
                  <div className="w-2.5 h-2.5 bg-blue-600 rounded-full mt-2 shadow-lg shadow-blue-600/40" />
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
