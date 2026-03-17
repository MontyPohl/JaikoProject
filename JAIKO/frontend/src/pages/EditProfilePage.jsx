import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import api from '../services/api'
import useAuthStore from '../context/authStore'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Constantes
const SCHEDULES = ['morning', 'afternoon', 'night', 'flexible']
const GENDERS   = ['male', 'female', 'non_binary', 'other']
const CITIES    = ['Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora', 'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este']

// Labels en español
const SCHEDULE_LABELS = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  night: 'Noche',
  flexible: 'Flexible'
}

const GENDER_LABELS = {
  male: 'Hombre',
  female: 'Mujer',
  non_binary: 'No binario',
  other: 'Otro'
}

// Coordenadas exactas de las ciudades
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
  const navigate = useNavigate()

  const defaultLat = -25.28646
  const defaultLng = -57.64700

  const [form, setForm] = useState({
    name: profile?.name || '',
    age: profile?.age || '',
    gender: profile?.gender || '',
    profession: profile?.profession || '',
    bio: profile?.bio || '',
    budget_min: profile?.budget_min || '',
    budget_max: profile?.budget_max || '',
    pets: profile?.pets ?? false,
    smoker: profile?.smoker ?? false,
    schedule: profile?.schedule || '',
    city: profile?.city || 'Asunción',
    lat: profile?.lat ?? defaultLat,
    lng: profile?.lng ?? defaultLng,
    is_looking: profile?.is_looking ?? true,
  })

  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const toggle = (k) => () => setForm(f => ({ ...f, [k]: !f[k] }))

  // Actualiza lat/lng automáticamente al cambiar la ciudad
  useEffect(() => {
    const coords = CITY_COORDS[form.city] || [defaultLat, defaultLng]
    setForm(f => ({ ...f, lat: coords[0], lng: coords[1] }))
  }, [form.city])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }

    // Validación de presupuesto para que no sea negativo
    if (form.budget_min < 0 || form.budget_max < 0) {
      toast.error('El presupuesto no puede ser negativo')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        age: form.age ? parseInt(form.age) : null,
        budget_min: form.budget_min ? parseInt(form.budget_min) : null,
        budget_max: form.budget_max ? parseInt(form.budget_max) : null,
        lat: form.lat,
        lng: form.lng
      }
      const { data } = await api.put('/profiles/me', payload)
      updateProfile(data.profile)
      toast.success('Perfil actualizado')
      navigate('/profile')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "input"
  const Label = ({ children }) => (
    <label className="block text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">{children}</label>
  )

  // Marcador arrastrable que actualiza lat/lng
  function LocationMarker() {
    useMapEvents({
      click(e) { setForm(f => ({ ...f, lat: e.latlng.lat, lng: e.latlng.lng })) },
    })
    return <Marker position={[form.lat, form.lng]} draggable
      eventHandlers={{
        dragend: (e) => {
          const pos = e.target.getLatLng()
          setForm(f => ({ ...f, lat: pos.lat, lng: pos.lng }))
        }
      }}
    />
  }

  // Centrar mapa automáticamente
  function FlyToMarker({ lat, lng }) {
    const map = useMap()
    useEffect(() => { if(lat && lng) map.flyTo([lat,lng], map.getZoom(), { duration: 0.5 }) }, [lat,lng])
    return null
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display font-extrabold text-3xl mb-8">Editar perfil</h1>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Info básica */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><Label>Nombre completo *</Label><input className={inputClass} value={form.name} onChange={set('name')} required /></div>
          <div><Label>Edad</Label><input className={inputClass} type="number" min={18} max={80} value={form.age} onChange={set('age')} /></div>
          <div>
            <Label>Género</Label>
            <select className={inputClass} value={form.gender} onChange={set('gender')}>
              <option value="">Prefiero no decir</option>
              {GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
            </select>
          </div>
          <div><Label>Profesión / ocupación</Label><input className={inputClass} value={form.profession} onChange={set('profession')} /></div>
          <div>
            <Label>Ciudad</Label>
            <select className={inputClass} value={form.city} onChange={set('city')} >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Horario habitual</Label>
            <select className={inputClass} value={form.schedule} onChange={set('schedule')}>
              <option value="">Sin especificar</option>
              {SCHEDULES.map(s => <option key={s} value={s}>{SCHEDULE_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {/* Mapa interactivo */}
        <div>
          <Label>Ubicación en el mapa</Label>
          <MapContainer center={[form.lat, form.lng]} zoom={13} style={{height:'300px',width:'100%',borderRadius:'8px'}}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
            <FlyToMarker lat={form.lat} lng={form.lng}/>
            <LocationMarker/>
          </MapContainer>
        </div>

        {/* Bio */}
        <div><Label>Bio</Label><textarea className={`${inputClass} h-28 resize-none`} value={form.bio} onChange={set('bio')} /></div>

        {/* Presupuesto */}
        <div><Label>Presupuesto mensual (₲)</Label>
          <div className="grid grid-cols-2 gap-4">
            <input className={inputClass} type="number" min="0" value={form.budget_min} onChange={set('budget_min')} placeholder="Mínimo"/>
            <input className={inputClass} type="number" min="0" value={form.budget_max} onChange={set('budget_max')} placeholder="Máximo"/>
          </div>
        </div>

        {/* Toggles */}
        <div>
          <Label>Preferencias</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {[{key:'pets',label:'🐾 Tengo/acepto mascotas'},{key:'smoker',label:'🚬 Soy fumador'},{key:'is_looking',label:'🔍 Estoy buscando activamente'}].map(({key,label}) => (
              <button key={key} type="button" onClick={toggle(key)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${form[key]?'border-primary-500 bg-primary-50 text-primary-700':'border-orange-200 text-orange-400 hover:border-orange-300'}`}>{label}</button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-2 border-t border-orange-100">
          <button type="button" onClick={() => navigate('/profile')} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading?'Guardando...':'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  )
}