// BottomNav.jsx — Barra de navegación inferior estilo app mobile (Tinder-style)
// Incluir en el Layout principal, visible solo en mobile (md:hidden)

import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, Search, Users, Home, Building2 } from "lucide-react";
import useNotifStore from "../../context/notifStore";

const NAV_ITEMS = [
  { to: "/search",    icon: Search,       label: "Buscar"   },
  { to: "/listings",  icon: Building2,    label: "Dptos"    },
  { to: "/groups",    icon: Users,        label: "Grupos"   },
  { to: "/chat",      icon: MessageSquare,label: "Chat"     },
];

export default function BottomNav() {
  const location = useLocation();
  const { unread } = useNotifStore();

  // No mostrar en páginas donde no aplica
  const hiddenPaths = ["/login", "/register", "/"];
  if (hiddenPaths.includes(location.pathname)) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50
      bg-white/95 backdrop-blur-xl border-t border-[#F1F5F9]
      shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-around px-2 py-1 safe-area-pb">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to);
          const isChatWithUnread = to === "/chat" && unread > 0;

          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-2xl
                transition-all duration-200 min-w-[60px] relative"
            >
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl
                transition-all duration-200
                ${isActive
                  ? "bg-[#2563C8] shadow-[0_4px_12px_rgba(37,99,200,0.35)]"
                  : "bg-transparent"
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive ? "text-white" : "text-[#94A3B8]"}
                />
                {isChatWithUnread && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#F5A623] rounded-full
                    flex items-center justify-center text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide transition-colors
                ${isActive ? "text-[#2563C8]" : "text-[#94A3B8]"}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
