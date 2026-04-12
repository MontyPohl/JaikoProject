import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff, Home as HomeIcon, User, Mail, Lock } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "motion/react";
import useAuthStore from "../context/authStore";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Key de reCAPTCHA Enterprise
  const SITE_KEY = "6LeFE54sAAAAANoCNMtlX1CWET8BuIg6zcy4XE-8";

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      toast.error("Completá todos los campos");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    // Lógica de reCAPTCHA Enterprise
    const recaptcha = window.grecaptcha?.enterprise;

    if (!recaptcha) {
      toast.error("El sistema de seguridad no cargó. Refrescá con F5.");
      setLoading(false);
      return;
    }

    recaptcha.ready(async () => {
      try {
        const token = await recaptcha.execute(SITE_KEY, { action: 'register' });

        const result = await register({
          name,
          email,
          password,
          captcha_token: token
        });

        if (result.success) {
          toast.success("¡Cuenta creada! Completá tu perfil");
          navigate("/profile/edit");
        } else {
          toast.error(result.error || "Error al crear la cuenta");
        }
      } catch (error) {
        console.error("Error reCAPTCHA:", error);
        toast.error("Fallo en la validación de seguridad.");
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      {/* Elementos de fondo decorativos */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <HomeIcon className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-display font-extrabold tracking-tighter text-slate-900">
              JAIK<span className="text-blue-600">O!</span>
            </span>
          </Link>
          <h2 className="text-3xl font-display font-extrabold mb-2 text-slate-900">Creá tu cuenta</h2>
          <p className="text-slate-500 text-sm">Unite a la comunidad de roomies más grande.</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl">
          <div className="flex bg-slate-50 rounded-2xl p-1 mb-8">
            <button
              onClick={() => navigate("/login")}
              className="flex-1 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Ingresar
            </button>
            <button className="flex-1 py-2.5 text-sm font-bold bg-white text-orange-500 rounded-xl shadow-sm">
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Nombre */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input pl-12"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-12"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirmar Contraseña */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repetí tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pl-12"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Procesando...
                </>
              ) : (
                "CREAR CUENTA GRATIS"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8">
            ¿Ya tenés cuenta?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-blue-600 font-extrabold hover:underline"
            >
              Ingresá aquí
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}