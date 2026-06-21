import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Center } from '../src/components/Center';
import { OpponentStrip } from '../src/components/OpponentStrip';
import { PlayingCard } from '../src/components/PlayingCard';
import { theme } from '../src/components/theme';
import { decideBotAction } from '../src/ai/bot';
import {
  getPlayableCardIds,
  getPlaySource,
  hasPlayableMove,
} from '../src/engine/engine';
import { useGameStore } from '../src/store/gameStore';

const BOT_THINK_MS = 900;

/**
 * Main table screen.
 *
 * Layout (top → bottom):
 *  - Opponent strips (everyone except current player)
 *  - Center area (draw / pile / burned)
 *  - Current player's hand area + action buttons
 *
 * Two things drive the UX:
 *  1. Bot turns auto-advance with a small delay so you can see what happened.
 *  2. Human turns are gated by a "pass device to X" screen for privacy.
 */
export default function GameScreen() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const selectedCardIds = useGameStore((s) => s.selectedCardIds);
  const handRevealed = useGameStore((s) => s.handRevealed);
  const toggleSelect = useGameStore((s) => s.toggleSelect);
  const playSelected = useGameStore((s) => s.playSelected);
  const playFaceDown = useGameStore((s) => s.playFaceDown);
  const pickup = useGameStore((s) => s.pickup);
  const revealHand = useGameStore((s) => s.revealHand);
  const recentEvents = useGameStore((s) => s.recentEvents);

  // Track which player we last triggered a bot action for, to avoid
  // re-firing on every re-render.
  const lastBotTurnRef = useRef<{ idx: number; epoch: number } | null>(null);

  // Bail to home if state was wiped (e.g. dev reload).
  useEffect(() => {
    if (!game) router.replace('/');
  }, [game, router]);

  // Route to game-over when phase changes.
  useEffect(() => {
    if (game && game.phase === 'gameOver') {
      router.replace('/game-over');
    }
  }, [game, router]);

  // Bot autoplay.
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const current = game.players[game.currentPlayerIndex];
    if (!current.isBot) return;
    if (current.isFinished) return;

    // Use the game's log length as an "epoch" — any time the state changes
    // meaningfully, the log grows, so we can re-fire for the same bot if
    // they get an extra turn.
    const epoch = game.log.length;
    const last = lastBotTurnRef.current;
    if (last && last.idx === game.currentPlayerIndex && last.epoch === epoch) {
      return;
    }
    lastBotTurnRef.current = { idx: game.currentPlayerIndex, epoch };

    const timer = setTimeout(() => {
      // Re-read latest store state in case something changed.
      const latest = useGameStore.getState();
      if (!latest.game || latest.game.phase !== 'playing') return;
      const cur = latest.game.players[latest.game.currentPlayerIndex];
      if (!cur.isBot || cur.isFinished) return;

      const action = decideBotAction(latest.game, latest.game.currentPlayerIndex);
      if (action.type === 'pickup') {
        latest.pickup();
      } else {
        // Select all bot's chosen cards, then dispatch play.
        latest.clearSelection();
        for (const id of action.cardIds) latest.toggleSelect(id);
        // Face-down source needs the dedicated path.
        const source = getPlaySource(cur);
        if (source === 'faceDown') {
          latest.playFaceDown(action.cardIds[0]);
        } else {
          latest.playSelected();
        }
      }
    }, BOT_THINK_MS);
    return () => clearTimeout(timer);
  }, [game]);

  const currentPlayer = useMemo(() => {
    if (!game) return null;
    return game.players[game.currentPlayerIndex];
  }, [game]);

  // Memoized sorted hand to ensure logical visual order (lowest to highest)
  const sortedHand = useMemo(() => {
    if (!currentPlayer?.hand) return [];
    return [...currentPlayer.hand].sort((a, b) => a.rank - b.rank);
  }, [currentPlayer?.hand]);

  if (!game || !currentPlayer) {
    return (
      <View style={styles.container}>
        <Text style={styles.dim}>Loading…</Text>
      </View>
    );
  }

  const isHumanTurn = !currentPlayer.isBot && !currentPlayer.isFinished;
  const source = getPlaySource(currentPlayer);
  const playableIds = isHumanTurn
    ? getPlayableCardIds(game, game.currentPlayerIndex)
    : [];
  const canPlay = isHumanTurn && hasPlayableMove(game, game.currentPlayerIndex);

  // Pass-and-play gate: hide hand until the human taps "I'm ready".
  if (isHumanTurn && !handRevealed) {
    return (
      <View style={styles.container}>
        <View style={styles.gate}>
          <Text style={styles.passLabel}>Pass the device to</Text>
          <Text style={styles.passName}>{currentPlayer.name}</Text>
          {recentEvents.length > 0 && (
            <Text style={styles.lastAction}>
              {summarizeRecent(recentEvents)}
            </Text>
          )}
          <Button title="I'm ready" onPress={revealHand} />
        </View>
      </View>
    );
  }

  // Decide what cards to show in the player's bottom area.
  const renderHandArea = () => {
    if (source === 'hand') {
      return (
        <>
          <Text style={styles.sectionLabel}>Your hand</Text>
          <View style={styles.cardRow}>
            {sortedHand.map((c) => {
              const playable = playableIds.includes(c.id);
              return (
                <PlayingCard
                  key={c.id}
                  card={c}
                  selected={selectedCardIds.includes(c.id)}
                  dimmed={!playable}
                  onPress={() => toggleSelect(c.id)}
                />
              );
            })}
          </View>
        </>
      );
    }
    if (source === 'faceUp') {
      return (
        <>
          <Text style={styles.sectionLabel}>Mid-game (face-up)</Text>
          <View style={styles.cardRow}>
            {currentPlayer.faceUp.map((c) => {
              const playable = playableIds.includes(c.id);
              return (
                <PlayingCard
                  key={c.id}
                  card={c}
                  selected={selectedCardIds.includes(c.id)}
                  dimmed={!playable}
                  onPress={() => toggleSelect(c.id)}
                />
              );
            })}
          </View>
        </>
      );
    }
    if (source === 'faceDown') {
      return (
        <>
          <Text style={styles.sectionLabel}>
            Late game — blind flip. Pick one.
          </Text>
          <View style={styles.cardRow}>
            {currentPlayer.faceDown.map((c) => (
              <PlayingCard
                key={c.id}
                faceDown
                onPress={() => playFaceDown(c.id)}
              />
            ))}
          </View>
        </>
      );
    }
    return <Text style={styles.dim}>No cards left</Text>;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Opponents */}
      <View style={styles.opponents}>
        {game.players.map((p, i) =>
          i === game.currentPlayerIndex ? null : (
            <OpponentStrip
              key={p.id}
              player={p}
              isCurrent={false}
            />
          ),
        )}
      </View>

      {/* Center: draw / pile / burned */}
      <Center game={game} />

      {/* Turn banner */}
      <View style={styles.turnBanner}>
        <Text style={styles.turnText}>
          {currentPlayer.isBot
            ? `${currentPlayer.name} is thinking…`
            : `Your turn, ${currentPlayer.name}`}
        </Text>
        {recentEvents.length > 0 && (
          <Text style={styles.recent}>{summarizeRecent(recentEvents)}</Text>
        )}
      </View>

      {/* Player area */}
      <View style={styles.playerArea}>
        {isHumanTurn ? (
          renderHandArea()
        ) : (
          <Text style={styles.dim}>Waiting for {currentPlayer.name}…</Text>
        )}
      </View>

      {/* Actions */}
      {isHumanTurn && source !== 'faceDown' && (
        <View style={styles.actions}>
          <Button
            title={
              selectedCardIds.length > 1
                ? `Play ${selectedCardIds.length} cards`
                : 'Play selected'
            }
            onPress={playSelected}
            disabled={selectedCardIds.length === 0}
          />
          <Button
            title={canPlay ? 'Pick up pile (forfeit turn)' : 'Pick up pile'}
            variant={canPlay ? 'ghost' : 'danger'}
            onPress={pickup}
          />
        </View>
      )}
    </ScrollView>
  );
}

/** Turn a list of engine events into a one-line summary for the UI. */
function summarizeRecent(events: ReturnType<typeof useGameStore.getState>['recentEvents']): string {
  // Walk most-impactful → least.
  for (const e of events) {
    if (e.type === 'pileBurned') {
      return e.reason === 'ten' ? '🔥 10 burns the pile' : '🔥 Four-of-a-kind burns the pile';
    }
    if (e.type === 'faceDownFlipFailed') {
      return `Face-down flip failed — pile picked up.`;
    }
    if (e.type === 'pileTakenUp') {
      return `Pile picked up (${e.cardCount} cards)`;
    }
    if (e.type === 'playerFinished') {
      return `🏆 Player finished!`;
    }
  }
  for (const e of events) {
    if (e.type === 'cardsPlayed') {
      const n = e.cards.length;
      const rank = e.cards[0].rank;
      const label =
        rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : String(rank);
      return n === 1 ? `Played ${label}` : `Played ${n}× ${label}`;
    }
  }
  return '';
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.md,
    backgroundColor: theme.color.feltBg,
    minHeight: '100%',
    paddingBottom: 40,
  },
  opponents: { marginBottom: 4 },
  turnBanner: {
    alignItems: 'center',
    paddingVertical: 8,
    marginVertical: 6,
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
  },
  turnText: {
    color: theme.color.accent,
    fontWeight: '700',
    fontSize: 15,
  },
  recent: {
    color: theme.color.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  playerArea: {
    marginTop: 8,
    minHeight: 140,
  },
  sectionLabel: {
    color: theme.color.textOnDark,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 16, // room for selected lift
  },
  actions: {
    marginTop: 12,
  },
  dim: { color: theme.color.textMuted, fontStyle: 'italic' },
  gate: {
    flex: 1,
    marginTop: 100,
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
  lastAction: {
    color: theme.color.textOnDark,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
});
