import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { GameLogModal } from '../src/components/GameLogModal';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';
import { isUnlocked, useCampaignStore } from '../src/store/campaignStore';
import { RULE_PRESETS, PRESET_ORDER } from '../src/campaign/presets';
import { CINEMATICS } from '../src/campaign/story';
import { characterByName, endLine, opponentsFor } from '../src/campaign/characters';
import { CharacterDialogue } from '../src/components/CharacterDialogue';

export default function GameOverScreen() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const reset = useGameStore((s) => s.reset);
  const campaignPresetId = useGameStore((s) => s.campaignPresetId);
  const completed = useCampaignStore((s) => s.completed);
  const seenCinematics = useCampaignStore((s) => s.seenCinematics);
  const lastUnlockedId = useCampaignStore((s) => s.lastUnlockedId);
  const acknowledgeUnlock = useCampaignStore((s) => s.acknowledgeUnlock);
  const unlockedPreset = lastUnlockedId ? RULE_PRESETS[lastUnlockedId] : null;

  // Post-game review: same 📜 log as the in-game history button.
  const [logOpen, setLogOpen] = useState(false);

  // The campaign host's parting words. Picked once so re-renders don't
  // swap the line mid-read.
  const [hostLine] = useState(() => {
    if (!game || !campaignPresetId) return null;
    const host = opponentsFor(campaignPresetId).find((c) => c.endLines);
    if (!host) return null;
    const playerWon =
      game.winnerId !== null && !game.players[game.winnerId].isBot;
    const text = endLine(host, playerWon);
    return text ? { host, text } : null;
  });

  // If state was wiped, bail home — but NOT when we wiped it ourselves on
  // the way out. departTo() resets the game store before navigating, which
  // re-fires this effect with game === null; without the guard its
  // router.replace('/') races (and wins against) the intended destination,
  // sending every button to the main menu.
  const departing = useRef(false);
  useEffect(() => {
    if (!game && !departing.current) router.replace('/');
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

  // ── Campaign continuation ────────────────────────────────────────────────
  // Only games launched from the campaign map get campaign actions — free
  // play with the same preset keeps the generic Play again / Home.
  //
  // "Continue" targets the node AFTER the one just played, so the campaign
  // reads as a linear march: replaying node 1 continues to node 2 (even if
  // it's already beaten), never teleporting across the map to the frontier.
  // After a win the next node is unlocked by definition; the isUnlocked
  // check is belt-and-braces for exotic states. No next node → campaign end.
  const humanWon =
    game.winnerId !== null && !game.players[game.winnerId].isBot;
  const nextNodeId = (() => {
    if (!campaignPresetId) return null;
    const idx = PRESET_ORDER.indexOf(campaignPresetId);
    const next = idx >= 0 ? PRESET_ORDER[idx + 1] : undefined;
    return next && isUnlocked(completed, next) ? next : null;
  })();

  /** Leave this screen for `route`, clearing transient state first. */
  const departTo = (route: Parameters<typeof router.replace>[0]) => {
    departing.current = true; // suppress the bail-home effect (see above)
    acknowledgeUnlock();
    reset();
    router.replace(route);
  };

  // Mirrors the map's node onPress: first visit to the next node plays its
  // cinematic (which flows into setup itself); replays go straight to setup.
  const continueCampaign = () => {
    if (!nextNodeId) return;
    const cinematic = CINEMATICS[nextNodeId] && !seenCinematics[nextNodeId];
    departTo({
      pathname: cinematic ? '/cinematic' : '/setup',
      params: { preset: nextNodeId },
    });
  };

  return (
    <View style={styles.container}>
      {/* Review the finished game play-by-play — same 📜 as the game screen */}
      <Pressable
        onPress={() => setLogOpen(true)}
        hitSlop={8}
        style={styles.logBtn}
        accessibilityLabel="Review game log"
        accessibilityRole="button"
      >
        <Text style={styles.logBtnIcon}>📜</Text>
      </Pressable>

      <View style={styles.podium}>
        <Text style={styles.label}>🏆 Winner</Text>
        <Text style={styles.winner}>
          {winner ? winner.name : '—'}
          {winner ? botTag(winner) : ''}
        </Text>

        {safe.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 28 }]}>✅ Got out safe</Text>
            {safe.map((p) => (
              <Text key={p.id} style={styles.safe}>
                {p.name}
                {botTag(p)}
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
                {botTag(p)}
              </Text>
            ))}
          </>
        )}
      </View>

      <View>
        {hostLine && (
          <View style={styles.hostLine}>
            <CharacterDialogue
              name={hostLine.host.name}
              text={hostLine.text}
              portrait={hostLine.host.portrait}
              emoji={hostLine.host.emoji}
            />
          </View>
        )}
        {unlockedPreset && (
          <View style={styles.unlockBanner}>
            <Text style={styles.unlockTitle}>🔓 New variant unlocked</Text>
            <Text style={styles.unlockName}>{unlockedPreset.name}</Text>
            <Text style={styles.unlockFlavor}>"{unlockedPreset.flavorText}"</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {campaignPresetId ? (
          <>
            {/* Won with a node ahead → march on. Lost → rematch this node.
                Won the final node → back to the map. */}
            {humanWon && nextNodeId ? (
              <Button title="Continue campaign  ▸" onPress={continueCampaign} />
            ) : humanWon ? (
              <Button
                title="Campaign complete — view map"
                onPress={() => departTo('/campaign')}
              />
            ) : (
              <Button
                title="Try again"
                onPress={() =>
                  departTo({
                    pathname: '/setup',
                    params: { preset: campaignPresetId },
                  })
                }
              />
            )}
            {(!humanWon || nextNodeId) && (
              <Button
                title="Campaign map"
                variant="ghost"
                onPress={() => departTo('/campaign')}
              />
            )}
          </>
        ) : (
          <Button title="Play again" onPress={() => departTo('/setup')} />
        )}
        <Button title="Home" variant="ghost" onPress={() => departTo('/')} />
      </View>

      <GameLogModal
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        log={game.log}
      />
    </View>
  );
}

/** Generic bots get a 🤖 suffix; named campaign characters don't. */
function botTag(p: { name: string; isBot: boolean }): string {
  return p.isBot && !characterByName(p.name) ? ' 🤖' : '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.feltBg,
    padding: theme.space.xl,
    justifyContent: 'space-between',
  },
  podium: { marginTop: 60, alignItems: 'center' },
  logBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
    zIndex: 10,
  },
  logBtnIcon: { fontSize: 22 },
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
  hostLine: { marginBottom: 16 },
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
