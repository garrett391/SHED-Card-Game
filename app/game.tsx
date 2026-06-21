import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Center } from '../src/components/Center';
import { OpponentStrip } from '../src/components/OpponentStrip';
import { PlayingCard } from '../src/components/PlayingCard';
import { theme } from '../src/components/theme';
import { decideBotAction } from '../src/ai/bot';
import { rankLabel, cardLabel } from '../src/engine/cards';
import {
  getPlayableCardIds,
  getPlaySource,
  hasPlayableMove,
} from '../src/engine/engine';
import { useGameStore } from '../src/store/gameStore';
import { Card, GameEvent, GameState } from '../src/engine/types';

const BOT_THINK_MS = 400;
const BOT_DISPLAY_MS = 1500;

/**
 * Main table screen.
 *
 * Layout (top → bottom):
 *  - Player scoreboard (ALL players, fixed order, turn indicator on active)
 *  - Center area (draw / pile / burned)
 *  - Turn banner + recent events
 *  - Current player's hand area + action buttons
 *
 * Two things drive the UX:
 *  1. Bot turns auto-advance with a small delay so you can see what happened.
 *  2. Multi-human games gate turns with "pass device to X" for privacy.
 *     Solo human vs bots skips the gate entirely.
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

  // Face-down flip result: pause to show what was flipped before bots continue.
  const [flipResult, setFlipResult] = useState<{
    card: Card;
    success: boolean;
  } | null>(null);

  // Bot action interstitial: show what the bot just did for BOT_DISPLAY_MS.
  const [botAction, setBotAction] = useState<{
    botName: string;
    headline: string;   // e.g. "played K♠"
    detail?: string;    // e.g. "🔥 Burns the pile!"
    card?: Card;        // shown visually
    emoji: string;      // leading emoji
  } | null>(null);

  // Track which player we last triggered a bot action for, to avoid
  // re-firing on every re-render.
  const lastBotTurnRef = useRef<{ idx: number; epoch: number } | null>(null);

  // Bail to home if state was wiped (e.g. dev reload).
  useEffect(() => {
    if (!game) router.replace('/');
  }, [game, router]);

  // Route to game-over when phase changes (wait for bot action display to clear).
  useEffect(() => {
    if (game && game.phase === 'gameOver' && !botAction) {
      router.replace('/game-over');
    }
  }, [game, router, botAction]);

  // Bot autoplay.
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    if (flipResult) return; // Wait for human to dismiss flip result first
    if (botAction) return;  // Wait for bot action display to clear
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

    const botName = current.name;

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

      // Capture what just happened for the interstitial display.
      const events = useGameStore.getState().recentEvents;
      setBotAction(buildBotActionDisplay(botName, events));
    }, BOT_THINK_MS);
    return () => clearTimeout(timer);
  }, [game, flipResult, botAction]);

  // Auto-dismiss bot action interstitial after BOT_DISPLAY_MS.
  useEffect(() => {
    if (!botAction) return;
    const timer = setTimeout(() => setBotAction(null), BOT_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [botAction]);

  // Auto-reveal hand for solo human (no pass-and-play gate needed).
  const humanCount = useMemo(
    () => (game ? game.players.filter((p) => !p.isBot).length : 0),
    [game],
  );

  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const current = game.players[game.currentPlayerIndex];
    if (!current.isBot && !handRevealed && humanCount <= 1) {
      revealHand();
    }
  }, [game, handRevealed, humanCount, revealHand]);

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

  // Bot action interstitial: full-screen display of what the bot just did.
  if (botAction) {
    return (
      <View style={styles.container}>
        <View style={styles.botActionGate}>
          <Text style={styles.botActionEmoji}>{botAction.emoji}</Text>
          <Text style={styles.botActionName}>{botAction.botName}</Text>
          <Text style={styles.botActionHeadline}>{botAction.headline}</Text>
          {botAction.card && (
            <View style={styles.botActionCardWrap}>
              <PlayingCard card={botAction.card} />
            </View>
          )}
          {botAction.detail && (
            <Text style={styles.botActionDetail}>{botAction.detail}</Text>
          )}
        </View>
      </View>
    );
  }

  // Pass-and-play gate: hide hand until the human taps "I'm ready".
  // Skip the gate entirely when only one human is playing (solo vs bots).
  if (isHumanTurn && !handRevealed && humanCount > 1) {
    return (
      <View style={styles.container}>
        <View style={styles.gate}>
          <Text style={styles.passLabel}>Pass the device to</Text>
          <Text style={styles.passName}>{currentPlayer.name}</Text>
          {recentEvents.length > 0 && (
            <Text style={styles.lastAction}>
              {summarizeRecent(recentEvents, game.players)}
            </Text>
          )}
          <Button title="I'm ready" onPress={revealHand} />
        </View>
      </View>
    );
  }

  // Face-down flip result gate: show what was flipped before continuing.
  if (flipResult) {
    return (
      <View style={styles.container}>
        <View style={styles.gate}>
          <Text style={styles.passLabel}>You flipped…</Text>
          <View style={styles.flipCardWrap}>
            <PlayingCard card={flipResult.card} />
          </View>
          <Text
            style={[
              styles.flipVerdict,
              { color: flipResult.success ? theme.color.accent : theme.color.danger },
            ]}
          >
            {flipResult.success
              ? '✅  It plays!'
              : '❌  No good — you pick up the pile'}
          </Text>
          <View style={{ marginTop: 24 }}>
            <Button title="Continue" onPress={() => setFlipResult(null)} />
          </View>
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
                onPress={() => {
                  playFaceDown(c.id);
                  // Read latest events to determine flip outcome
                  const latest = useGameStore.getState();
                  const events = latest.recentEvents;
                  const failed = events.find(
                    (e) => e.type === 'faceDownFlipFailed',
                  );
                  if (failed && failed.type === 'faceDownFlipFailed') {
                    setFlipResult({ card: failed.card, success: false });
                  } else {
                    const played = events.find(
                      (e) => e.type === 'cardsPlayed' && e.source === 'faceDown',
                    );
                    if (played && played.type === 'cardsPlayed') {
                      setFlipResult({ card: played.cards[0], success: true });
                    }
                  }
                }}
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
      {/* Player scoreboard — fixed order, turn indicator on active player */}
      <View style={styles.scoreboard}>
        {game.players.map((p, i) => (
          <OpponentStrip
            key={p.id}
            player={p}
            isCurrent={i === game.currentPlayerIndex}
          />
        ))}
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
          <Text style={styles.recent}>{summarizeRecent(recentEvents, game.players)}</Text>
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

/** Build a display object from bot action events for the interstitial screen. */
function buildBotActionDisplay(
  botName: string,
  events: GameEvent[],
): { botName: string; headline: string; detail?: string; card?: Card; emoji: string } {
  // Check for pile pickup
  const pickup = events.find((e) => e.type === 'pileTakenUp');
  if (pickup && pickup.type === 'pileTakenUp') {
    // Check if it was a failed face-down flip
    const flipFail = events.find((e) => e.type === 'faceDownFlipFailed');
    if (flipFail && flipFail.type === 'faceDownFlipFailed') {
      return {
        botName,
        emoji: '🙈',
        headline: `flipped ${cardLabel(flipFail.card)}`,
        detail: `No good — picks up ${pickup.cardCount} cards`,
        card: flipFail.card,
      };
    }
    return {
      botName,
      emoji: '📥',
      headline: `picked up the pile`,
      detail: `${pickup.cardCount} cards`,
    };
  }

  // Check for cards played
  const played = events.find((e) => e.type === 'cardsPlayed');
  if (played && played.type === 'cardsPlayed') {
    const n = played.cards.length;
    const label = n === 1
      ? `played ${cardLabel(played.cards[0])}`
      : `played ${n}× ${rankLabel(played.cards[0].rank)}`;

    // Check for burn
    const burn = events.find((e) => e.type === 'pileBurned');
    const finished = events.find((e) => e.type === 'playerFinished');

    let detail: string | undefined;
    if (burn && burn.type === 'pileBurned') {
      detail = burn.reason === 'ten' ? '🔥 Burns the pile!' : '🔥 Four-of-a-kind — burns the pile!';
    }
    if (finished) {
      detail = (detail ? detail + '\n' : '') + '🏆 Out of the game!';
    }

    return {
      botName,
      emoji: '🃏',
      headline: label,
      detail,
      card: played.cards[0],
    };
  }

  // Fallback
  return { botName, emoji: '🤖', headline: 'took their turn' };
}

/** Turn a list of engine events into a one-line summary for the UI. */
function summarizeRecent(
  events: ReturnType<typeof useGameStore.getState>['recentEvents'],
  players: GameState['players'],
): string {
  const playerName = (id: number) => players?.find((p) => p.id === id)?.name ?? 'Someone';

  // Walk most-impactful → least.
  for (const e of events) {
    if (e.type === 'pileBurned') {
      return e.reason === 'ten' ? '🔥 10 burns the pile' : '🔥 Four-of-a-kind burns the pile';
    }
    if (e.type === 'faceDownFlipFailed') {
      return `Face-down flip failed — pile picked up.`;
    }
    if (e.type === 'pileTakenUp') {
      return `${playerName(e.playerId)} picked up the pile (${e.cardCount} cards)`;
    }
    if (e.type === 'playerFinished') {
      return `🏆 ${playerName(e.playerId)} finished!`;
    }
  }
  for (const e of events) {
    if (e.type === 'cardsPlayed') {
      const n = e.cards.length;
      const rank = e.cards[0].rank;
      const label =
        rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : String(rank);
      const played = n === 1 ? `played ${label}` : `played ${n}× ${label}`;
      return `${playerName(e.playerId)} ${played}`;
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
  scoreboard: { marginBottom: 4 },
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
  flipCardWrap: {
    marginVertical: 20,
    alignItems: 'center',
  },
  flipVerdict: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  botActionGate: {
    flex: 1,
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  botActionEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  botActionName: {
    color: theme.color.accent,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  botActionHeadline: {
    color: theme.color.textOnDark,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  botActionCardWrap: {
    marginVertical: 12,
    alignItems: 'center',
  },
  botActionDetail: {
    color: theme.color.accent,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
});
