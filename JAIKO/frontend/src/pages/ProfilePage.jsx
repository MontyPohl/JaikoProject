import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Edit2, MessageCircle, UserPlus, Flag, Star,
  MapPin, Briefcase, Calendar, ShieldCheck, UserMinus, Lock,
} from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../context/authStore';
import { Avatar, Badge, StarRating, Modal, Spinner, EmptyState } from '../components/ui';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';

// ─── Sub-componente: Input de estrellas ───────────────────────────────────────
/**
 * Selector de estrellas para el formulario de reseña.
 * Componente separado por responsabilidad única (Single Responsibility).
 */
const StarInput = ({ value, onChange }) => (
  <div className="flex gap-1" role="group" aria-label="Calificación">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        aria-label={`${star} estrella${star !== 1 ? 's' : ''}`}
        className={`text-3xl transition-all hover:scale-110 active:scale-95 ${
          star <= value ? 'text-yellow-400' : 'text-slate-200'
        }`}
      >
        ★
      </button>
    ))}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProfilePage() {
  const { userId }   = useParams();
  const location     = useLocation();
  const { user: me, profile: myProfile, updateProfile } = useAuthStore();
  const navigate     = useNavigate();

  const targetId = userId ? parseInt(userId) : me?.id;
  const isMe     = !userId || parseInt(userId) === me?.id;

  // ── Estado del perfil ──────────────────────────────────────────────────────
  const [profile,       setProfile]       = useState(null);
  const [reviews,       setReviews]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [reportModal,   setReportModal]   = useState(false);
  const [reportReason,  setReportReason]  = useState('fake_profile');
  const [reportDesc,    setReportDesc]    = useState('');
  const [pendingRequest,setPendingRequest]= useState(null);
  const [verification,  setVerification]  = useState(null);
  const [roommate,      setRoommate]      = useState(null);
  const [requestSent,   setRequestSent]   = useState(false);

  // ── Estado del formulario de reseña ───────────────────────────────────────
  const [showReviewForm,    setShowReviewForm]    = useState(false);
  const [reviewRating,      setReviewRating]      = useState(5);
  const [reviewComment,     setReviewComment]     = useState('');
  const [submittingReview,  setSubmittingReview]  = useState(false);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setPendingRequest(null);
    setRequestSent(false);
    setShowReviewForm(false);

    if (!isMe && targetId) {
      api.get(`/profiles/${targetId}`)
        .then(({ data }) => {
          setProfile(data.profile);
          setRoommate(data.profile?.current_roomie ?? null);
          setLoading(false);
        })
        .catch(() => { toast.error('Perfil no encontrado'); navigate('/'); });

      const pendingIdFromState = location.state?.pendingRequestId;
      if (pendingIdFromState) setPendingRequest({ id: pendingIdFromState });
    } else {
      setProfile(myProfile);
      setRoommate(myProfile?.current_roomie ?? null);
      setLoading(false);
      api.get('/verification/me')
        .then(({ data }) => setVerification(data.verification))
        .catch(() => setVerification(null));
    }

    if (targetId) {
      api.get(`/reviews/user/${targetId}`)
        .then(({ data }) => setReviews(data.reviews))
        .catch(() => {});
    }
  }, [targetId, isMe]);

  /**
   * ✅ NUEVO: Lógica wasRoomie basada en current_roomie_id.
   *
   * Condición: el usuario autenticado (me) y el perfil visitado (targetId)
   * se consideran "roomies" si alguno de los dos tiene al otro como
   * current_roomie_id.
   *
   * Por qué importa: la regla de negocio dice que solo se puede reseñar
   * a alguien con quien se fue roomie, para evitar reseñas falsas.
   *
   * LIMITACIÓN ACTUAL: Solo detecta roomies ACTUALES (current_roomie_id).
   * Para detectar roomies PASADOS se necesitaría una tabla
   * `roommate_history` (pendiente en el backend).
   */
  const wasRoomie = !isMe && Boolean(
    myProfile?.current_roomie_id === targetId ||
    profile?.current_roomie_id === me?.id,
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const respondRequest = async (reqId, action) => {
    try {
      const { data } = await api.put(`/requests/${reqId}/respond`, { action });
      if (action === 'accept') {
        toast.success('¡Solicitud aceptada! Ahora son roommates.');
        setRoommate(data.roommate);
        updateProfile({ ...myProfile, current_roomie: data.roommate, is_looking: false });
      } else {
        toast.success('Solicitud rechazada');
      }
      setPendingRequest(null);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al procesar la solicitud');
    }
  };

  const handleSendRequest = async () => {
    if (requestSent) return;
    try {
      await api.post('/requests/', { target_user_id: targetId, type: 'roommate' });
      toast.success('Solicitud enviada correctamente');
      setRequestSent(true);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al enviar solicitud');
    }
  };

  const handleOpenChat = async () => {
    try {
      const { data } = await api.post(`/chats/private/${targetId}`);
      navigate(`/chat/${data.chat.id}`);
    } catch { toast.error('Error al abrir el chat'); }
  };

  const handleReport = async () => {
    try {
      await api.post('/reports/', {
        reported_user_id: targetId,
        reason:           reportReason,
        description:      reportDesc,
      });
      toast.success('Reporte enviado');
      setReportModal(false);
      setReportDesc('');
    } catch { toast.error('Error al enviar el reporte'); }
  };

  /**
   * ✅ NUEVO: Handler "Dejar de ser roomie".
   *
   * Solo frontend por ahora. Preparado para conectar al backend.
   *
   * TODO (backend): PUT /api/profiles/me con { current_roomie_id: null }
   * IMPORTANTE: el endpoint debe también limpiar el current_roomie_id
   * del otro usuario (transacción doble). Ver profile_routes.py.
   */
  const handleLeaveRoomie = () => {
    // TODO: descomentar cuando el backend esté listo:
    // await api.put('/profiles/me', { current_roomie_id: null });
    // updateProfile({ ...myProfile, current_roomie: null, current_roomie_id: null });
    // setRoommate(null);
    toast('Esta acción estará disponible próximamente.', { icon: '🚧' });
  };

  /**
   * ✅ NUEVO: Handler para enviar una reseña.
   *
   * Solo se puede llegar aquí si wasRoomie === true (la UI lo bloquea de otra forma).
   * El endpoint /reviews/ ya existe en review_routes.py.
   */
  const handleSubmitReview = async () => {
    if (reviewRating === 0) { toast.error('Seleccioná al menos 1 estrella'); return; }
    setSubmittingReview(true);
    try {
      await api.post('/reviews/', {
        target_user_id: targetId,
        rating:         reviewRating,
        comment:        reviewComment.trim() || null,
      });
      toast.success('¡Reseña enviada!');
      setShowReviewForm(false);
      setReviewComment('');
      setReviewRating(5);
      // Recargar las reseñas del perfil
      const { data } = await api.get(`/reviews/user/${targetId}`);
      setReviews(data.reviews);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al enviar la reseña');
    } finally {
      setSubmittingReview(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!profile) return <EmptyState icon="👤" title="Perfil no encontrado" />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

      {/* ── Header del perfil ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-8 p-8 sm:p-10"
      >
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
          <div className="relative group">
            <Avatar
              src={profile.profile_photo_url}
              name={profile.name}
              size="xl"
              verified={profile.verified}
              className="w-32 h-32 sm:w-40 sm:h-40 border-4 border-white shadow-xl"
            />
            {isMe && (
              <Link
                to="/profile/edit"
                className="absolute bottom-2 right-2 bg-orange-500 text-white p-2.5 rounded-full shadow-lg hover:bg-orange-600 transition-all"
              >
                <Edit2 size={16} />
              </Link>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start mb-2">
                  <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-blue-950">
                    {profile.name}
                  </h1>
                  {profile.verified && (
                    <Badge variant="blue" className="bg-blue-50 text-blue-600 border border-blue-100">
                      ✓ Verificado
                    </Badge>
                  )}
                  {profile.is_looking && !roommate && (
                    <Badge variant="orange" className="bg-orange-50 text-orange-600 border border-orange-100">
                      Buscando
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-blue-900/60 font-bold">
                  {profile.age       && <span className="flex items-center gap-1.5"><Calendar size={16} className="text-orange-500" /> {profile.age} años</span>}
                  {profile.profession && <span className="flex items-center gap-1.5"><Briefcase size={16} className="text-orange-500" /> {profile.profession}</span>}
                  {profile.city      && <span className="flex items-center gap-1.5"><MapPin size={16} className="text-orange-500" /> {profile.city}</span>}
                </div>
              </div>

              {!isMe && (
                <div className="flex items-center gap-3">
                  {!roommate && !pendingRequest && (
                    <button
                      onClick={handleSendRequest}
                      disabled={requestSent}
                      className="btn-primary flex items-center gap-2 py-2.5"
                    >
                      <UserPlus size={18} />
                      {requestSent ? 'Enviada' : 'Solicitar Roomie'}
                    </button>
                  )}
                  <button
                    onClick={handleOpenChat}
                    className="btn-secondary flex items-center gap-2 py-2.5"
                  >
                    <MessageCircle size={18} /> Chat
                  </button>
                  <button
                    onClick={() => setReportModal(true)}
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                  >
                    <Flag size={20} />
                  </button>
                </div>
              )}
            </div>

            {profile.bio && (
              <p className="text-blue-900/80 text-lg leading-relaxed max-w-2xl mb-6 font-medium">
                {profile.bio}
              </p>
            )}

            {/* Banner de roomie actual */}
            {roommate && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">
                  <span className="text-lg">🏠</span>
                  {isMe ? `Soy roomie de ${roommate.name}` : `Es roomie de ${roommate.name}`}
                </div>

                {/*
                 * ✅ NUEVO: Botón "Dejar de ser roomie"
                 *
                 * Solo visible para el propio usuario (isMe) cuando tiene un roomie activo.
                 * Handler conectado al mock → listo para backend.
                 * Estilo: texto pequeño, rojo, discreto → acción destructiva poco frecuente.
                 */}
                {isMe && (
                  <button
                    onClick={handleLeaveRoomie}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400
                      hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <UserMinus size={13} />
                    Dejar de ser roomie
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Solicitud pendiente */}
        {!isMe && pendingRequest && !roommate && (
          <div className="mt-10 p-6 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <p className="text-blue-900 font-extrabold text-lg mb-1">
                ¡Te ha enviado una solicitud de roomie!
              </p>
              <p className="text-blue-600 font-medium">
                ¿Querés que sea tu próximo compañero de hogar?
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={() => respondRequest(pendingRequest.id, 'accept')}
                className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all"
              >
                Aceptar
              </button>
              <button
                onClick={() => respondRequest(pendingRequest.id, 'reject')}
                className="flex-1 sm:flex-none px-8 py-3 bg-white text-blue-600 font-bold rounded-2xl border border-blue-200 hover:bg-blue-50 transition-all"
              >
                Rechazar
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Cuerpo: 2 columnas ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Columna izquierda (2/3) */}
        <div className="md:col-span-2 space-y-8">

          {/* Preferencias de convivencia */}
          <div className="card">
            <h2 className="font-display font-extrabold text-2xl text-blue-950 mb-6">
              Preferencias de convivencia
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100">
                <p className="text-xs font-bold text-blue-900/40 uppercase tracking-widest mb-3">
                  Presupuesto mensual
                </p>
                <p className="text-xl font-display font-extrabold text-blue-600">
                  ₲ {profile.budget_min ? (profile.budget_min / 1000000).toFixed(1) + 'M' : '?'}
                  {' – '}
                  {profile.budget_max ? (profile.budget_max / 1000000).toFixed(1) + 'M' : '?'}
                </p>
              </div>
              <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100">
                <p className="text-xs font-bold text-blue-900/40 uppercase tracking-widest mb-3">
                  Horario habitual
                </p>
                <p className="text-xl font-bold text-blue-950 capitalize">
                  {profile.schedule || 'Sin especificar'}
                </p>
              </div>
              <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-900/40 uppercase tracking-widest mb-1">Mascotas</p>
                  <p className={`font-bold ${profile.pets ? 'text-emerald-600' : 'text-blue-900/40'}`}>
                    {profile.pets ? '✓ Tiene mascotas' : '✗ Sin mascotas'}
                  </p>
                </div>
                <span className="text-2xl">{profile.pets ? '🐾' : '🚫'}</span>
              </div>
              <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-900/40 uppercase tracking-widest mb-1">Fumador</p>
                  <p className={`font-bold ${profile.smoker ? 'text-orange-600' : 'text-blue-900/40'}`}>
                    {profile.smoker ? '🚬 Fumador' : '🚭 No fuma'}
                  </p>
                </div>
                <span className="text-2xl">{profile.smoker ? '🔥' : '✨'}</span>
              </div>
            </div>
          </div>

          {/* Reseñas recibidas */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-extrabold text-2xl text-slate-900">
                Reseñas ({reviews.length})
              </h2>
              {reviews.length > 0 && (
                <StarRating
                  value={reviews.reduce((s, r) => s + r.rating, 0) / reviews.length}
                />
              )}
            </div>
            {reviews.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-400 font-medium italic">Sin reseñas aún</p>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map((r) => (
                  <div key={r.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={r.reviewer_photo} name={r.reviewer_name} size="sm" />
                        <span className="font-bold text-slate-900">{r.reviewer_name}</span>
                      </div>
                      <StarRating value={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="text-slate-600 leading-relaxed">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/*
           * ✅ NUEVO: Sección "Escribir reseña"
           *
           * Solo visible para usuarios que visitan el perfil de otra persona.
           * Se muestra en DOS estados:
           *   1. wasRoomie === true → formulario habilitado
           *   2. wasRoomie === false → estado bloqueado con explicación
           *
           * Por qué importa esta distinción:
           *   Previene reseñas de personas que nunca convivieron juntas,
           *   lo que protege la reputación de los usuarios en la plataforma.
           */}
          {!isMe && (
            <div className="card">
              <h2 className="font-display font-extrabold text-2xl text-slate-900 mb-4">
                Escribir reseña
              </h2>

              {wasRoomie ? (
                /* ── Formulario habilitado (fueron roomies) ── */
                showReviewForm ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Tu calificación
                      </p>
                      <StarInput value={reviewRating} onChange={setReviewRating} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Comentario (opcional)
                      </label>
                      <textarea
                        className="input resize-none h-28"
                        placeholder="¿Cómo fue tu experiencia conviviendo con esta persona?"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-slate-50">
                      <button
                        type="button"
                        onClick={() => setShowReviewForm(false)}
                        className="flex-1 btn-ghost"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSubmitReview}
                        disabled={submittingReview}
                        className="flex-1 btn-primary"
                      >
                        {submittingReview ? 'Enviando...' : 'Enviar reseña'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="flex items-center gap-2 w-full justify-center py-4 rounded-2xl
                      border-2 border-dashed border-orange-200 text-orange-500 font-bold
                      hover:bg-orange-50 hover:border-orange-300 transition-all"
                  >
                    <Star size={18} />
                    Escribir reseña sobre {profile.name?.split(' ')[0]}
                  </button>
                )
              ) : (
                /* ── Estado bloqueado (no fueron roomies) ── */
                <div className="flex flex-col items-center gap-3 py-6 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                  <Lock size={28} className="text-slate-300" />
                  <div>
                    <p className="font-bold text-slate-500 mb-1">
                      Reseña no disponible
                    </p>
                    <p className="text-sm text-slate-400 max-w-xs">
                      Solo podés reseñar a alguien con quien hayas sido roomie.
                      Si conviviste con esta persona, la opción se habilitará automáticamente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha (1/3) */}
        <div className="space-y-8">
          {isMe && !profile.verified && (
            <div className="card bg-orange-50 border-orange-100 p-8">
              <ShieldCheck className="text-orange-500 w-12 h-12 mb-4" />
              <h3 className="font-display font-extrabold text-xl text-orange-900 mb-2">
                Verificá tu perfil
              </h3>
              <p className="text-orange-700 text-sm mb-6">
                Aumentá tus chances de encontrar roomie en un 80% verificando tu identidad.
              </p>
              <Link
                to="/verification"
                className="w-full btn-primary bg-orange-500 hover:bg-orange-600 flex items-center justify-center py-3"
              >
                Empezar ahora
              </Link>
            </div>
          )}

          <div className="card">
            <h3 className="font-display font-extrabold text-xl text-slate-900 mb-6">
              Insignias
            </h3>
            <div className="flex flex-wrap gap-3">
              <Badge variant="blue"   className="py-2 px-4 text-xs">Pionero</Badge>
              <Badge variant="purple" className="py-2 px-4 text-xs">Buen Compañero</Badge>
              <Badge variant="green"  className="py-2 px-4 text-xs">Verificado</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Reportar usuario ─────────────────────────────────────────── */}
      {reportModal && (
        <Modal open={reportModal} onClose={() => setReportModal(false)} title="Reportar usuario">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                Motivo
              </label>
              <select
                className="input"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="fake_profile">Perfil falso</option>
                <option value="inappropriate">Contenido inapropiado</option>
                <option value="spam">Spam</option>
                <option value="harassment">Acoso</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                Descripción (opcional)
              </label>
              <textarea
                className="input resize-none h-32"
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Describí el problema detalladamente..."
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setReportModal(false)} className="flex-1 btn-ghost">
                Cancelar
              </button>
              <button onClick={handleReport} className="flex-1 btn-primary">
                Enviar reporte
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
