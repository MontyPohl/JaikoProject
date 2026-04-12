import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Upload, Clock, CheckCircle2, XCircle, Camera, Loader2, Info } from 'lucide-react';
import api from '../services/api';
import { uploadVerificationSelfie } from '../services/storage';
import { toast } from 'react-hot-toast';
import { Spinner } from '../components/ui';
import { motion } from 'motion/react';

const STATUS_CONFIG = {
  not_requested:        { icon: ShieldCheck,  color: 'text-slate-400',  bg: 'bg-slate-50', border: 'border-slate-100', label: 'No solicitado' },
  pending_verification: { icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-50', border: 'border-amber-100', label: 'En revisión' },
  verified:             { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Verificado' },
  rejected:             { icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-50', border: 'border-red-100', label: 'Rechazado' },
};

export default function VerificationPage() {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/verification/me').then(({ data }) => {
      setVerification(data.verification);
    }).finally(() => setLoading(false));
  }, []);

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post('/verification/request');
      setVerification(data.verification);
      toast.success('Solicitud creada. ¡Ya podés subir tu selfie!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelfieSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('La imagen no puede superar 10MB'); return; }
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleUploadSelfie = async () => {
    if (!selfieFile) { toast.error('Seleccioná una foto primero'); return; }
    setSubmitting(true);
    try {
      await uploadVerificationSelfie(selfieFile);
      const { data } = await api.get('/verification/me');
      setVerification(data.verification);
      setSelfieFile(null);
      setSelfiePreview(null);
      toast.success('Selfie enviada. Esperá la revisión del equipo.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al subir la selfie');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  const status = verification?.status || 'not_requested';
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="text-center mb-12">
        <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-slate-900 mb-4">Verificación de identidad</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Un perfil verificado genera confianza y aumenta tus posibilidades de encontrar el roomie ideal.
        </p>
      </div>

      <div className={`card mb-12 flex flex-col sm:flex-row items-center gap-8 p-10 ${cfg.bg} ${cfg.border}`}>
        <div className={`w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-xl ${cfg.color}`}>
          <Icon size={40} />
        </div>
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Estado de tu cuenta</p>
          <h2 className={`text-3xl font-display font-extrabold ${cfg.color}`}>{cfg.label}</h2>
        </div>
      </div>

      {status === 'not_requested' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card p-10">
            <h2 className="font-display font-extrabold text-2xl mb-8">¿Cómo funciona?</h2>
            <div className="space-y-8">
              {[
                { n: '01', t: 'Solicitá el código', d: 'Te asignaremos un código único para tu verificación.' },
                { n: '02', t: 'Tomá una selfie', d: 'Sostené un papel con el código escrito claramente.' },
                { n: '03', t: 'Subí la foto', d: 'Nuestro equipo revisará tu identidad manualmente.' },
              ].map((step) => (
                <div key={step.n} className="flex gap-6">
                  <div className="text-3xl font-display font-black text-slate-100">{step.n}</div>
                  <div>
                    <p className="font-bold text-slate-900 mb-1">{step.t}</p>
                    <p className="text-sm text-slate-500 leading-relaxed">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleRequest} disabled={submitting} className="w-full btn-primary mt-10">
              {submitting ? 'Solicitando...' : 'EMPEZAR VERIFICACIÓN'}
            </button>
          </div>
          <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl rounded-full" />
            <ShieldCheck className="w-16 h-16 mb-8 opacity-50" />
            <h3 className="text-2xl font-display font-extrabold mb-4">¿Por qué verificar?</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm font-medium">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                Aparecé primero en los resultados de búsqueda.
              </li>
              <li className="flex items-start gap-3 text-sm font-medium">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                Insignia de confianza en tu perfil público.
              </li>
              <li className="flex items-start gap-3 text-sm font-medium">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                Acceso a grupos exclusivos de roomies verificados.
              </li>
            </ul>
          </div>
        </div>
      )}

      {status === 'pending_verification' && verification && (
        <div className="card p-10 text-center">
          <div className="max-w-md mx-auto">
            <div className="mb-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tu código único</p>
              <div className="bg-slate-900 text-orange-500 font-mono font-bold text-4xl py-6 rounded-3xl tracking-[0.5em] shadow-2xl">
                {verification.verification_code}
              </div>
            </div>

            {!verification.selfie_url ? (
              <div className="space-y-8">
                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4 text-left">
                  <Info className="text-blue-500 flex-shrink-0 mt-1" size={20} />
                  <p className="text-sm text-blue-700 font-medium">
                    Escribí el código en un papel, sacate una selfie sosteniéndolo y subila aquí. Asegurate de que tu cara y el código sean legibles.
                  </p>
                </div>

                {selfiePreview && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative rounded-3xl overflow-hidden border-4 border-white shadow-2xl"
                  >
                    <img src={selfiePreview} alt="Preview" className="w-full h-64 object-cover" />
                    <button onClick={() => { setSelfieFile(null); setSelfiePreview(null); }} className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-xl shadow-lg">
                      <XCircle size={20} />
                    </button>
                  </motion.div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                    <Camera size={20} /> {selfieFile ? 'Cambiar foto' : 'Tomar foto'}
                  </button>
                  {selfieFile && (
                    <button onClick={handleUploadSelfie} disabled={submitting} className="flex-1 btn-primary flex items-center justify-center gap-2">
                      {submitting ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                      Enviar selfie
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfieSelect} />
              </div>
            ) : (
              <div className="py-10">
                <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock size={40} />
                </div>
                <h3 className="text-2xl font-display font-extrabold text-slate-900 mb-2">Revisión en curso</h3>
                <p className="text-slate-500">Recibimos tu selfie. Nuestro equipo la revisará en las próximas 24-48 horas.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {status === 'verified' && (
        <div className="card p-20 text-center">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/10">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-4xl font-display font-extrabold text-slate-900 mb-4">¡Perfil Verificado!</h2>
          <p className="text-slate-500 text-lg max-w-sm mx-auto">Ya contás con el sello de confianza de JAIKO!. Tu perfil ahora es prioritario en las búsquedas.</p>
        </div>
      )}

      {status === 'rejected' && (
        <div className="card p-12 text-center border-red-100 bg-red-50/30">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={40} />
          </div>
          <h2 className="text-2xl font-display font-extrabold text-red-600 mb-2">Verificación Rechazada</h2>
          {verification?.rejection_reason && (
            <p className="text-slate-600 mb-8 p-4 bg-white rounded-2xl border border-red-100 italic">"{verification.rejection_reason}"</p>
          )}
          <button onClick={handleRequest} disabled={submitting} className="btn-primary bg-red-500 hover:bg-red-600">
            INTENTAR DE NUEVO
          </button>
        </div>
      )}
    </div>
  );
}
