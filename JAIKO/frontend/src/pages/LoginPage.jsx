import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Home as HomeIcon, Mail, Lock } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "react-hot-toast";
import { motion } from "motion/react";
import useAuthStore from "../context/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("jaiko_token", token);
      toast.success("¡Bienvenido a Jaiko!");
      navigate("/profile");
    }
  }, [navigate]);

  const redirectByRole = (role) => {
    if (role === "admin" || role === "verifier") {
      navigate("/admin");
    } else {
      navigate("/profile");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Completa todos los campos");
      return;
    }
    setLoading(true);
    const result = await login({ email, password });
    setLoading(false);

    if (result.success) {
      toast.success("¡Bienvenido de vuelta!");
      redirectByRole(result.role);
    } else {
      toast.error(result.error || "Credenciales incorrectas");
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const result = await loginWithGoogle(credentialResponse.credential);
    if (result.success) {
      toast.success("¡Bienvenido a Jaiko!");
      if (result.isNewUser) {
        navigate("/profile/edit");
      } else {
        redirectByRole(result.role);
      }
    } else {
      toast.error(result.error || "Error al iniciar sesión con Google");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      {/* Background elements */}
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
          <h2 className="text-3xl font-display font-extrabold mb-2 text-slate-900">¡Hola de nuevo!</h2>
          <p className="text-slate-500 text-sm">Ingresá tus datos para continuar.</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl">
          <div className="flex bg-slate-50 rounded-2xl p-1 mb-8">
            <button className="flex-1 py-2.5 text-sm font-bold bg-white text-orange-500 rounded-xl shadow-sm">
              Ingresar
            </button>
            <button
              onClick={() => navigate("/register")}
              className="flex-1 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
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

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-12"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-500 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={() => setRemember(!remember)}
                  className="accent-orange-500 w-4 h-4 rounded border-slate-200"
                />
                <span className="group-hover:text-slate-900 transition-colors font-medium">Recordar sesión</span>
              </label>
              <button type="button" className="text-blue-600 font-bold hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Ingresando...
                </>
              ) : (
                "INGRESAR"
              )}
            </button>
          </form>

          <div className="relative text-center my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <span className="relative px-4 bg-white text-slate-400 text-xs font-bold uppercase tracking-widest">o ingresá con</span>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Error al iniciar sesión con Google")}
              useOneTap
              theme="outline"
              size="large"
              width="400"
              text="continue_with"
              locale="es"
            />
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            ¿No tenés cuenta?{" "}
            <button
              onClick={() => navigate("/register")}
              className="text-orange-500 font-extrabold hover:underline"
            >
              Registrate gratis
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
