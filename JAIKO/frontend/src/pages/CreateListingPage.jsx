import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import api from '../services/api'
import { uploadListingPhoto } from '../services/storage'
import { toast } from 'react-hot-toast'

const CITIES = ['Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora', 'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este']
const Label = ({ children }) => <label className="block text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">{children}</label>

export function CreateListingPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    title: '', description: '', city: 'Asunción', neighborhood: '',
    address: '', latitude: '', longitude: '', total_price: '',
    rooms: 1, bathrooms: 1, max_people: 2,
    pets_allowed: false, smoking_allowed: false, furnished: false,
    type: 'apartment',
  })

  // Fotos: lista de { file, preview } antes de crear el listing
  const [photoFiles, setPhotoFiles]     = useState([])
  const [loading, setLoading]           = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const setField = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const tog      = k => () => setForm(f => ({ ...f, [k]: !f[k] }))

  // Agregar fotos (máx 8)
  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files)
    const remaining = 8 - photoFiles.length
    const toAdd = files.slice(0, remaining).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setPhotoFiles(prev => [...prev, ...toAdd])
    e.target.value = ''
  }

  const removePhoto = (index) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.title || !form.total_price) {
      toast.error('Título y precio son obligatorios')
      return
    }

    setLoading(true)
    try {
      // 1. Crear el listing
      const payload = {
        ...form,
        total_price: parseInt(form.total_price),
        rooms:       parseInt(form.rooms),
        bathrooms:   parseInt(form.bathrooms),
        max_people:  parseInt(form.max_people),
        latitude:    form.latitude  ? parseFloat(form.latitude)  : null,
        longitude:   form.longitude ? parseFloat(form.longitude) : null,
      }
      const { data } = await api.post('/listings/', payload)
      const listingId = data.listing.id

      // 2. Subir fotos si hay
      if (photoFiles.length > 0) {
        setUploadingPhotos(true)
        for (const { file } of photoFiles) {
          try {
            await uploadListingPhoto(listingId, file)
          } catch {
            toast.error(`No se pudo subir ${file.name}`)
          }
        }
        setUploadingPhotos(false)
      }

      toast.success('¡Publicación creada!')
      navigate(`/listings/${listingId}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al publicar')
    } finally {
      setLoading(false)
      setUploadingPhotos(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display font-extrabold text-3xl mb-8">Publicar vivienda</h1>

      <form onSubmit={handleSubmit} className="card space-y-6">

        {/* ── Datos básicos ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Label>Título *</Label>
            <input className="input" value={form.title} onChange={setField('title')} placeholder="Ej: Dpto 2 hab. en Asunción" required />
          </div>
          <div>
            <Label>Tipo</Label>
            <select className="input" value={form.type} onChange={setField('type')}>
              <option value="apartment">Departamento</option>
              <option value="room">Habitación</option>
              <option value="house">Casa</option>
            </select>
          </div>
          <div>
            <Label>Ciudad *</Label>
            <select className="input" value={form.city} onChange={setField('city')}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Barrio</Label>
            <input className="input" value={form.neighborhood} onChange={setField('neighborhood')} placeholder="Ej: Villa Morra" />
          </div>
          <div>
            <Label>Precio mensual (₲) *</Label>
            <input className="input" type="number" value={form.total_price} onChange={setField('total_price')} placeholder="Ej: 2500000" required />
          </div>
          <div>
            <Label>Habitaciones</Label>
            <input className="input" type="number" min={1} value={form.rooms} onChange={setField('rooms')} />
          </div>
          <div>
            <Label>Baños</Label>
            <input className="input" type="number" min={1} value={form.bathrooms} onChange={setField('bathrooms')} />
          </div>
          <div>
            <Label>Máx. personas</Label>
            <input className="input" type="number" min={1} value={form.max_people} onChange={setField('max_people')} />
          </div>
          <div>
            <Label>Latitud (opcional)</Label>
            <input className="input" type="number" step="any" value={form.latitude} onChange={setField('latitude')} placeholder="-25.2867" />
          </div>
          <div>
            <Label>Longitud (opcional)</Label>
            <input className="input" type="number" step="any" value={form.longitude} onChange={setField('longitude')} placeholder="-57.647" />
          </div>
          <div className="md:col-span-2">
            <Label>Descripción</Label>
            <textarea className="input h-28 resize-none" value={form.description} onChange={setField('description')} placeholder="Describí el espacio, comodidades, reglas..." />
          </div>
        </div>

        {/* ── Fotos ──────────────────────────────────────────────────────── */}
        <div>
          <Label>Fotos del lugar (máx. 8)</Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-2">
            {photoFiles.map(({ preview }, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-orange-100">
                <img src={preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {photoFiles.length < 8 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-orange-200 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition">
                <ImagePlus size={24} className="text-orange-300" />
                <span className="text-xs text-orange-300 mt-1">Agregar</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotoSelect} />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Las fotos se suben automáticamente al publicar.</p>
        </div>

        {/* ── Características ────────────────────────────────────────────── */}
        <div>
          <Label>Características</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {[
              ['pets_allowed',    '🐾 Mascotas permitidas'],
              ['smoking_allowed', '🚬 Fumadores ok'],
              ['furnished',       '🛋️ Amoblado'],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={tog(k)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${form[k] ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-orange-200 text-orange-400 hover:border-orange-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── Submit ─────────────────────────────────────────────────────── */}
        <div className="flex gap-3 justify-end pt-2 border-t border-orange-100">
          <button type="button" onClick={() => navigate('/listings')} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading
              ? <><Loader2 size={16} className="animate-spin" />{uploadingPhotos ? 'Subiendo fotos...' : 'Publicando...'}</>
              : 'Publicar'
            }
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateListingPage