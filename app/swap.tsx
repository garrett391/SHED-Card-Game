import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { PlayingCard } from '../src/components/PlayingCard';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';

/**
 * Pre-game swap screen. We walk through each player one at a time.
 * Bots don't swap (their face-up cards are luck-of-the-deal).
 *
 * Privacy pattern: each human gets a "pass device to X" cover screen,
 * tap to reveal, swap, tap Done — then we advance to the next player.
 */
export default function SwapScreen() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const swap = useGameStore((s) => s.swap);
  const finishSwap = useGameStore((s) => s.finishSwap);
  const handRevealed = useGameStore((s) => s.handRevealed);
  const revealHand = useGameStore((s) => s.revealHand);
  const hideHand = useGameStore((s) => s.hideHand);

  // Index of the player we're currently letting swap. We auto-advance past
  // bots so the UI only ever shows humans this screen.
  const [activeIdx, setActiveIdx] = useState(0);

  // pair-up state: a hand card waiting for a face-up partner (or vice-versa)
  const [pendingHandId, setPendingHandId] = useState<string | null>(null);
  const [pendingFaceUpId, setPendingFaceUpId] = useState<string | null>(null);

  // Bail out if the store hasn't been hydrated.
  useEffect(() => {
    if (!game) router.replace('/');
  }, [game, router]);

  // Skip bots: they don't need a "pass the device" moment.
  useEffect(() => {
    if (!game) return;
    let idx = activeIdx;
    while (
      idx < game.players.length &&
      (game.swapsComplete[idx] || game.players[idx].isBot)
    ) {
      if (game.players[idx].isBot && !game.swapsComplete[idx]) {
        finishSwap(idx);
      }
      idx++;
    }
    if (idx !== activeIdx) {
      setActiveIdx(idx);
      hideHand();
    }
  }, [game, activeIdx, finishSwap, hideHand]);

  // When all swaps done, jump to the table.
  useEffect(() => {
    if (game && game.phase === 'playing') {
      router.replace('/game');
    }
  }, [game, router]);

  const activePlayer = useMemo(() => {
    if (!game) return null;
    if (activeIdx >= game.players.length) return null;
    return game.players[activeIdx];
  }, [game, activeIdx]);

  // Auto-reveal for solo human (no pass-and-play privacy needed).
  const humanCount = game ? game.players.filter((p) => !p.isBot).length : 0;

  useEffect(() => {
    if (!handRevealed && humanCount <= 1) {
      revealHand();
    }
  }, [handRevealed, humanCount, revealHand]);

  if (!game || !activePlayer) {
    return (
      <View style={styles.container}>
        <Text style={styles.dim}>Loading…</Text>
      </View>
    );
  }

  // Show "pass device" gate until current human taps to reveal.
  // Skip for solo human vs bots — no one to hide cards from.
  if (!handRevealed && humanCount > 1) {
    return (
      <View style={styles.container}>
        <View style={styles.gate}>
          <Text style={styles.passLabel}>Pass the device to</Text>
          <Text style={styles.passName}>{activePlayer.name}</Text>
          <Text style={styles.passHint}>
            You may swap any of your hand cards with your face-up mid-game
            cards. This is your one chance — choose wisely.
          </Text>
          <Button title="I'm ready" onPress={revealHand} />
          <Button
            title="Skip swap"
            variant="ghost"
            onPress={() => {
              setPendingHandId(null);
              setPendingFaceUpId(null);
              finishSwap(activeIdx);
              setActiveIdx(activeIdx + 1);
              hideHand();
            }}
          />
        </View>
      </View>
    );
  }

  // Confirm a swap once both sides are picked.
  const tryCommit = (handId: string | null, faceUpId: string | null) => {
    if (handId && faceUpId) {
      swap(activeIdx, handId, faceUpId);
      setPendingHandId(null);
      setPendingFaceUpId(null);
    }
  };

  const onHandTap = (id: string) => {
    const next = pendingHandId === id ? null : id;
    setPendingHandId(next);
    tryCommit(next, pendingFaceUpId);
  };

  const onFaceUpTap = (id: string) => {
    const next = pendingFaceUpId === id ? null : id;
    setPendingFaceUpId(next);
    tryCommit(pendingHandId, next);
  };

  const done = () => {
    setPendingHandId(null);
    setPendingFaceUpId(null);
    finishSwap(activeIdx);
    setActiveIdx(activeIdx + 1);
    hideHand();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.who}>{activePlayer.name}'s swap</Text>
      <Text style={styles.hint}>
        Tap one hand card + one face-up card to swap them. Repeat as needed.
        {'\n'}This is your only chance before play begins — choose wisely!
      </Text>

      <Text style={styles.section}>Face-up (mid-game)</Text>
      <View style={styles.row}>
        {activePlayer.faceUp.map((c) => (
          <PlayingCard
            key={c.id}
            card={c}
            selected={pendingFaceUpId === c.id}
            onPress={() => onFaceUpTap(c.id)}
          />
        ))}
      </View>

      <Text style={styles.section}>Face-down (late game)</Text>
      <View style={styles.row}>
        {activePlayer.faceDown.map((c) => (
          <PlayingCard key={c.id} faceDown />
        ))}
      </View>

      <Text style={styles.section}>Your hand</Text>
      <View style={styles.row}>
        {activePlayer.hand.map((c) => (
          <PlayingCard
            key={c.id}
            card={c}
            selected={pendingHandId === c.id}
            onPress={() => onHandTap(c.id)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button title="Done — next player" onPress={done} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.lg,
    paddingBottom: 60,
    backgroundColor: theme.color.feltBg,
    minHeight: '100%',
  },
  gate: {
    flex: 1,
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  passLabel: { color: theme.color.textMuted, fontSize: 16 },
  passName: {
    color: theme.color.accent,
    fontSize: 48,
    fontWeight: '900',
    marginVertical: 12,
    textAlign: 'center',
  },
  passHint: {
    color: theme.color.textOnDark,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  who: {
    color: theme.color.accent,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  hint: {
    color: theme.color.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
  },
  section: {
    color: theme.color.textOnDark,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 16, // room for selected card lift
  },
  footer: { marginTop: 28 },
  dim: { color: theme.color.textMuted, textAlign: 'center', marginTop: 80 },
});
