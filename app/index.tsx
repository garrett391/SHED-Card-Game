import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';

export default function HomeScreen() {
  const router = useRouter();
  const reset = useGameStore((s) => s.reset);

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
        <Link href="/rules" asChild>
          <Button title="Rules" variant="ghost" onPress={() => {}} />
        </Link>
      </View>

      <Text style={styles.footer}>
        Long live Elder Jake.
      </Text>
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
  footer: {
    color: theme.color.textMuted,
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 16,
  },
});
