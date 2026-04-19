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

  // ← agregá estos logs
  console.log('resultado login:', JSON.stringify(result))

  if (result.success) {
    console.log('login exitoso, redirigiendo...')
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

        {/* Título */}
        <Text style={styles.title}>JAIKO</Text>
        <Text style={styles.subtitle}>Encontrá tu roomie ideal</Text>

        {/* Formulario */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Ingresar</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Link a registro */}
        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={styles.link}>
            ¿No tenés cuenta?{' '}
            <Text style={styles.linkBold}>Registrate</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#F97316',  // naranja JAIKO
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: '#F97316',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  linkBold: {
    color: '#F97316',
    fontWeight: 'bold',
  },
})