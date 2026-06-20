import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/components/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.color.feltBgDark },
          headerTintColor: theme.color.textOnDark,
          contentStyle: { backgroundColor: theme.color.feltBg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Shed' }} />
        <Stack.Screen name="setup" options={{ title: 'Players' }} />
        <Stack.Screen name="swap" options={{ title: 'Swap cards' }} />
        <Stack.Screen name="game" options={{ title: 'Shed', headerBackVisible: false }} />
        <Stack.Screen name="game-over" options={{ title: 'Game over', headerBackVisible: false }} />
        <Stack.Screen name="rules" options={{ title: 'Rules', presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
