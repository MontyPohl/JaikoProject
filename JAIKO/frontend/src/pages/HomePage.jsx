import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "react-feather";

import publicidad1 from "../assets/publicidad1.png";
import publicidad3 from "../assets/publicidad3.png";
import publicidad4 from "../assets/publicidad4.png";

const isAuthenticated = () => false;

const FEATURES = [
  { icon: "🔒", title: "Seguro", desc: "Todos los perfiles son verificados para tu tranquilidad." },
  { icon: "⚡", title: "Rápido", desc: "Encuentra tu roomie ideal en minutos con nuestro sistema inteligente." },
  { icon: "🤝", title: "Confiable", desc: "Conexiones exitosas y perfiles verificados garantizan confianza." },
  { icon: "💡", title: "Fácil", desc: "Interfaz intuitiva para crear perfil y buscar roommates sin complicaciones." },
];

const slides = [
  { image: publicidad1 },
  { image: publicidad3 },
  { image: publicidad4 },
];

const HomePage = () => {
  const [current, setCurrent] = useState(0);

  // Refs para secciones
  const heroRef = useRef(null);
  const howItWorksRef = useRef(null);
  const featuresRef = useRef(null);

  // Control de sección actual
  const sections = [heroRef, howItWorksRef, featuresRef];
  const [currentSection, setCurrentSection] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Scroll con flechas
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentSection + 1, sections.length - 1);
        setCurrentSection(next);
        sections[next]?.current?.scrollIntoView({ behavior: "smooth" });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentSection - 1, 0);
        setCurrentSection(prev);
        sections[prev]?.current?.scrollIntoView({ behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSection]);

  return (
    <div className="flex flex-col font-main bg-[#F4F7FF] text-[#1E293B]">

      {/* Hero */}
      <div ref={heroRef} className="relative w-full h-screen overflow-hidden bg-white">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out
              ${current === index ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            <div className="relative w-full h-full pt-[40px] flex items-center justify-center overflow-hidden bg-gray-50 z-0">
              <img
                src={slide.image}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-fill object-center"
              />
            </div>

            {/* Div azul */}
            <div className="absolute bottom-[-1vh] left-0 w-full h-[17vh] flex flex-col items-center justify-center z-30 backdrop-blur-md border-t border-white/20 shadow-2xl bg-transparent">
              <Link
                to="/login"
                className="relative z-1 px-4 py-2 text-xl font-black text-white rounded-2xl transition-all duration-300 ease-out
                           bg-gradient-to-r from-[#F5A623] to-[#FFB347] shadow-[0_10px_25px_rgba(245,166,35,0.5)]
                           border-t border-white/30 hover:scale-[1.05] hover:brightness-110 active:scale-95
                           mt-[-30px] flex items-center justify-center"
              >
                <span className="drop-shadow-md">EMPIEZA AHORA</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

{/* How it works section */}
<section ref={howItWorksRef} className="section bg-[#F4F7FF] py-20">
  <h2 className="section-title text-center mb-4 text-4xl md:text-5xl font-alt font-bold">
    ¿Cómo <span className="text-[#2563C8]">funciona</span>?
  </h2>
  <p className="section-sub text-center mb-12 text-lg md:text-xl text-[#64748B] max-w-2xl mx-auto">
    En solo 4 pasos estás conectando con tu futuro roomie de manera segura y divertida
  </p>
  <div className="flex flex-wrap justify-center gap-6">
    {[ 
      { step: '1', icon: '📝', title: 'Creá tu perfil', desc: 'Contanos sobre vos, tus hábitos, tu presupuesto y la zona donde querés vivir.', bg: 'from-[#EFF6FF] to-[#DBEAFE]' },
      { step: '2', icon: '🔍', title: 'Explorá perfiles', desc: 'Nuestro sistema te muestra personas compatibles según tus preferencias de vida.', bg: 'from-[#FFF7ED] to-[#FFEDD5]' },
      { step: '3', icon: '💬', title: 'Conectá y acordá', desc: 'Chatéen, conózcanse y definan los términos del alquiler compartido juntos.', bg: 'from-[#F0FDF4] to-[#DCFCE7]' },
      { step: '4', icon: '🏡', title: '¡A vivir!', desc: 'Mudense y disfruten de su nuevo hogar compartiendo los gastos equitativamente.', bg: 'from-[#FFF1F2] to-[#FFE4E6]' },
    ].map(({ step, icon, title, desc, bg }) => (
      <div
        key={step}
        className="relative bg-white p-5 w-56 rounded-2xl shadow-sm transition-all transform hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(251,191,36,0.5)]"
        style={{ transition: 'all 0.3s ease' }}
      >
        <div className="step-num absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-r from-[#2563C8] to-[#3B82F6] flex items-center justify-center text-white text-lg font-bold shadow-md">
          {step}
        </div>
        <div className={`step-icon w-16 h-16 mx-auto mb-3 rounded-xl flex items-center justify-center text-4xl bg-gradient-to-br ${bg} shadow-inner`}>
          {icon}
        </div>
        <h3 className="font-alt font-bold text-base text-[#1E293B] mb-1 text-center">{title}</h3>
        <p className="text-sm text-[#64748B] text-center">{desc}</p>
      </div>
    ))}
  </div>
</section>

{/* Features section */}
<section ref={featuresRef} className="section py-20 bg-white">
  <h2 className="section-title text-center mb-4 text-4xl md:text-5xl font-alt font-bold">
    ¿Por qué elegir <span className="text-[#2563C8]">JAIK</span><span className="text-[#FBBF24]">O!</span>?
  </h2>
  <p className="section-sub text-center mb-12 text-lg md:text-xl text-[#64748B] max-w-2xl mx-auto">
    Diseñado para que encontrar roomie sea seguro, rápido y sin dramas
  </p>
  <div className="features-grid flex flex-wrap justify-center gap-4">
    {FEATURES.map(({ icon, title, desc }) => (
      <div
        key={title}
        className="feat-card flex flex-col items-center text-center gap-2 p-5 w-64 rounded-2xl border border-[#E2E8F0] shadow-sm transition-all transform hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(251,191,36,0.5)] bg-white"
      >
        <div className="feat-icon w-14 h-14 flex items-center justify-center rounded-xl mb-2 bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] shadow-inner">
          <span className="text-2xl">{icon}</span>
        </div>
        <h3 className="font-alt font-bold text-base text-[#1E293B]">{title}</h3>
        <p className="text-sm text-[#64748B]">{desc}</p>
      </div>
    ))}
  </div>
</section>

    </div>
  );
};

export default HomePage;