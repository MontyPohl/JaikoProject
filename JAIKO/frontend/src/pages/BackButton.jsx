import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * BackButton — Botón "Volver atrás" reutilizable
 *
 * ¿Por qué navigate(-1) en vez de <Link to="/alguna-ruta">?
 * ─────────────────────────────────────────────────────────
 * navigate(-1) usa el historial REAL del browser, igual que el botón
 * nativo del navegador. Si el usuario llegó a /profile/:id desde
 * /search, /groups, o desde una notificación, SIEMPRE vuelve al
 * lugar correcto.
 *
 * Con un Link fijo lo mandaríamos al lugar equivocado en muchos casos.
 *
 * Beneficio para el usuario: navegación intuitiva, predecible y sin sorpresas.
 */
export default function BackButton({ className = '' }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      aria-label="Volver a la página anterior"
      className={`inline-flex items-center gap-1.5 text-sm font-bold
        text-blue-900/50 hover:text-blue-600
        px-3 py-1.5 rounded-xl hover:bg-blue-50
        transition-all duration-200 active:scale-95
        ${className}`}
    >
      <ArrowLeft size={15} strokeWidth={2.5} />
      <span>Volver</span>
    </button>
  );
}
