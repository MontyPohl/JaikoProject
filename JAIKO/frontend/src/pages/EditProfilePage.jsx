import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Camera, Loader2 } from 'lucide-react'
import api from '../services/api'
import { uploadProfilePhoto } from '../services/storage'
import useAuthStore from '../context/authStore'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Arreglo para los iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SCHEDULES = ['morning', 'afternoon', 'night', 'flexible']
const GENDERS   = ['male', 'female', 'non_binary', 'other']
const CITIES    = ['Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora', 'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este']
const SCHEDULE_LABELS = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche', flexible: 'Flexible' }
const GENDER_LABELS   = { male: 'Hombre', female: 'Mujer', non_binary: 'No binario', other: 'Otro' }
const CITY_COORDS = {
  'Asunción':           [-25.28646, -57.64700],
  'San Lorenzo':        [-25.335505, -57.517750],
  'Luque':              [-25.263480, -57.485700],
  'Fernando de la Mora':[-25.308480, -57.522450],
  'Lambaré':            [-25.340370, -57.607530],
  'Capiatá':            [-25.356020, -57.445450],
  'Encarnación':        [-27.333330, -55.866670],
  'Ciudad del Este':    [-25.509660, -54.611050],
}

export default function EditProfilePage() {
  const { profile, updateProfile } = useAuthStore()
  const navigate   = useNavigate()
  const fileInputRef = useRef(null)

  const defaultLat = -25.28646
  const defaultLng = -57.64700

  const [form, setForm] = useState({
    name: '', age: '', gender: '', profession: '', bio: '',
    budget_min: '', budget_max: '', pets: false, smoker: false,
    schedule: '', city: 'Asunción', lat: defaultLat, lng: defaultLng, is_looking: true,
  })

  // Inicializar form cuando el perfil esté disponible
  useEffect(() => {
    if (!profile) return
    setForm({
      name: profile.name || '',
      age: profile.age || '',
      gender: profile.gender || '',
      profession: profile.profession || '',
      bio: profile.bio || '',
      budget_min: profile.budget_min || '',
      budget_max: profile.budget_max || '',
      pets: profile.pets ?? false,
      smoker: profile.smoker ?? false,
      schedule: profile.schedule || '',
      city: profile.city || 'Asunción',
      lat: profile.lat ?? CITY_COORDS[profile.city]?.[0] ?? defaultLat,
      lng: profile.lng ?? CITY_COORDS[profile.city]?.[1] ?? defaultLng,
      is_looking: profile.is_looking ?? true,
    })
  }, [profile])

  const [photoPreview, setPhotoPreview]   = useState(profile?.profile_photo_url || null)
  const [photoFile, setPhotoFile]         = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loading, setLoading]             = useState(false)

  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const toggle   = (k) => ()  => setForm(f => ({ ...f, [k]: !f[k] }))

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen no puede superar 5MB'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    if (form.budget_min < 0 || form.budget_max < 0) { toast.error('El presupuesto no puede ser negativo'); return }

    setLoading(true)
    try {
      let finalPhotoUrl = profile?.profile_photo_url

      if (photoFile) {
        setUploadingPhoto(true)
        finalPhotoUrl = await uploadProfilePhoto(photoFile)
        setUploadingPhoto(false)
        setPhotoPreview(finalPhotoUrl)
        setPhotoFile(null)
      }

      const payload = {
        ...form,
        profile_photo_url: finalPhotoUrl,
        age:        form.age ? parseInt(form.age) : null,
        budget_min: form.budget_min ? parseInt(form.budget_min) : null,
        budget_max: form.budget_max ? parseInt(form.budget_max) : null,
      }

      const { data } = await api.put('/profiles/me', payload)
      updateProfile(data.profile)
      toast.success('Perfil actualizado')
      navigate('/profile')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setLoading(false)
      setUploadingPhoto(false)
    }
  }

  const Label = ({ children }) => (
    <label className="block text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">{children}</label>
  )

  function LocationMarker() {
    useMapEvents({
      click(e) { setForm(f => ({ ...f, lat: e.latlng.lat, lng: e.latlng.lng })) },
    })
    return (
      <Marker position={[form.lat, form.lng]} draggable
        eventHandlers={{
          dragend: (e) => {
            const pos = e.target.getLatLng()
            setForm(f => ({ ...f, lat: pos.lat, lng: pos.lng }))
          }
        }}
      />
    )
  }

  function FlyToMarker({ lat, lng }) {
    const map = useMap()
    useEffect(() => { if (lat && lng) map.flyTo([lat, lng], map.getZoom(), { duration: 0.5 }) }, [lat, lng])
    return null
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <h1 className="font-display font-extrabold text-2xl sm:text-3xl mb-6 sm:mb-8">Editar perfil</h1>

      <form onSubmit={handleSubmit} className="card space-y-5 sm:space-y-6">

        {/* Foto de perfil */}
        <div className="flex flex-col items-center gap-3">
          <Label>Foto de perfil</Label>
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-orange-100 bg-gray-100">
              {photoPreview ? (
                <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl sm:text-4xl font-bold">
                  {form.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-primary-500 text-white rounded-full p-1.5 shadow hover:bg-primary-600 transition">
              {uploadingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" onChange={handlePhotoSelect} />
          {photoFile && (
            <p className="text-xs text-orange-400 text-center">
              Nueva foto seleccionada: {photoFile.name}
            </p>
          )}
        </div>

        {/* Cuadrícula de campos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div><Label>Nombre completo *</Label><input className="input" value={form.name} onChange={setField('name')} required /></div>
          <div><Label>Edad</Label><input className="input" type="number" min={18} max={80} value={form.age} onChange={setField('age')} /></div>
          <div>
            <Label>Género</Label>
            <select className="input" value={form.gender} onChange={setField('gender')}>
              <option value="">Prefiero no decir</option>
              {GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
            </select>
          </div>
          <div><Label>Profesión / ocupación</Label><input className="input" value={form.profession} onChange={setField('profession')} /></div>
          <div>
            <Label>Ciudad</Label>
            <select className="input" value={form.city} onChange={setField('city')}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Horario habitual</Label>
            <select className="input" value={form.schedule} onChange={setField('schedule')}>
              <option value="">Sin especificar</option>
              {SCHEDULES.map(s => <option key={s} value={s}>{SCHEDULE_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {/* Mapa de ubicación */}
        <div>
          <Label>Ubicación en el mapa</Label>
          <div className="rounded-xl overflow-hidden mt-1 border border-orange-100" style={{ height: '250px' }}>
            <MapContainer center={[form.lat, form.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FlyToMarker lat={form.lat} lng={form.lng} />
              <LocationMarker />
            </MapContainer>
          </div>
        </div>

        {/* Biografía */}
        <div>
          <Label>Bio</Label>
          <textarea className="input h-24 sm:h-28 resize-none" value={form.bio} onChange={setField('bio')} placeholder="Cuéntanos un poco sobre ti..." />
        </div>

        {/* Presupuesto */}
        <div>
          <Label>Presupuesto mensual (₲)</Label>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <input className="input" type="number" min="0" value={form.budget_min}
              onChange={setField('budget_min')} placeholder="Mínimo" />
            <input className="input" type="number" min="0" value={form.budget_max}
              onChange={setField('budget_max')} placeholder="Máximo" />
          </div>
        </div>

        {/* Preferencias y búsqueda */}
        <div>
          <Label>Preferencias</Label>
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-2">
            {[
              { key: 'pets',       label: '🐾 Tengo/acepto mascotas' },
              { key: 'smoker',     label: '🚬 Soy fumador' },
              { key: 'is_looking', label: '🔍 Estoy buscando activamente' },
            ].map(({ key, label }) => (
              <button key={key} type="button" onClick={toggle(key)}
                className={`px-3 sm:px-4 py-2 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all
                  ${form[key]
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-orange-200 text-orange-400 hover:border-orange-300'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Acciones finales */}
        <div className="flex gap-3 justify-end pt-2 border-t border-orange-100">
          <button type="button" onClick={() => navigate('/profile')} className="btn-ghost text-sm">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary text-sm">
            {loading ? (uploadingPhoto ? 'Subiendo foto...' : 'Guardando...') : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}