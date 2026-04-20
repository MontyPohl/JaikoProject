// mobile/app/(tabs)/index.jsx
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native'
// ← LogOut agregado al import
import { SlidersHorizontal, LogOut } from 'lucide-react-native'
import api from '@shared/services/api'
import useAuthStore from '@shared/context/authStore'
import ProfileCard from '../../components/ProfileCard'

const CITIES = [
  'Asunción', 'San Lorenzo', 'Luque', 'Fernando de la Mora',
  'Lambaré', 'Capiatá', 'Encarnación', 'Ciudad del Este',
]

const INITIAL_FILTERS = {
  city: 'Asunción',
  gender: '',
  pets: '',
  smoker: '',
  schedule: '',
}

export default function SearchScreen() {
  // ← logout agregado al destructuring
  const { token, logout } = useAuthStore()
  const [profiles,    setProfiles]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [filters,     setFilters]     = useState(INITIAL_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: 1,
        per_page: 50,
        city: filters.city,
      })
      if (filters.gender)   params.append('gender',   filters.gender)
      if (filters.pets)     params.append('pets',     filters.pets)
      if (filters.smoker)   params.append('smoker',   filters.smoker)
      if (filters.schedule) params.append('schedule', filters.schedule)

      const { data } = await api.get(`/profiles/search?${params}`)
      setProfiles(data.profiles || [])
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    if (token) {
      fetchProfiles()
    }
  }, [filters, token])

  // ← función logout: llama al authStore y deja que el auth guard
  // en _layout.jsx detecte token=null y redirija a /login automáticamente.
  // No necesitamos router.replace() acá — el guard lo hace solo.
  const handleLogout = async () => {
    await logout()
  }

  const activeFilterCount = [
    filters.gender, filters.pets,
    filters.smoker, filters.schedule,
  ].filter(Boolean).length

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Buscar Roomie</Text>
          <Text style={styles.subtitle}>
            {loading ? 'Buscando...' : `${profiles.length} perfiles encontrados`}
          </Text>
        </View>

        {/* Botones del header: filtros + logout */}
        <View style={styles.headerActions}>

          {/* Botón filtros — igual que antes */}
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilters(f => !f)}
          >
            <SlidersHorizontal size={18} color="#64748B" />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Botón logout — temporal hasta tener pantalla de Perfil */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <LogOut size={18} color="#94A3B8" />
          </TouchableOpacity>

        </View>
      </View>

      {/* Selector de ciudad */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cityScroll}
        contentContainerStyle={styles.cityScrollContent}
      >
        {CITIES.map(city => (
          <TouchableOpacity
            key={city}
            style={[
              styles.cityChip,
              filters.city === city && styles.cityChipActive,
            ]}
            onPress={() => setFilters(f => ({ ...f, city }))}
          >
            <Text style={[
              styles.cityChipText,
              filters.city === city && styles.cityChipTextActive,
            ]}>
              {city}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Panel de filtros expandible */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <FilterRow
            label="Género"
            options={[
              { value: '', label: 'Cualquiera' },
              { value: 'male', label: 'Hombre' },
              { value: 'female', label: 'Mujer' },
              { value: 'other', label: 'Otro' },
            ]}
            value={filters.gender}
            onChange={v => setFilters(f => ({ ...f, gender: v }))}
          />
          <FilterRow
            label="Mascotas"
            options={[
              { value: '', label: 'Cualquiera' },
              { value: 'true', label: 'Con mascotas' },
              { value: 'false', label: 'Sin mascotas' },
            ]}
            value={filters.pets}
            onChange={v => setFilters(f => ({ ...f, pets: v }))}
          />
          <FilterRow
            label="Fumador"
            options={[
              { value: '', label: 'Cualquiera' },
              { value: 'false', label: 'No fuma' },
              { value: 'true', label: 'Fuma' },
            ]}
            value={filters.smoker}
            onChange={v => setFilters(f => ({ ...f, smoker: v }))}
          />
          <FilterRow
            label="Horario"
            options={[
              { value: '', label: 'Cualquiera' },
              { value: 'morning', label: 'Mañana' },
              { value: 'afternoon', label: 'Tarde' },
              { value: 'night', label: 'Noche' },
              { value: 'flexible', label: 'Flexible' },
            ]}
            value={filters.schedule}
            onChange={v => setFilters(f => ({ ...f, schedule: v }))}
          />
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setFilters(INITIAL_FILTERS)}
          >
            <Text style={styles.clearBtnText}>Limpiar filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de perfiles */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No encontramos roomies</Text>
          <Text style={styles.emptyDesc}>
            Probá cambiando la ciudad o los filtros
          </Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={p => String(p.user_id)}
          renderItem={({ item }) => (
            <ProfileCard profile={item} compatibility={item.compatibility} />
          )}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

// ─── Componente FilterRow ─────────────────────────────────────────────────────
// Separado en su propia función porque se repite 4 veces.
// Clean Code: si copiás y pegás código más de 2 veces, extraelo en una función.

function FilterRow({ label, options, value, onChange }) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterOptions}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.filterOption,
                value === opt.value && styles.filterOptionActive,
              ]}
              onPress={() => onChange(opt.value)}
            >
              <Text style={[
                styles.filterOptionText,
                value === opt.value && styles.filterOptionTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 52,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 13,
    color: '#F97316',
    fontWeight: '600',
    marginTop: 2,
  },

  // ← nuevo: agrupa los dos botones del header en fila
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  filterBtn: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    backgroundColor: '#F97316',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },

  // ← nuevo: mismo estilo que filterBtn pero sin borde activo
  logoutBtn: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  cityScroll: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexGrow: 0,
  },
  cityScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cityChipActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  cityChipTextActive: {
    color: '#fff',
  },
  filterPanel: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  filterRow: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterOptionActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
  },
  filterOptionText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#F97316',
    fontWeight: '700',
  },
  clearBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  row: {
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})