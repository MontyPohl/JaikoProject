import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { GoogleLogin } from "@react-oauth/google"   // ← NUEVO
import api from "../services/api"
import { toast } from "react-hot-toast"
import useAuthStore from "../context/authStore"      // ← NUEVO

export default function LoginPage() {
  const navigate = useNavigate()
  const { loginWithGoogle } = useAuthStore()         // ← NUEVO

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    if (token) {
      localStorage.setItem("token", token)
      toast.success("¡Bienvenido a Jaiko!")
      navigate("/profile")
    }
  }, [navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Completa todos los campos")
      return
    }
    try {
      setLoading(true)
      const { data } = await api.post("/auth/login", { email, password })
      if (remember) {
        localStorage.setItem("token", data.token)
      } else {
        sessionStorage.setItem("token", data.token)
      }
      toast.success("¡Bienvenido de vuelta!")
      navigate("/profile")
    } catch (err) {
      toast.error(err.response?.data?.error || "Credenciales incorrectas")
    } finally {
      setLoading(false)
    }
  }

  // ─── HANDLER GOOGLE CORREGIDO ────────────────────────────────────────────
  // credential es el id_token que el backend verifica con google.oauth2
  const handleGoogleSuccess = async (credentialResponse) => {
    const result = await loginWithGoogle(credentialResponse.credential)
    if (result.success) {
      toast.success("¡Bienvenido a Jaiko!")
      navigate(result.isNewUser ? "/edit-profile" : "/profile")
    } else {
      toast.error(result.error || "Error al iniciar sesión con Google")
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FF] px-4 font-sans">
      <div className="w-full max-w-[460px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-[#2563C8] tracking-tight">
            Jaik<span className="text-[#F5A623]">o!</span>
          </h1>
          <p className="text-[#64748B] text-sm font-semibold mt-1">
            Conecta con tu roomie ideal
          </p>
        </div>

        <div className="bg-white p-10 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E2E8F0]">
          <div className="flex bg-[#F4F7FF] rounded-[14px] p-1 mb-8">
            <button className="flex-1 py-2.5 text-sm font-bold bg-white text-[#2563C8] rounded-[10px] shadow-sm">
              Ingresar
            </button>
            <button
              onClick={() => navigate("/register")}
              className="flex-1 py-2.5 text-sm font-bold text-[#64748B] hover:text-[#2563C8] transition-colors"
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-[#1E293B] mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-[#E2E8F0] rounded-[14px] text-sm outline-none transition-all focus:border-[#F5A623] focus:ring-4 focus:ring-[#F5A623]/20 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#1E293B] mb-2">
                Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-[#E2E8F0] rounded-[14px] text-sm outline-none transition-all focus:border-[#F5A623] focus:ring-4 focus:ring-[#F5A623]/20 placeholder:text-gray-400"
              />
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <label className="flex items-center gap-2 text-[#64748B] cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={() => setRemember(!remember)}
                  className="accent-[#2563C8] w-4 h-4 rounded border-[#E2E8F0]"
                />
                <span className="group-hover:text-[#1E293B] transition-colors">
                  Recordar sesión
                </span>
              </label>
              <button type="button" className="text-[#2563C8] font-bold hover:text-[#1E4EA6]">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563C8] hover:bg-[#1E4EA6] text-white py-4 rounded-[14px] font-extrabold text-base shadow-lg shadow-blue-700/10 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>

          <div className="relative text-center my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]"></div>
            </div>
            <span className="relative px-4 bg-white text-[#64748B] text-[13px] font-medium">
              o ingresá con
            </span>
          </div>

          {/* ─── BOTÓN GOOGLE CORREGIDO ──────────────────────────────────────── */}
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
          {/* ─────────────────────────────────────────────────────────────────── */}

          <p className="text-center text-[13px] text-[#64748B] mt-8">
            ¿No tenés cuenta?{" "}
            <button
              onClick={() => navigate("/register")}
              className="text-[#2563C8] font-extrabold hover:underline"
            >
              Registrate gratis
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}