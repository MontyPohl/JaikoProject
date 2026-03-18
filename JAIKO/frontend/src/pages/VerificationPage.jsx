import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, Upload, Clock, CheckCircle2, XCircle, Camera, Loader2 } from 'lucide-react'
import api from '../services/api'
import { uploadVerificationSelfie } from '../services/storage'
import { toast } from 'react-hot-toast'
import { Spinner } from '../components/ui'

const STATUS_CONFIG = {
  not_requested:        { icon: ShieldCheck,  color: 'text-orange-400',  label: 'No solicitado' },
  pending_verification: { icon: Clock,         color: 'text-yellow-500',  label: 'En revisión' },
  verified:             { icon: CheckCircle2,  color: 'text-emerald-500', label: 'Verificado' },
  rejected:             { icon: XCircle,       color: 'text-red-500',     label: 'Rechazado' },
}

export default function VerificationPage() {
  const [verification, setVerification] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [submitting, setSubmitting]     = useState(false)

  // Upload de selfie
  const [selfieFile, setSelfieFile]       = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    api.get('/verification/me').then(({ data }) => {
      setVerification(data.verification)
    }).finally(() => setLoading(false))
  }, [])

  const handleRequest = async () => {
    setSubmitting(true)
    try {
      const { data } = await api.post('/verification/request')
      setVerification(data.verification)
      toast.success('Solicitud creada. ¡Ya podés subir tu selfie!')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  // Selección de archivo de selfie
  const handleSelfieSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen no puede superar 10MB')
      return
    }
    setSelfieFile(file)
    setSelfiePreview(URL.createObjectURL(file))
  }

  // Subir selfie al backend (bucket privado)
  const handleUploadSelfie = async () => {
    if (!selfieFile) { toast.error('Seleccioná una foto primero'); return }
    setSubmitting(true)
    try {
      await uploadVerificationSelfie(selfieFile)
      // Refrescar estado
      const { data } = await api.get('/verification/me')
      setVerification(data.verification)
      setSelfieFile(null)
      setSelfiePreview(null)
      toast.success('Selfie enviada. Esperá la revisión del equipo.')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al subir la selfie')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const status = verification?.status || 'not_requested'
  const cfg    = STATUS_CONFIG[status]
  const Icon   = cfg.icon

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="font-display font-extrabold text-3xl mb-2">Verificación de identidad</h1>
      <p className="text-orange-400 mb-8">
        El perfil verificado genera mayor confianza en la comunidad de JAIKO!
      </p>

      {/* Estado actual */}
      <div className="card mb-6 flex items-center gap-4">
        <div className={`p-3 rounded-2xl bg-orange-50 ${cfg.color}`}>
          <Icon size={28} />
        </div>
        <div>
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Estado actual</p>
          <p className={`font-display font-bold text-xl ${cfg.color}`}>{cfg.label}</p>
        </div>
      </div>

      {/* ── No solicitado ─────────────────────────────────────────────────── */}
      {status === 'not_requested' && (
        <div className="card space-y-5">
          <h2 className="font-display font-bold text-lg">¿Cómo funciona?</h2>
          {[
            { n: 1, t: 'Solicitá la verificación', d: 'Te generamos un código único tipo JAIKO-1234.' },
            { n: 2, t: 'Tomá una selfie con el código', d: 'Escribí el código en un papel y sacate una foto sosteniéndolo.' },
            { n: 3, t: 'Subí la foto directamente', d: 'Desde tu cámara o galería — la foto se guarda de forma segura.' },
            { n: 4, t: 'Revisión manual', d: 'Nuestro equipo aprueba o rechaza en 24–48 hs.' },
          ].map(({ n, t, d }) => (
            <div key={n} className="flex gap-4">
              <div className="w-8 h-8 rounded-xl bg-primary-500 text-white font-bold flex items-center justify-center flex-shrink-0">{n}</div>
              <div>
                <p className="font-semibold text-sm">{t}</p>
                <p className="text-xs text-gray-500">{d}</p>
              </div>
            </div>
          ))}
          <button onClick={handleRequest} disabled={submitting} className="btn-primary w-full mt-2">
            {submitting ? 'Solicitando...' : 'Solicitar verificación'}
          </button>
        </div>
      )}

      {/* ── Pendiente — mostrar código y upload de selfie ─────────────────── */}
      {status === 'pending_verification' && verification && (
        <div className="card space-y-5">
          {/* Código */}
          <div className="text-center py-4">
            <p className="text-sm text-orange-400 mb-2">Tu código de verificación</p>
            <div className="inline-block bg-brand-dark text-primary-400 font-mono font-bold text-3xl px-8 py-4 rounded-2xl tracking-widest">
              {verification.verification_code}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Escribí este código en un papel, sacate una selfie sosteniéndolo y subí la foto.
            </p>
          </div>

          {/* Upload de selfie — solo si todavía no envió */}
          {!verification.selfie_url ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Tu selfie con el código</p>

              {/* Preview de la foto seleccionada */}
              {selfiePreview && (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-orange-200">
                  <img src={selfiePreview} alt="Preview selfie" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Botones de selección y envío */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 btn-ghost flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  {selfieFile ? 'Cambiar foto' : 'Seleccionar foto'}
                </button>

                {selfieFile && (
                  <button
                    type="button"
                    onClick={handleUploadSelfie}
                    disabled={submitting}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {submitting
                      ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                      : <><Upload size={16} /> Enviar selfie</>
                    }
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                onChange={handleSelfieSelect}
              />

              <p className="text-xs text-gray-400 text-center">
                Formatos aceptados: JPG, PNG, WEBP · Máx. 10MB
              </p>
            </div>
          ) : (
            /* Selfie ya enviada — esperando revisión */
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <Clock className="mx-auto text-yellow-500 mb-2" size={24} />
              <p className="font-semibold text-yellow-700 text-sm">Selfie recibida. Esperando revisión.</p>
              <p className="text-xs text-yellow-500 mt-1">En 24–48 hs te notificamos el resultado.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Verificado ────────────────────────────────────────────────────── */}
      {status === 'verified' && (
        <div className="card text-center py-10">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
          <h2 className="font-display font-bold text-xl text-emerald-600">¡Estás verificado!</h2>
          <p className="text-gray-500 text-sm mt-2">Tu perfil muestra el sello de verificación de identidad.</p>
        </div>
      )}

      {/* ── Rechazado ─────────────────────────────────────────────────────── */}
      {status === 'rejected' && (
        <div className="card space-y-4">
          <div className="text-center py-6">
            <XCircle size={48} className="text-red-500 mx-auto mb-3" />
            <h2 className="font-display font-bold text-xl text-red-500">Verificación rechazada</h2>
            {verification?.rejection_reason && (
              <p className="text-sm text-gray-500 mt-2">{verification.rejection_reason}</p>
            )}
          </div>
          <button onClick={handleRequest} disabled={submitting} className="btn-primary w-full">
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}