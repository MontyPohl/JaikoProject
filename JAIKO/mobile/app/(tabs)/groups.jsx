import { View, Text, StyleSheet } from 'react-native'

export default function GroupsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Grupos 👥</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18, fontWeight: 'bold' },
})