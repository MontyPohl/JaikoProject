import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const isWeb = Platform.OS === 'web'

const storage = {
  getItem: async (key) => {
    if (isWeb) return localStorage.getItem(key)
    return AsyncStorage.getItem(key)
  },
  setItem: async (key, value) => {
    if (isWeb) {
      localStorage.setItem(key, value)
      return
    }
    return AsyncStorage.setItem(key, value)
  },
  removeItem: async (key) => {
    if (isWeb) {
      localStorage.removeItem(key)
      return
    }
    return AsyncStorage.removeItem(key)
  },
}

export default storage