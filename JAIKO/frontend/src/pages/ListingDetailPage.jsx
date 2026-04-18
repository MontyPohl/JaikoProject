import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin, BedDouble, Bath, Users, PawPrint, Sofa,
  MessageCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import api from '../services/api'
import { Badge, Avatar, StarRating, Spinner } from '../components/ui'
import useAuthStore from '../context/authStore'
import { toast } from 'react-hot-toast'

export default function ListingDetailPage() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  const [listing,  setListing]  = useState(null)
  const [reviews,  setReviews]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [photo,    setPhoto]    = useState(0)
  const [MapComp,  setMapComp]  = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/listings/${id}`),
      api.get(`/reviews/listing/${id}`),
    ]).then(([ld, rv]) => {
      setListing(ld.data.listing)
      setReviews(rv.data.reviews)
    }).catch(() => navigate('/listings'))
      .finally(() => setLoading(false))

    import('../components/map/JaikoMap').then(m => setMapComp(() => m.default))
  }, [id])

  const handleContact = async () => {
    if (!isAuthenticated()) { navigate('/login'); return }
    try {
      const { data } = await api.post(`/chats/private/${listing.owner_id}`)
      navigate(`/chat/${data.chat.id}`)
    } catch { toast.error('Error al abrir chat') }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!listing) return null

  const photos  = listing.photos || []
  const isOwner = user?.id === listing.owner_id

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
      <Link
        to="/listings"
        className="flex items-center gap-1 text-orange-400 hover:text-primary-600 mb-4 text-sm font-semibold transition-colors"
      >
        <ChevronLeft size={15} /> Volver a publicaciones
      </Link>

      {/* Galería de fotos */}
      {photos.length > 0 ? (
        <div className="relative h-56 sm:h-72 md:h-96 rounded-2xl overflow-hidden mb-4 sm:mb-6 bg-orange-100">
          <img
            src={photos[photo]?.photo_url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setPhoto(p => (p - 1 + photos.length) % photos.length)}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 sm:p-2 hover:bg-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPhoto(p => (p + 1) % photos.length)}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 sm:p-2 hover:bg-white transition-colors"
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhoto(i)}
                    className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full transition-colors ${
                      i === photo ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="h-44 sm:h-56 rounded-2xl bg-orange-100 flex items-center justify-center text-5xl sm:text-6xl mb-4 sm:mb-6">
          🏠
        </div>
      )}

      {/* Grid principal: 1 col mobile, 3 col desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* ── Info principal ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-5">
          <div className="card">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-3 sm:mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="dark">{listing.type}</Badge>
                  <Badge variant={listing.status === 'active' ? 'green' : 'gray'}>
                    {listing.status}
                  </Badge>
                </div>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl">
                  {listing.title}
                </h1>
                <div className="flex items-center gap-1 text-orange-400 text-sm mt-1">
                  <MapPin size={13} />
                  {listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-display font-extrabold text-2xl sm:text-3xl text-primary-600">
                  ₲ {(listing.total_price / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-xs text-orange-400">por mes</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
              {[
                { icon: BedDouble, label: `${listing.rooms} hab.`      },
                { icon: Bath,      label: `${listing.bathrooms} baños` },
                { icon: Users,     label: `Máx. ${listing.max_people}` },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="bg-orange-50 rounded-xl p-2.5 sm:p-3 flex flex-col items-center gap-1"
                >
                  <Icon size={15} className="text-primary-500" />
                  <span className="text-xs font-semibold text-center">{label}</span>
                </div>
              ))}
              {listing.furnished && (
                <div className="bg-orange-50 rounded-xl p-2.5 sm:p-3 flex flex-col items-center gap-1">
                  <Sofa size={15} className="text-purple-500" />
                  <span className="text-xs font-semibold">Amoblado</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
              {listing.pets_allowed    && <Badge variant="orange"><PawPrint size={11} className="inline" /> Mascotas ok</Badge>}
              {listing.smoking_allowed && <Badge variant="gray">🚬 Fumadores ok</Badge>}
            </div>

            {listing.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{listing.description}</p>
            )}
          </div>

          {/*
           * ── Mapa ─────────────────────────────────────────────────────────
           *
           * ✅ FIX: Antes se usaba `markers` (prop de roomies) pasándole un
           * objeto de listing, pero JaikoMap filtra los markers-de-roomie
           * exigiendo que cada marcador tenga la propiedad `profile`.
           * Como un listing no tiene `profile`, se filtraba todo y el mapa
           * aparecía vacío (o no aparecía el pin).
           *
           * Solución: usar `listingMarkers` — la prop correcta para pins de
           * departamentos. JaikoMap la filtra con isValidCoord() solamente,
           * sin exigir `profile`.
           *
           * Estructura esperada por listingMarkers:
           *   { lat, lng, id, title, price, neighborhood }
           */}
          {listing.latitude && listing.longitude && MapComp && (
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg mb-2 sm:mb-3">
                Ubicación
              </h2>
              <MapComp
                center={[listing.latitude, listing.longitude]}
                listingMarkers={[{
                  lat:          listing.latitude,
                  lng:          listing.longitude,
                  id:           listing.id,
                  title:        listing.title,
                  price:        listing.total_price,
                  neighborhood: listing.neighborhood,
                }]}
                height="240px"
              />
            </div>
          )}

          {/* Reseñas */}
          {reviews.length > 0 && (
            <div className="card">
              <h2 className="font-display font-bold text-base sm:text-lg mb-3 sm:mb-4">
                Reseñas ({reviews.length}) · {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} ⭐
              </h2>
              {reviews.map(r => (
                <div key={r.id} className="border-b border-orange-50 pb-3 mb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar src={r.reviewer_photo} name={r.reviewer_name} size="sm" />
                    <span className="font-semibold text-sm">{r.reviewer_name}</span>
                    <StarRating value={r.rating} />
                  </div>
                  {r.comment && (
                    <p className="text-xs text-gray-500 ml-10">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card lg:sticky lg:top-20">
            <h3 className="font-display font-bold text-sm sm:text-base mb-3 sm:mb-4">
              Publicado por
            </h3>
            {listing.owner && (
              <Link
                to={`/profile/${listing.owner_id}`}
                className="flex items-center gap-3 mb-3 sm:mb-4 hover:opacity-80 transition-opacity"
              >
                <Avatar
                  src={listing.owner.profile_photo_url}
                  name={listing.owner.name}
                  size="md"
                  verified={listing.owner.verified}
                />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{listing.owner.name}</p>
                  {listing.owner.profession && (
                    <p className="text-xs text-orange-400 truncate">
                      {listing.owner.profession}
                    </p>
                  )}
                </div>
              </Link>
            )}
            {!isOwner && (
              <button
                onClick={handleContact}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle size={15} /> Contactar
              </button>
            )}
            {isOwner && (
              <Badge variant="orange" className="w-full text-center py-2">
                Tu publicación
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
