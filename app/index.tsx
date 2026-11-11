import { Link, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Button } from '../src/components/Button';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';

export default function HomeScreen() {
  const router = useRouter();
  // A game left unfinished (or cut off by a refresh) waits here. Dealing a
  // new one replaces it, so the other buttons leave it alone until then.
  const saved = useGameStore((s) => s.game);
  const savedTurn = saved && saved.phase === 'playing'
    ? saved.players[saved.currentPlayerIndex]
    : null;
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>SHED</Text>
        <Text style={styles.subtitle}>The card game as spake by Jake</Text>
      </View>

      <View style={styles.actions}>
        {saved && (
          <View style={styles.resume}>
            <Button
              title={saved.phase === 'gameOver' ? 'See results' : 'Resume game'}
              onPress={() => router.push(saved.phase === 'swap' ? '/swap' : '/game')}
            />
            <Text style={styles.resumeNote}>
              {saved.ruleConfig.name} · {saved.players.length} players
              {savedTurn ? ` · ${savedTurn.name}'s turn` : ''}
            </Text>
          </View>
        )}
        <Button
          title="Campaign"
          variant={saved ? 'ghost' : 'primary'}
          onPress={() => router.push('/campaign')}
        />
        <Button
          title="Free play"
          variant="ghost"
          onPress={() => router.push('/setup')}
        />
        <Button
          title="Achievements"
          variant="ghost"
          onPress={() => router.push('/achievements')}
        />
        <Button
          title="Records"
          variant="ghost"
          onPress={() => router.push('/records')}
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
          Long live Jake the Elder. 🌵
        </Text>
        <Text style={styles.version}>
          v{appVersion}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.feltBg },
  // Scrolls on short screens (phones in a browser) so the footer is never
  // pushed out of reach; on tall screens it still spreads to fill.
  container: {
    flexGrow: 1,
    padding: theme.space.xl,
    justifyContent: 'space-between',
  },
  hero: { marginTop: 32, marginBottom: 32, alignItems: 'center' },
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
  actions: { marginBottom: 32 },
  resume: { marginBottom: 12 },
  resumeNote: {
    color: theme.color.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
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
