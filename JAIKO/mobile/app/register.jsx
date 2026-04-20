// mobile/app/register.jsx
//
// Pantalla de Registro — JAIKO!
//
// Estructura:
//   validateForm()   → valida los campos antes de tocar la red
//   handleRegister() → llama al authStore y maneja la respuesta
//   JSX              → solo se ocupa de mostrar, no de lógica
//
// ¿Por qué separar validateForm()?
// Si en el futuro querés agregar más reglas (ej: contraseña mínimo 8 chars),
// solo tocás esa función. No tenés que buscar entre el JSX.

import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import useAuthStore from '@shared/context/authStore'

// ─── Validación ───────────────────────────────────────────────────────────────
// Función pura: recibe datos, devuelve un mensaje de error o null.
// "Función pura" = no modifica nada afuera, siempre devuelve lo mismo
// con los mismos parámetros. Eso la hace fácil de testear y de leer.

function validateForm({ name, email, password, confirmPassword }) {
  if (!name.trim() || !email.trim() || !password || !confirmPassword) {
    return 'Completá todos los campos'
  }
  if (!email.includes('@')) {
    return 'El email no es válido'
  }
  if (password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres'
  }
  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden'
  }
  return null // null = sin errores
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router  = useRouter()
  const { register } = useAuthStore()

  // Estado del formulario — cada campo tiene su propio estado.
  // ¿Por qué no un solo objeto { name, email, ... }?
  // Con campos separados, React solo re-renderiza cuando cambia ESE campo.
  // Con un objeto, cualquier cambio re-renderiza todo. Para un form pequeño
  // no importa mucho, pero es buena práctica desde el principio.
  const [name,            setName]            = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)

  // ─── Lógica de envío ────────────────────────────────────────────────────────
  const handleRegister = async () => {
    // Paso 1: validar localmente (sin red)
    const error = validateForm({ name, email, password, confirmPassword })
    if (error) {
      Alert.alert('Error', error)
      return
    }

    // Paso 2: llamar al backend a través del authStore
    // captcha_token: null → el backend lo acepta, lo ignoramos en mobile por ahora
    setLoading(true)
    const result = await register({
      name:          name.trim(),
      email:         email.trim().toLowerCase(),
      password,
      captcha_token: null,
    })
    setLoading(false)

    if (result.success) {
      // El authStore ya guardó el token y el user en el estado global.
      // replace() en lugar de push() para que el usuario no pueda volver
      // atrás con el botón back y terminar en el form de registro estando logueado.
      router.replace('/(tabs)')
    } else {
      Alert.alert('Error al registrarse', result.error || 'Intentá de nuevo')
    }
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────
  // KeyboardAvoidingView: cuando el teclado aparece, empuja el formulario
  // hacia arriba para que no quede tapado. Mismo patrón que login.jsx.
  // ScrollView adentro: si la pantalla es chica (ej: SE), el form no queda cortado.

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        // keyboardShouldPersistTaps="handled": permite tocar el botón
        // "Registrarse" aunque el teclado esté abierto, sin cerrarlo primero.
      >

        {/* Logo / Título */}
        <View style={styles.header}>
          <Text style={styles.logo}>JAIKO!</Text>
          <Text style={styles.subtitle}>Creá tu cuenta gratis</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>

          {/* Nombre completo */}
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: María García"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            // autoCapitalize="words": pone mayúscula en cada palabra del nombre
            returnKeyType="next"
          />

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          {/* Contraseña */}
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            // secureTextEntry: oculta los caracteres con puntos (••••)
            returnKeyType="next"
          />

          {/* Confirmar contraseña */}
          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Repetí tu contraseña"
            placeholderTextColor="#94A3B8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            // onSubmitEditing: cuando el usuario toca "listo" en el teclado
            // del último campo, envía el formulario automáticamente.
          />

          {/* Botón principal */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>CREAR CUENTA</Text>
            }
          </TouchableOpacity>

          {/* Link a Login */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.loginLinkText}>
              ¿Ya tenés cuenta?{' '}
              <Text style={styles.loginLinkBold}>Iniciá sesión</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
// StyleSheet.create() compila los estilos una sola vez al cargar el módulo.
// Si usáramos objetos literales ({ color: 'red' }) dentro del JSX, React Native
// los recrearía en cada render. Con StyleSheet eso no pasa → mejor performance.

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flexGrow: 1,
    // flexGrow: 1 hace que el ScrollView ocupe toda la pantalla disponible
    // aunque el contenido sea corto. Necesario para centrar verticalmente.
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    fontSize: 40,
    fontWeight: '900',
    color: '#F97316',   // naranja JAIKO
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 6,
  },

  // Formulario
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    // Sombra — en iOS y Android se configura diferente
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,   // elevation es la sombra en Android
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',   // slate JAIKO
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },

  // Botón
  button: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
    // Cuando está cargando, bajamos la opacidad para indicar
    // visualmente que no se puede tocar de nuevo.
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Link a login
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLinkBold: {
    color: '#F97316',
    fontWeight: '700',
  },
})