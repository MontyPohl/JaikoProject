import React from 'react';
// ✅ CAMBIO: Import local desde assets en vez de URL externa de OpenAI.
//
// Por qué importamos la imagen así (no con <img src="...url externa...">):
// ─────────────────────────────────────────────────────────────────────────
// 1. Las URLs externas pueden EXPIRAR o caerse (como pasaba antes).
// 2. Vite convierte este import en una URL estable dentro del bundle final,
//    con hash para cache busting automático.
// 3. Carga INSTANTÁNEA, sin requests HTTP adicionales.
//
// Beneficio para el usuario: logo siempre visible, sin parpadeo ni broken images.
import logoImg from '../../assets/logo.png';

/**
 * Props:
 *   className  → tamaño de la imagen (default: "w-10 h-10")
 *   showText   → muestra/oculta el texto "JAIKO!" al lado del ícono
 */
export default function Logo({ className = 'w-10 h-10', showText = true }) {
  return (
    <div className="flex items-center gap-2 group">
      <img
        src={logoImg}
        alt="JAIKO! — Plataforma para encontrar roomies en Paraguay"
        className={`object-contain flex-shrink-0
          drop-shadow-md group-hover:scale-110 transition-transform duration-300
          ${className}`}
      />
      {showText && (
        <span className="text-2xl font-display font-extrabold tracking-tighter text-slate-900">
          JAIK<span className="text-blue-600">O!</span>
        </span>
      )}
    </div>
  );
}
