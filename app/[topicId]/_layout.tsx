import { Stack } from 'expo-router';

export default function TopicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="summary" />
      <Stack.Screen name="reading-list" />
      <Stack.Screen name="books" />
    </Stack>
  );
}
