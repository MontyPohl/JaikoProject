// mobile/app/_layout.jsx
import { useEffect, useRef } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import useAuthStore from '@shared/context/authStore'

export default function RootLayout() {
  const router   = useRouter()
  const segments = useSegments()
  const { fetchMe, token, loading } = useAuthStore()

  // Guardamos el timer para poder cancelarlo si el componente
  // se desmonta antes de que se ejecute — evita memory leaks
  const timerRef = useRef(null)

  useEffect(() => {
    fetchMe()
  }, [])

  useEffect(() => {
    if (loading) return

    const enTabsProtegidas  = segments[0] === '(tabs)'
    const enPantallaPublica = !enTabsProtegidas && segments[0] !== 'profile'

    let destino = null

    if (!token && enTabsProtegidas) {
      destino = '/login'
    } else if (token && enPantallaPublica) {
      destino = '/(tabs)'
    }

    if (!destino) return

    // ¿Por qué setTimeout con 0ms?
    // Los useEffect corren JUSTO después del render, pero Expo Router
    // necesita un tick más para registrar internamente su navegador.
    // Con setTimeout(fn, 0) le damos ese tick extra — la función corre
    // en el siguiente ciclo del event loop, cuando todo ya está listo.
    timerRef.current = setTimeout(() => {
      router.replace(destino)
    }, 0)

    // Cleanup: si el componente se desmonta antes del timeout, lo cancelamos
    return () => clearTimeout(timerRef.current)

  }, [token, segments, loading])

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
})