import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-12"
      >
        <div className="text-[12rem] font-display font-black text-slate-100 leading-none">404</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 bg-orange-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-orange-500/40 rotate-12">
            <span className="text-6xl">🏠</span>
          </div>
        </div>
      </motion.div>
      
      <h1 className="text-4xl font-display font-extrabold text-slate-900 mb-4">¡Ups! Te perdiste</h1>
      <p className="text-slate-500 text-lg max-w-md mx-auto mb-10">
        La página que estás buscando no existe o fue movida a un nuevo departamento.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/" className="btn-primary flex items-center gap-2">
          <Home size={20} /> VOLVER AL INICIO
        </Link>
        <button onClick={() => window.history.back()} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={20} /> REGRESAR
        </button>
      </div>
    </div>
  );
}
