import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Button } from '../src/components/Button';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';

export default function HomeScreen() {
  const router = useRouter();
  const reset = useGameStore((s) => s.reset);
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>SHED</Text>
        <Text style={styles.subtitle}>The card game as spake by Jake</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="New game"
          onPress={() => {
            reset();
            router.push('/setup');
          }}
        />
        <Button
          title="Tutorial"
          variant="ghost"
          onPress={() => router.push('/tutorial')}
        />
        <Link href="/rules" asChild>
          <Button title="Rules" variant="ghost" onPress={() => {}} />
        </Link>
      </View>

      <View style={styles.footerContainer}>
        <Text style={styles.footer}>
          Long live Jake the Elder. 🪲
        </Text>
        <Text style={styles.version}>
          v{appVersion}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.space.xl,
    backgroundColor: theme.color.feltBg,
    justifyContent: 'space-between',
  },
  hero: { marginTop: 60, alignItems: 'center' },
  title: {
    color: theme.color.textOnDark,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 6,
  },
  subtitle: {
    color: theme.color.accent,
    fontSize: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },
  actions: { marginBottom: 40 },
  footerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  footer: {
    color: theme.color.textMuted,
    textAlign: 'center',
    fontSize: 12,
  },
  version: {
    color: theme.color.textMuted,
    textAlign: 'center',
    fontSize: 10,
    marginTop: 4,
    opacity: 0.5, // Dimmed slightly so it doesn't distract from the quote
  },
});
