// mobile/app/_layout.jsx
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import useAuthStore from '@shared/context/authStore'

export default function RootLayout() {
  const { fetchMe, token } = useAuthStore()

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  // Log para ver si el token se carga
  useEffect(() => {
    console.log('token en layout:', token ? 'existe' : 'null')
  }, [token])

  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}