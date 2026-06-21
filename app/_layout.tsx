import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pressable, Text } from 'react-native';
import { useEffect } from 'react';
import { theme } from '../src/components/theme';
import { useRadioStore } from '../src/store/radioStore';

/** 🎷 toggle — lives in the home screen header. */
function RadioToggle() {
  const isPlaying = useRadioStore((s) => s.isPlaying);
  const toggle = useRadioStore((s) => s.toggle);

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      style={{ paddingHorizontal: 12 }}
      accessibilityLabel={isPlaying ? 'Pause jazz radio' : 'Play jazz radio'}
      accessibilityRole="button"
    >
      <Text style={{ fontSize: 22, opacity: isPlaying ? 1 : 0.4 }}>
        🎷
      </Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const init = useRadioStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.color.feltBgDark },
          headerTintColor: theme.color.textOnDark,
          contentStyle: { backgroundColor: theme.color.feltBg },
          headerRight: () => <RadioToggle />,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Shed',
          }}
        />
        <Stack.Screen name="setup" options={{ title: 'Players' }} />
        <Stack.Screen name="swap" options={{ title: 'Swap cards' }} />
        <Stack.Screen name="game" options={{ title: 'Shed', headerBackVisible: false }} />
        <Stack.Screen name="game-over" options={{ title: 'Game over', headerBackVisible: false }} />
        <Stack.Screen name="rules" options={{ title: 'Rules', presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
