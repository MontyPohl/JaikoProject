// mobile/app/login.jsx
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
} from 'react-native'
import { useRouter } from 'expo-router'
import useAuthStore from '@shared/context/authStore'

// KeyboardAvoidingView: cuando el teclado aparece en el celular,
// empuja el formulario hacia arriba para que no quede tapado.
// Platform.OS: en iOS el comportamiento es 'padding', en Android 'height'.

export default function LoginScreen() {
  const router = useRouter()
  const { login } = useAuthStore()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Completá todos los campos')
      return
    }

    setLoading(true)
    const result = await login({ email, password })
    setLoading(false)

    if (result.success) {
      router.replace('/(tabs)')
    } else {
      Alert.alert('Error', result.error || 'Credenciales incorrectas')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo / Título */}
        <View style={styles.header}>
          <Text style={styles.logo}>JAIKO!</Text>
          <Text style={styles.subtitle}>Encontrá tu roomie ideal</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>

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

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu contraseña"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            // onSubmitEditing: al tocar "listo" en el teclado, envía el form
          />

          {/* Botón principal */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
            }
          </TouchableOpacity>

          {/* ── Link a Registro ── */}
          {/* router.replace en vez de push: reemplaza la pantalla actual en el
              historial. Si el usuario va a Registro y toca "atrás", no vuelve
              a Login sino que sale de la app — evita loops de navegación. */}
          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.replace('/register')}
          >
            <Text style={styles.registerLinkText}>
              ¿No tenés cuenta?{' '}
              <Text style={styles.registerLinkBold}>Registrate</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  inner: {
    flex: 1,
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
    color: '#F97316',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
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
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Link a registro
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerLinkBold: {
    color: '#F97316',
    fontWeight: '700',
  },
})