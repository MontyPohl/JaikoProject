import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "react-hot-toast"
import useAuthStore from "../context/authStore"

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuthStore()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const SITE_KEY = "6LeFE54sAAAAANoCNMtlX1CWET8BuIg6zcy4XE-8"

  const handleRegister = async (e) => {
    e.preventDefault()

    if (!name || !email || !password || !confirmPassword) {
      toast.error("Completá todos los campos")
      return
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    setLoading(true)

    const recaptcha = window.grecaptcha?.enterprise;

    if (!recaptcha) {
      toast.error("El sistema de seguridad no cargó. Refrescá con F5.")
      setLoading(false)
      return
    }

    recaptcha.ready(async () => {
      try {
        const token = await recaptcha.execute(SITE_KEY, { action: 'register' });

        const result = await register({
          name,
          email,
          password,
          captcha_token: token
        })

        if (result.success) {
          toast.success("¡Cuenta creada! Completá tu perfil")
          navigate("/profile/edit")
        } else {
          toast.error(result.error || "Error al crear la cuenta")
        }
      } catch (error) {
        console.error("Error reCAPTCHA:", error)
        toast.error("Fallo en la validación de seguridad.")
      } finally {
        setLoading(false)
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7FF] px-4 font-['Nunito']">
      <div className="w-full max-w-[460px]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-[#2563C8] font-['Poppins'] tracking-tight">
            Jaik<span className="text-[#F5A623]">o!</span>
          </h1>
          <p className="text-[#64748B] text-sm mt-1 font-semibold">
            Conecta con tu roomie ideal
          </p>
        </div>

        <div className="bg-white p-10 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E2E8F0]">
          <div className="flex bg-[#F4F7FF] rounded-[14px] p-1 mb-8">
            <button
              onClick={() => navigate("/login")}
              className="flex-1 py-2.5 text-sm font-bold text-[#64748B] hover:text-[#2563C8] transition-colors"
            >
              Ingresar
            </button>
            <button className="flex-1 py-2.5 text-sm font-bold bg-white text-[#2563C8] rounded-[10px] shadow-sm">
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-[#1E293B] mb-2">Nombre completo</label>
              <input
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-[#E2E8F0] rounded-[14px] text-sm outline-none transition-all focus:border-[#F5A623] focus:ring-4 focus:ring-[#F5A623]/20 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#1E293B] mb-2">Correo electrónico</label>
              <input
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-[#E2E8F0] rounded-[14px] text-sm outline-none transition-all focus:border-[#F5A623] focus:ring-4 focus:ring-[#F5A623]/20 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#1E293B] mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-[#E2E8F0] rounded-[14px] text-sm outline-none transition-all focus:border-[#F5A623] focus:ring-4 focus:ring-[#F5A623]/20 placeholder:text-gray-400 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#1E293B] mb-2">Confirmar contraseña</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Repetí tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-[#E2E8F0] rounded-[14px] text-sm outline-none transition-all focus:border-[#F5A623] focus:ring-4 focus:ring-[#F5A623]/20 placeholder:text-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-[14px] font-extrabold text-base transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg bg-[#2563C8] hover:bg-[#1E4EA6] text-white shadow-blue-700/10 ${loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Procesando...
                </>
              ) : (
                "Crear cuenta gratis"
              )}
            </button>
          </form>

          <p className="text-center text-[13px] text-[#64748B] mt-8">
            ¿Ya tenés cuenta?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-[#2563C8] font-extrabold hover:underline"
            >
              Ingresá aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
