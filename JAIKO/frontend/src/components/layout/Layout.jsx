import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Home, Search, Users, Bell, User, LogOut, Menu, X,
  MessageSquare, Sparkles,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import useNotifStore from '../../context/notifStore';
import { Avatar } from '../ui';
import Logo from '../ui/Logo';
import BackButton from '../ui/BackButton';
import clsx from 'clsx';

// ─── Navbar ───────────────────────────────────────────────────────────────────
const Navbar = () => {
  const { isAuthenticated, user, profile, logout } = useAuthStore();
  const { unread }   = useNotifStore();
  const location     = useLocation();
  const navigate     = useNavigate();
  const [isOpen,     setIsOpen]     = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cierra el menú al navegar
  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  // Bloquea el scroll del body mientras el menú está abierto en mobile
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/',         label: 'Inicio',        icon: Home          },
    ...(isAuthenticated() ? [
      { to: '/search',   label: 'Buscar Roomie', icon: Sparkles      },
      { to: '/listings', label: 'Departamentos', icon: Search        },
      { to: '/groups',   label: 'Grupos',        icon: Users         },
      { to: '/chat',     label: 'Chat',          icon: MessageSquare },
    ] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/*
       * ── Navbar ──────────────────────────────────────────────────────────
       *
       * LÓGICA DE FONDO (3 estados):
       *
       * 1. isScrolled (cualquier dispositivo):
       *    → bg-white/90 con blur — igual en mobile y desktop.
       *
       * 2. !isScrolled + mobile (< md):
       *    → bg-white sólido SIEMPRE.
       *    Por qué: en mobile el navbar siempre está sobre contenido
       *    desplazable (no sobre un hero de pantalla completa). Sin fondo
       *    sólido, el ícono ☰ y el logo quedan sobre imágenes/texto del
       *    contenido y pueden ser ilegibles.
       *
       * 3. !isScrolled + desktop (≥ md):
       *    → transparente. El hero de la homepage necesita este efecto.
       *    Las páginas interiores hacen scroll y rápidamente pasan al
       *    estado isScrolled, así que la transparencia dura poco.
       *
       * Implementación: mobile-first con override en md.
       *   bg-white        → aplica en todos los tamaños base
       *   md:bg-transparent → en desktop y sin scroll, se vuelve transparente
       * Cuando isScrolled=true, la clase de Tailwind sobrescribe todo.
       */}
      <nav
        className={clsx(
          'fixed top-0 left-0 w-full z-50 transition-all duration-300 px-6',
          isScrolled
            ? 'bg-white/90 backdrop-blur-lg border-b border-orange-100 py-3 shadow-sm'
            : 'py-4 bg-white border-b border-orange-100 md:bg-transparent md:border-b-0 md:shadow-none',
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <Logo className="w-10 h-10" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={clsx(
                  'text-sm font-bold transition-colors hover:text-orange-500',
                  isActive(link.to) ? 'text-blue-600' : 'text-blue-900',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated() ? (
              <>
                <Link
                  to="/notifications"
                  className="relative p-2 text-slate-400 hover:text-orange-500 transition-colors"
                >
                  <Bell size={20} />
                  {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" />
                  )}
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 pl-4 border-l border-slate-100"
                >
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900">{profile?.name || user?.email}</p>
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Mi Perfil</p>
                  </div>
                  <Avatar src={profile?.profile_photo_url} name={profile?.name} size="sm" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
                  Ingresar
                </Link>
                <Link to="/register" className="btn-primary py-2.5 text-sm">
                  Registrarse
                </Link>
              </div>
            )}
          </div>

          {/* Botón hamburguesa */}
          <button
            className="md:hidden p-2 text-slate-700 hover:text-slate-900 transition-colors"
            onClick={() => setIsOpen(o => !o)}
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/*
       * ── Menú mobile ─────────────────────────────────────────────────────
       *
       * Por qué está FUERA del <nav> y usa position:fixed propio:
       * Si lo ponemos dentro del <nav>, el contenido del menú hereda el
       * z-index del navbar y puede quedar debajo de otros elementos. Al
       * sacarlo al mismo nivel del DOM pero con z-index propio (z-40, menor
       * que el navbar z-50), el navbar siempre queda encima del panel.
       *
       * overflow-y-auto: si el usuario tiene muchos links y la pantalla es
       * pequeña, el menú hace scroll interno en vez de cortarse.
       *
       * top-[65px]: altura exacta del navbar (py-4 = 16px × 2 + logo 33px ≈ 65px).
       * Si el navbar cambia de tamaño con isScrolled, el panel se queda donde
       * está (el usuario solo lo abre cuando no hay scroll, con py-4 activo).
       */}
      <div
        aria-hidden={!isOpen}
        className={clsx(
          'fixed inset-x-0 top-[65px] bottom-0 z-40',
          'bg-white overflow-y-auto',
          'transition-transform duration-300 ease-in-out md:hidden',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Padding inferior extra para que el último ítem no quede bajo el BottomNav */}
        <div className="flex flex-col gap-5 p-8 pb-32">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsOpen(false)}
              className={clsx(
                'flex items-center gap-4 text-2xl font-display font-extrabold',
                isActive(link.to) ? 'text-orange-500' : 'text-slate-900',
              )}
            >
              <link.icon className="w-6 h-6 flex-shrink-0" />
              {link.label}
            </Link>
          ))}

          <hr className="border-slate-100" />

          {isAuthenticated() ? (
            <>
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 text-2xl font-display font-extrabold text-slate-900"
              >
                <User className="w-6 h-6 flex-shrink-0" /> Mi Perfil
              </Link>
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 text-2xl font-display font-extrabold text-slate-900"
              >
                <Bell className="w-6 h-6 flex-shrink-0" />
                <span className="flex items-center gap-2">
                  Notificaciones
                  {unread > 0 && (
                    <span className="text-sm bg-orange-500 text-white rounded-full px-2 py-0.5 font-bold">
                      {unread}
                    </span>
                  )}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 text-2xl font-display font-extrabold text-red-500"
              >
                <LogOut className="w-6 h-6 flex-shrink-0" /> Salir
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="btn-secondary text-center text-lg py-4"
              >
                Ingresar
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="btn-primary text-center text-lg py-4"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── BottomNav ────────────────────────────────────────────────────────────────
const BottomNav = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated()) return null;

  const links = [
    { to: '/',              label: 'Inicio',  icon: Home          },
    { to: '/search',        label: 'Roomies', icon: Sparkles      },
    { to: '/chat',          label: 'Chat',    icon: MessageSquare },
    { to: '/notifications', label: 'Notif',   icon: Bell          },
    { to: '/profile',       label: 'Perfil',  icon: User          },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-white border-t border-orange-100 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={clsx(
              'flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-200',
              isActive(link.to) ? 'text-orange-500' : 'text-blue-900/50',
            )}
          >
            <link.icon
              size={22}
              strokeWidth={isActive(link.to) ? 2.5 : 1.8}
            />
            <span className="text-[10px] font-bold uppercase tracking-tight">
              {link.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

// ─── Layout ───────────────────────────────────────────────────────────────────
const Layout = () => {
  const location = useLocation();
  const showBackButton = location.pathname !== '/';

  return (
    /*
     * overflow-x-hidden: evita scroll horizontal por animaciones de slide-in.
     * NO usamos overflow-hidden a secas porque eso bloquearía el scroll vertical
     * de toda la página.
     */
    <div className="min-h-screen flex flex-col bg-brand-cream overflow-x-hidden">
      <Navbar />

      <main className="flex-1 pt-[65px] pb-20 md:pb-0">
        {/*
         * pt-[65px]: deja espacio exacto para la altura del navbar en mobile.
         * pb-20: deja espacio para el BottomNav (altura ≈ 72px + safe area).
         * md:pb-0: en desktop no hay BottomNav.
         */}
        {showBackButton && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
            <BackButton />
          </div>
        )}
        <Outlet />
      </main>

      <BottomNav />

      <footer className="hidden md:block bg-blue-950 text-white py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <Logo className="w-10 h-10" />
            </Link>
            <p className="text-blue-200/60 max-w-sm leading-relaxed">
              La plataforma líder en Paraguay para encontrar el compañero de hogar ideal.
              Seguridad, rapidez y compatibilidad en un solo lugar.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-lg">Plataforma</h4>
            <ul className="space-y-4 text-blue-200/60 text-sm">
              <li><Link to="/search"       className="hover:text-white transition-colors">Buscar Roomies</Link></li>
              <li><Link to="/listings"     className="hover:text-white transition-colors">Departamentos</Link></li>
              <li><Link to="/groups"       className="hover:text-white transition-colors">Grupos</Link></li>
              <li><Link to="/verification" className="hover:text-white transition-colors">Verificación</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-lg">Legal</h4>
            <ul className="space-y-4 text-blue-200/60 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Términos y Condiciones</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-white/10 mt-20 pt-8 text-center text-blue-200/30 text-xs font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} JAIKO! — Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
