import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';
import { isUnlocked, useCampaignStore } from '../src/store/campaignStore';
import { RULE_PRESETS, PRESET_ORDER } from '../src/campaign/presets';
import { CINEMATICS } from '../src/campaign/story';

export default function GameOverScreen() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const reset = useGameStore((s) => s.reset);
  const lastUnlockedId = useCampaignStore((s) => s.lastUnlockedId);
  const acknowledgeUnlock = useCampaignStore((s) => s.acknowledgeUnlock);
  const completed = useCampaignStore((s) => s.completed);
  const seenCinematics = useCampaignStore((s) => s.seenCinematics);
  const unlockedPreset = lastUnlockedId ? RULE_PRESETS[lastUnlockedId] : null;

  // Continue the campaign: shown after a HUMAN win when a frontier (first
  // unlocked-but-unbeaten node) exists. Routes through the frontier's
  // cinematic on first visit, exactly like tapping it on the map.
  const humanWon =
    game != null && game.winnerId !== null && !game.players[game.winnerId].isBot;
  const frontier =
    PRESET_ORDER.find((id) => isUnlocked(completed, id) && !completed[id]) ?? null;
  const campaignDone = PRESET_ORDER.every((id) => completed[id]);
  const continueCampaign = () => {
    if (!frontier) return;
    acknowledgeUnlock();
    reset();
    const cinematic = CINEMATICS[frontier] && !seenCinematics[frontier];
    router.replace({
      pathname: cinematic ? '/cinematic' : '/setup',
      params: { preset: frontier },
    });
  };

  // If state was wiped, bail home.
  useEffect(() => {
    if (!game) router.replace('/');
  }, [game, router]);

  if (!game) return null;

  const winner =
    game.winnerId !== null ? game.players[game.winnerId] : null;

  // Who counts as a "Shithead" depends on the mode:
  //   - first-out-wins (default): everyone who didn't win first is a shithead.
  //   - last-man-standing: only the single last player left holding cards
  //     (players who shed out in the middle finished safely and are spared).
  const shitheads = game.lastManStanding
    ? game.players.filter((p) => p.id === game.shitheadId)
    : game.players.filter((p) => p.id !== game.winnerId);

  // Last-man-standing only: players who shed all their cards mid-game. They're
  // neither the winner (on the podium) nor the shithead (still holding cards,
  // so never isFinished), so this filter naturally excludes both. Empty in
  // first-out-wins mode, where play stops the instant the first player is out.
  const safe = game.lastManStanding
    ? game.players.filter((p) => p.isFinished && p.id !== game.winnerId)
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.podium}>
        <Text style={styles.label}>🏆 Winner</Text>
        <Text style={styles.winner}>
          {winner ? winner.name : '—'}
          {winner?.isBot ? ' 🤖' : ''}
        </Text>

        {safe.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 28 }]}>✅ Got out safe</Text>
            {safe.map((p) => (
              <Text key={p.id} style={styles.safe}>
                {p.name}
                {p.isBot ? ' 🤖' : ''}
              </Text>
            ))}
          </>
        )}

        {shitheads.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 28 }]}>
              {shitheads.length === 1 ? '💩 Shithead' : '💩 Shitheads'}
            </Text>
            {shitheads.map((p) => (
              <Text key={p.id} style={styles.shithead}>
                {p.name}
                {p.isBot ? ' 🤖' : ''}
              </Text>
            ))}
          </>
        )}
      </View>

      {unlockedPreset && (
        <View style={styles.unlockBanner}>
          <Text style={styles.unlockTitle}>🔓 New variant unlocked</Text>
          <Text style={styles.unlockName}>{unlockedPreset.name}</Text>
          <Text style={styles.unlockFlavor}>"{unlockedPreset.flavorText}"</Text>
        </View>
      )}

      {humanWon && campaignDone && (
        <Text style={styles.campaignDone}>
          🏆 Campaign complete — every table redeemed
        </Text>
      )}

      <View style={styles.actions}>
        {humanWon && frontier && (
          <Button title="Continue campaign ▸" onPress={continueCampaign} />
        )}
        <Button
          title="Play again"
          variant={humanWon && frontier ? 'ghost' : undefined}
          onPress={() => {
            acknowledgeUnlock();
            reset();
            router.replace('/setup');
          }}
        />
        <Button
          title="Home"
          variant="ghost"
          onPress={() => {
            acknowledgeUnlock();
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
  safe: {
    color: theme.color.textOnDark,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  actions: { marginBottom: 30 },
  campaignDone: {
    color: theme.color.accent,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  unlockBanner: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.35)',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  unlockTitle: {
    color: theme.color.textMuted,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  unlockName: {
    color: theme.color.accent,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  unlockFlavor: {
    color: theme.color.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
