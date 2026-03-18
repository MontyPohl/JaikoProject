import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import useAuthStore from "./context/authStore";
import useNotifStore from "./context/notifStore";
import { onSocketConnect } from "./services/socket.js";

import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AdminRoute from "./components/layout/AdminRoute";

// CORRECCIÓN DE RENDIMIENTO: React.lazy() para code splitting.
// Antes todos los imports eran estáticos, lo que cargaba TODAS las páginas
// en el bundle inicial aunque el usuario solo visite una sola.
// Con lazy(), cada página se carga solo cuando se visita por primera vez.
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const ListingsPage = lazy(() => import('./pages/ListingsPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const CreateListingPage = lazy(() => import('./pages/CreateListingPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  const { token, fetchMe } = useAuthStore();
  const { fetch: fetchNotifs, addRealtime } = useNotifStore();

  useEffect(() => {
    if (token) {
      fetchMe();
      fetchNotifs();
    }
  }, [token]);

  // CORRECCIÓN: usamos onSocketConnect en lugar de getSocket() directamente.
  // getSocket() puede retornar null si el socket todavía no se conectó,
  // perdiendo el evento 'notification'. onSocketConnect espera a que el
  // socket esté listo y también maneja reconexiones correctamente.
  useEffect(() => {
    const unsubscribe = onSocketConnect((socket) => {
      socket.on('notification', addRealtime);
    });
    return () => {
      unsubscribe();
    };
  }, [token, addRealtime]);

  return (
    // Suspense es requerido para que React.lazy funcione.
    // El fallback puede ser un spinner o null, según prefieras.
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/listings/new" element={<CreateListingPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/verification" element={<VerificationPage />} />
          </Route>

          {/* Admin */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}