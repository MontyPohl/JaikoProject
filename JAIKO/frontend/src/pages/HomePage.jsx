import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  Zap, 
  Users, 
  Lightbulb, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2,
  Home as HomeIcon,
  Search,
  MessageCircle,
  ChevronRight
} from "lucide-react";

const FEATURES = [
  { 
    icon: <ShieldCheck className="w-6 h-6" />, 
    title: "Seguro", 
    desc: "Todos los perfiles son verificados para tu tranquilidad.",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20"
  },
  { 
    icon: <Zap className="w-6 h-6" />, 
    title: "Rápido", 
    desc: "Encuentra tu roomie ideal en minutos con nuestro sistema inteligente.",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20"
  },
  { 
    icon: <Users className="w-6 h-6" />, 
    title: "Confiable", 
    desc: "Conexiones exitosas y perfiles verificados garantizan confianza.",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
  },
  { 
    icon: <Lightbulb className="w-6 h-6" />, 
    title: "Fácil", 
    desc: "Interfaz intuitiva para crear perfil y buscar roommates sin complicaciones.",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20"
  },
];

const SLIDES = [
  { 
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=2070",
    title: "Viví con roomies segura y sin dramas",
    subtitle: "Tu grupo seguro para compartir el hogar."
  },
  { 
    image: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&q=80&w=2070",
    title: "Encuentra a tu rumi ideal según tus preferencias",
    subtitle: "Match inteligente basado en tu estilo de vida."
  },
  { 
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2070",
    title: "Alquila tus departamentos de forma inteligente",
    subtitle: "Gestión segura para propietarios y edificios."
  },
];

const STEPS = [
  { step: '01', icon: <HomeIcon className="w-8 h-8" />, title: 'Creá tu perfil', desc: 'Contanos sobre vos, tus hábitos y presupuesto.', bg: 'bg-orange-500', textColor: 'text-orange-600' },
  { step: '02', icon: <Search className="w-8 h-8" />, title: 'Explorá perfiles', desc: 'Match inteligente según tus preferencias.', bg: 'bg-blue-600', textColor: 'text-blue-600' },
  { step: '03', icon: <MessageCircle className="w-8 h-8" />, title: 'Conectá y acordá', desc: 'Chat seguro para conocer a tu futuro roomie.', bg: 'bg-emerald-500', textColor: 'text-emerald-600' },
  { step: '04', icon: <Sparkles className="w-8 h-8" />, title: '¡A vivir!', desc: 'Mudate y disfrutá de compartir gastos.', bg: 'bg-rose-500', textColor: 'text-rose-600' },
];

const HomePage = () => {
  const [current, setCurrent] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 z-0"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/20 to-white z-10" />
            <img 
              src={SLIDES[current].image} 
              alt="Background" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-20 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-md border border-slate-200 text-xs font-bold uppercase tracking-widest mb-8 text-slate-600"
          >
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>La forma más inteligente de compartir</span>
          </motion.div>

          <motion.h1 
            key={`title-${current}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-8xl font-display font-extrabold tracking-tight leading-[0.9] mb-6 text-slate-900"
          >
            {SLIDES[current].title.split(" ").map((word, i) => (
              <span key={i} className={word === "segura" || word === "ideal" || word === "inteligente" ? "text-orange-500 block md:inline" : ""}>
                {word}{" "}
              </span>
            ))}
          </motion.h1>

          <motion.p 
            key={`sub-${current}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 font-medium"
          >
            {SLIDES[current].subtitle}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/login" className="group relative px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-orange-500/40">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative flex items-center gap-2">
                EMPEZAR AHORA <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <a href="#how-it-works" className="px-8 py-4 rounded-2xl font-bold text-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 transition-all">
              Ver cómo funciona
            </a>
          </motion.div>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                current === i ? "bg-orange-500 w-12" : "bg-slate-300 w-3 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-display font-extrabold mb-6 tracking-tight text-slate-900">
              ¿Cómo <span className="text-orange-500">funciona</span>?
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              En solo 4 pasos estás conectando con tu futuro roomie de manera segura y divertida.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 hover:border-orange-500/50 transition-all duration-500 shadow-xl shadow-slate-200/50"
              >
                <div className="absolute top-6 right-8 text-5xl font-display font-black text-slate-100 group-hover:text-slate-200 transition-colors">
                  {step.step}
                </div>
                <div className={`w-16 h-16 rounded-2xl ${step.bg} flex items-center justify-center mb-6 text-white shadow-lg shadow-${step.bg.split('-')[1]}-500/30`}>
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-32 px-6 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-6xl font-display font-extrabold mb-8 tracking-tight leading-tight text-slate-900">
                Diseñado para <br />
                <span className="text-orange-500">vivir sin dramas</span>
              </h2>
              <p className="text-slate-500 text-lg mb-12 leading-relaxed">
                Nos enfocamos en la seguridad y la compatibilidad para que tu única preocupación sea elegir qué película ver el viernes por la noche.
              </p>
              
              <div className="space-y-6">
                {["Perfiles 100% verificados", "Match por estilo de vida", "Chat seguro integrado"].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="font-medium text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-8 rounded-[2.5rem] border ${f.color} flex flex-col gap-4 hover:scale-105 transition-transform duration-300 bg-white shadow-sm`}
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="relative p-12 md:p-20 rounded-[3rem] bg-orange-500 overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
            <h2 className="relative z-10 text-4xl md:text-6xl font-display font-extrabold mb-8 tracking-tight text-white">
              ¿Listo para encontrar <br /> a tu roomie ideal?
            </h2>
            <Link to="/login" className="relative z-10 inline-flex items-center gap-3 px-10 py-5 bg-white text-orange-500 rounded-2xl font-bold text-xl hover:scale-105 active:scale-95 transition-all shadow-xl">
              EMPEZAR AHORA <ChevronRight />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
