// mobile/app/(tabs)/_layout.jsx
import { Tabs } from 'expo-router'
import { Search, Building2, Users, MessageSquare } from 'lucide-react-native'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#F97316',
      tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: {
        borderTopColor: '#F1F5F9',
        backgroundColor: '#fff',
      },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Dptos',
          tabBarIcon: ({ color }) => <Building2 size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Grupos',
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MessageSquare size={22} color={color} />,
        }}
      />
    </Tabs>
  )
}