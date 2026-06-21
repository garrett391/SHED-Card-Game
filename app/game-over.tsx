import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';

export default function GameOverScreen() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const reset = useGameStore((s) => s.reset);

  // If state was wiped, bail home.
  useEffect(() => {
    if (!game) router.replace('/');
  }, [game, router]);

  if (!game) return null;

  const winner =
    game.winnerId !== null ? game.players[game.winnerId] : null;

  const shitheads = game.players.filter((p) => p.id !== game.winnerId);

  return (
    <View style={styles.container}>
      <View style={styles.podium}>
        <Text style={styles.label}>🏆 Winner</Text>
        <Text style={styles.winner}>
          {winner ? winner.name : '—'}
          {winner?.isBot ? ' 🤖' : ''}
        </Text>

        {shitheads.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 28 }]}>💩 Shitheads</Text>
            {shitheads.map((p) => (
              <Text key={p.id} style={styles.shithead}>
                {p.name}
                {p.isBot ? ' 🤖' : ''}
              </Text>
            ))}
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title="Play again"
          onPress={() => {
            reset();
            router.replace('/setup');
          }}
        />
        <Button
          title="Home"
          variant="ghost"
          onPress={() => {
            reset();
            router.replace('/');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.feltBg,
    padding: theme.space.xl,
    justifyContent: 'space-between',
  },
  podium: { marginTop: 60, alignItems: 'center' },
  label: {
    color: theme.color.textMuted,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  winner: {
    color: theme.color.accent,
    fontSize: 44,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  shithead: {
    color: theme.color.danger,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  actions: { marginBottom: 30 },
});
