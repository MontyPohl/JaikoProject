// mobile/components/ProfileCard.jsx
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export default function ProfileCard({ profile, compatibility }) {
  const router = useRouter()

  const compatPct = compatibility != null
    ? Math.round(compatibility * 100)
    : null

  const compatColor = compatPct >= 80
    ? '#16A34A'
    : compatPct >= 60
    ? '#F97316'
    : '#94A3B8'

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/profile/${profile.user_id}`)}
      activeOpacity={0.85}
    >
      {/* Foto */}
      <View style={styles.photoContainer}>
        {profile.profile_photo_url ? (
          <Image
            source={{ uri: profile.profile_photo_url }}
            style={styles.photo}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoInitial}>
              {profile.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}

        {/* Badge de compatibilidad */}
        {compatPct != null && (
          <View style={[styles.compatBadge, { backgroundColor: compatColor }]}>
            <Text style={styles.compatText}>{compatPct}%</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.name || 'Sin nombre'}
        </Text>

        {profile.profession && (
          <Text style={styles.profession} numberOfLines={1}>
            {profile.profession}
          </Text>
        )}

        <View style={styles.tags}>
          {profile.age && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{profile.age} años</Text>
            </View>
          )}
          {profile.city && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{profile.city}</Text>
            </View>
          )}
        </View>

        {profile.budget_max && (
          <Text style={styles.budget}>
            Hasta ₲ {(profile.budget_max / 1000000).toFixed(1)}M
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 180,
  },
  photoPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitial: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  compatBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  compatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  info: {
    padding: 12,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  profession: {
    fontSize: 13,
    color: '#F97316',
    fontWeight: '600',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  budget: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
})