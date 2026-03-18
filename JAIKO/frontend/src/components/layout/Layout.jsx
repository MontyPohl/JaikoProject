import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, Building2, Users, MessageCircle, Bell, ShieldCheck, LogOut, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import useAuthStore from '../../context/authStore';
import useNotifStore from '../../context/notifStore';
import clsx from 'clsx';
import logo from '../../assets/logo.png';
import api from '../../services/api';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/search', label: 'Buscar roomies', icon: Search, auth: true },
  { to: '/listings', label: 'Departamentos', icon: Building2 },
  { to: '/groups', label: 'Grupos', icon: Users, auth: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle, auth: true },
];

export default function Layout() {
  const { profile, logout, isAuthenticated, isAdmin } = useAuthStore();
  const { unread } = useNotifStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userGroupId, setUserGroupId] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fetchUserGroup = async () => {
    if (isAuthenticated()) {
      try {
        const res = await api.get('/groups/my');
        const group = res.data.groups?.[0];
        setUserGroupId(group ? group.id : null);
      } catch (err) {
        setUserGroupId(null);
      }
    }
  };

  // CORRECCIÓN: se ejecuta solo una vez al montar el Layout.
  // Antes tenía [isAuthenticated, profile] como dependencias, lo que causaba
  // que se disparara un GET /groups/my en CADA navegación porque profile
  // se actualiza cuando fetchMe() corre en App.jsx.
  useEffect(() => {
    fetchUserGroup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col font-main">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-[#2563C8]/90 backdrop-blur-md shadow-xl">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 relative">
          {/* Logo principal */}
          <div className="flex-shrink-0">
            <img src={logo} alt="JAIKO!" className="h-16 w-auto" />
          </div>

          {/* Links desktop */}
          <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 gap-8">
            {NAV.filter(n => !n.auth || isAuthenticated()).map(({ to, label, icon: Icon }) => {
              const targetTo = to === '/groups' && userGroupId ? `/groups/${userGroupId}` : to;
              return (
                <NavLink
                  key={to}
                  to={targetTo}
                  end={to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300',
                      isActive
                        ? 'bg-[#FBBF24] text-[#2563C8] shadow-md'
                        : 'hover:bg-white/20 hover:text-[#FBBF24] hover:scale-105'
                    )
                  }
                >
                  <Icon size={16} /> {label}
                </NavLink>
              );
            })}
          </div>

          {/* Right side: avatar y notificaciones */}
          <div className="ml-auto flex items-center gap-3">
            {isAuthenticated() && (
              <>
                <NavLink
                  to="/notifications"
                  className="relative p-2 rounded-lg hover:bg-white/20 transition duration-300 hover:scale-110"
                >
                  <Bell size={22} />
                  {unread > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-[#FBBF24] text-[#2563C8] text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </NavLink>

                {isAdmin() && (
                  <NavLink to="/admin" className="p-2 rounded-lg hover:bg-white/20 transition duration-300 hover:scale-110">
                    <ShieldCheck size={22} />
                  </NavLink>
                )}

                <NavLink to="/profile" className="flex items-center gap-2 pl-2 hover:scale-105 transition duration-300">
                  {profile?.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#FBBF24]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#FBBF24] flex items-center justify-center font-bold text-sm text-[#2563C8]">
                      {profile?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-semibold text-white">
                    {profile?.name?.split(' ')[0]}
                  </span>
                </NavLink>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-white/20 transition duration-300 hover:scale-110"
                  title="Cerrar sesión"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/20 text-white transition duration-300 hover:scale-110"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#2563C8]/95 px-4 pb-4 flex flex-col gap-2 animate-fade-in rounded-b-lg shadow-lg">
            {NAV.filter(n => !n.auth || isAuthenticated()).map(({ to, label, icon: Icon }) => {
              const targetTo = to === '/groups' && userGroupId ? `/groups/${userGroupId}` : to;
              return (
                <NavLink
                  key={to}
                  to={targetTo}
                  end={to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition duration-300',
                      isActive ? 'bg-[#FBBF24] text-[#2563C8] shadow-md' : 'text-white hover:bg-white/20 hover:scale-105'
                    )
                  }
                >
                  <Icon size={16} /> {label}
                </NavLink>
              )
            })}
          </div>
        )}
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#2563C8] text-white text-center py-5 text-sm font-body">
        <span className="font-alt font-bold text-[#FBBF24]">JAIKO!</span> – Encontrá tu roomie ideal en Paraguay · {new Date().getFullYear()}
      </footer>
    </div>
  );
}