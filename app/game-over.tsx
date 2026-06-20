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
  const shithead =
    game.shitheadId !== null ? game.players[game.shitheadId] : null;

  // Everyone else, in finish order if we had one — we don't track it,
  // so just show the rest.
  const others = game.players.filter(
    (p) => p.id !== game.winnerId && p.id !== game.shitheadId,
  );

  return (
    <View style={styles.container}>
      <View style={styles.podium}>
        <Text style={styles.label}>🏆 Winner</Text>
        <Text style={styles.winner}>
          {winner ? winner.name : '—'}
          {winner?.isBot ? ' 🤖' : ''}
        </Text>

        {others.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 28 }]}>Survived</Text>
            {others.map((p) => (
              <Text key={p.id} style={styles.other}>
                {p.name}
                {p.isBot ? ' 🤖' : ''}
              </Text>
            ))}
          </>
        )}

        {shithead && (
          <>
            <Text style={[styles.label, { marginTop: 28 }]}>💩 Shithead</Text>
            <Text style={styles.shithead}>
              {shithead.name}
              {shithead.isBot ? ' 🤖' : ''}
            </Text>
            <Text style={styles.note}>
              Loser deals next round (house rule).
            </Text>
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
  other: {
    color: theme.color.textOnDark,
    fontSize: 18,
    marginTop: 4,
  },
  shithead: {
    color: theme.color.danger,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  note: {
    color: theme.color.textMuted,
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  actions: { marginBottom: 30 },
});
