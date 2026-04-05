import React from 'react';
import { Pressable, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme/index';
import UserMenu from '../../src/components/UserMenu';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        headerShown: true,
        headerStyle: {
          backgroundColor: '#142735',
        },
        headerTintColor: '#f9f9f9',
        headerTitleStyle: {
          fontFamily: 'Source Sans Pro',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontSize: 16,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundLight,
          borderTopWidth: 2,
          borderTopColor: '#d9d9d9',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Daily Summary',
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => router.push('/modal')}
                style={{ marginRight: 8, padding: 8 }}
              >
                <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
              </Pressable>
              <UserMenu />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reading-list"
        options={{
          title: 'Reading List',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" size={size} color={color} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => router.push('/modal')}
                style={{ marginRight: 8, padding: 8 }}
              >
                <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
              </Pressable>
              <UserMenu />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'Books',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => router.push('/modal')}
                style={{ marginRight: 8, padding: 8 }}
              >
                <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
              </Pressable>
              <UserMenu />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
