import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScrollText } from 'lucide-react-native';
import { ActionCaption, Caption } from '../src/components/ActionCaption';
import { AchievementToast } from '../src/components/AchievementToast';
import { Center } from '../src/components/Center';
import { GameLogModal } from '../src/components/GameLogModal';
import { HandArea, WatchingHand } from '../src/components/HandArea';
import { OpponentStrip } from '../src/components/OpponentStrip';
import { StickUpCard } from '../src/components/StickUpCard';
import { FlipResultGate, PassDeviceGate, SwapTargetPicker } from '../src/components/TableGates';
import { TurnBanner } from '../src/components/TurnBanner';
import { VariantBadge } from '../src/components/VariantBadge';
import { theme } from '../src/components/theme';
import { playSfx } from '../src/audio/sfx';
import {
  getPlayableCardIds,
  getPlaySource,
  hasPlayableMove,
  swapTargets,
} from '../src/engine/engine';
import { Card } from '../src/engine/types';
import { useCampaignStore } from '../src/store/campaignStore';
import { useGameStore } from '../src/store/gameStore';
import {
  captionText,
  describeAction,
  flipOutcome,
  summarizeRecent,
} from '../src/table/describeEvents';
import { isSoleHuman, SeatedStickUp, stickUpFrom } from '../src/table/stickUp';
import { describeBotTurn, heckle } from '../src/table/tableTalk';
import { useAutoClear } from '../src/table/useAutoClear';
import { useBotAutoplay } from '../src/table/useBotAutoplay';

/** How long a bot's play (or the winning play) holds the table. */
const BOT_DISPLAY_MS = 1800;

/**
 * Main table screen.
 *
 * Layout (top → bottom):
 *  - Player scoreboard (ALL players, fixed order, turn indicator on active)
 *  - Action caption (ephemeral "who played what", fades after a beat)
 *  - Center area (draw / pile / burned)
 *  - Turn banner + recent events
 *  - Current player's hand area + action buttons
 *
 * Two things drive the UX:
 *  1. Bot turns auto-advance with a small delay so you can see what happened
 *     (src/table/useBotAutoplay.ts). The played card is already visible on
 *     top of the pile; a short caption names WHO played (the one thing the
 *     pile can't show) and then fades.
 *  2. Multi-human games gate turns with "pass device to X" for privacy.
 *     Solo human vs bots skips the gate entirely.
 *
 * What the table says lives in src/table/ (captions, summaries, table talk,
 * stick-ups); the pieces of the screen in src/components/.
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
  const earnedThisGame = useGameStore((s) => s.earnedThisGame);
  const campaignPresetId = useGameStore((s) => s.campaignPresetId);

  // Face-down flip result: pause to show what was flipped before bots continue.
  const [flipResult, setFlipResult] = useState<{ card: Card; success: boolean } | null>(null);

  // A stick-up involving a human (robbed, or robbing): the stick-up panel,
  // which holds play until it's dismissed.
  const [stickUp, setStickUp] = useState<SeatedStickUp | null>(null);

  // Game history modal
  const [historyOpen, setHistoryOpen] = useState(false);

  // Swap joker selected and Play tapped: choose whose hand to take.
  const [swapPicking, setSwapPicking] = useState(false);

  // Hold before routing to game-over when a HUMAN's play ended the game, so
  // their winning play shows in the caption for a beat before the podium.
  // (Bot wins get this beat via botAction; winning face-down flips via the
  // flipResult gate, which waits for a Continue tap.)
  const [finalHold, setFinalHold] = useState(false);

  // Toast: empty-selection taps and rejected-play reasons
  const [toast, setToast] = useState<string | null>(null);

  // Bot action pacing: while set, the next bot turn is held for BOT_DISPLAY_MS
  // so plays don't blitz past faster than you can read them. Also carries the
  // character's quip, which becomes table talk when the window closes.
  const [botAction, setBotAction] = useState<{ playerId: number; quip?: string } | null>(null);

  // Ephemeral action caption: a short "Name played X" line above the pile.
  const [actionCaption, setActionCaption] = useState<Caption | null>(null);

  // Table talk: an ephemeral speech bubble on a player's strip. One at a
  // time; nonce restarts the animation when the same character speaks twice.
  const [tableTalk, setTableTalk] = useState<{
    playerId: number;
    text: string;
    nonce: number;
  } | null>(null);

  useAutoClear(toast, () => setToast(null), 1800);
  // When a bot's window closes, its quip lands as table talk on its strip.
  useAutoClear(botAction, () => {
    if (botAction?.quip) {
      setTableTalk({ playerId: botAction.playerId, text: botAction.quip, nonce: Date.now() });
    }
    setBotAction(null);
  }, BOT_DISPLAY_MS);
  // The bubble's fade lives in OpponentStrip; this just retires the state.
  useAutoClear(tableTalk, () => setTableTalk(null), 3400);
  // A touch longer than the bot pacing, so the line lingers into the next turn.
  useAutoClear(actionCaption, () => setActionCaption(null), 2600);
  // The human's winning play gets the same beat bots get.
  useAutoClear(finalHold, () => setFinalHold(false), BOT_DISPLAY_MS);

  // Bail to home if state was wiped (e.g. dev reload).
  useEffect(() => {
    if (!game) router.replace('/');
  }, [game, router]);

  // Route to game-over when phase changes. Wait for every "show the final play"
  // beat to finish first: bot pacing (botAction), the human's winning-play hold
  // (finalHold), the face-down flip gate (flipResult — without this a winning
  // flip would route before its card was ever shown) and the stick-up panel.
  useEffect(() => {
    if (game && game.phase === 'gameOver' && !botAction && !flipResult && !finalHold && !stickUp) {
      // A human win of a game launched from the campaign map completes that
      // node; free-play wins never count. markCompleted is idempotent, so
      // re-fires of this effect are harmless.
      if (
        campaignPresetId &&
        game.winnerId !== null &&
        !game.players[game.winnerId].isBot
      ) {
        useCampaignStore.getState().markCompleted(campaignPresetId);
      }
      router.replace('/game-over');
    }
  }, [game, router, botAction, flipResult, finalHold, stickUp, campaignPresetId]);

  // Bot turns, held while anything is on show for the human.
  useBotAutoplay(game, !!(flipResult || botAction || stickUp), ({ botName, playerId, events, game: after, cfg }) => {
    const turn = describeBotTurn(botName, events, after, cfg);
    setBotAction({ playerId, quip: turn.quip });
    setActionCaption({ emoji: turn.display.emoji, text: turn.caption, nonce: Date.now() });
    if (turn.robbery) setStickUp(turn.robbery);
  });

  // The player's own 7 at the Outlaw Pass: show what they took (bot robbers
  // open the panel from the bot turn, with their line).
  useEffect(() => {
    const g = useGameStore.getState().game;
    const robbery = stickUpFrom(recentEvents, g);
    if (robbery && g && !g.players[robbery.robberId].isBot) setStickUp(robbery);
  }, [recentEvents]);

  // Reactions to every action, driven by engine events rather than buttons,
  // so every path is covered — human taps, bot turns, forced pickups, failed
  // face-down flips. recentEvents is replaced wholesale on each action, so
  // each fires exactly once per action.
  useEffect(() => {
    // Sound. An action emits cardsPlayed OR pileTakenUp, never both (a failed
    // flip emits faceDownFlipFailed + pileTakenUp); pickup is checked first
    // as the salient moment just in case that ever changes.
    if (recentEvents.some((e) => e.type === 'pileTakenUp')) {
      playSfx('cardPickup');
    } else if (recentEvents.some((e) => e.type === 'cardsPlayed')) {
      playSfx('cardPlace');
    }
    // Rejected play: tell the player why, via the same toast used for
    // empty-selection taps. Especially important under unfamiliar variants
    // (hard 8s, restricted 10s) where "why won't it let me?" is common.
    const rejection = recentEvents.find((e) => e.type === 'playRejected');
    if (rejection && rejection.type === 'playRejected') {
      setToast(rejection.reason);
    }
    // A human's pickup or burn draws a heckle after a short beat, so it
    // reads as a response, not a simultaneous caption.
    if (!game) return;
    const line = heckle(game, recentEvents);
    if (!line) return;
    const t = setTimeout(() => setTableTalk({ ...line, nonce: Date.now() }), 600);
    return () => clearTimeout(t);
  }, [recentEvents, game]);

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

  const currentPlayer = game ? game.players[game.currentPlayerIndex] : null;

  if (!game || !currentPlayer) {
    return (
      <View style={styles.container}>
        <Text style={styles.dim}>Loading…</Text>
      </View>
    );
  }

  // Phase guard matters now: the screen stays mounted for a beat after the
  // game ends (finalHold / botAction), and nothing should be tappable then.
  const isHumanTurn =
    game.phase === 'playing' && !currentPlayer.isBot && !currentPlayer.isFinished;
  const source = getPlaySource(currentPlayer);
  const playableIds = isHumanTurn ? getPlayableCardIds(game, game.currentPlayerIndex) : [];
  const canPlay = isHumanTurn && hasPlayableMove(game, game.currentPlayerIndex);
  const recent = recentEvents.length > 0
    ? summarizeRecent(recentEvents, game.players, game.ruleConfig)
    : undefined;

  // Play the selection. If that play just ended the game, surface it in the
  // caption and hold the game-over route for a beat — otherwise the podium
  // appears before you ever see what you played. Set synchronously (not via
  // effect) so the routing effect sees the hold this commit.
  function playAndHold(swapTargetId?: number) {
    const playerName = currentPlayer!.name;
    playSelected(swapTargetId);
    const latest = useGameStore.getState();
    if (latest.game?.phase === 'gameOver') {
      const d = describeAction(latest.recentEvents, latest.game.ruleConfig, latest.game.players);
      setActionCaption({ emoji: d.emoji, text: captionText(playerName, d), nonce: Date.now() });
      setFinalHold(true);
    }
  }

  function onPlayPressed() {
    if (!game || !currentPlayer) return;
    if (selectedCardIds.length === 0) {
      setToast('Select a card first');
      return;
    }
    // A swap joker needs a target first, unless there's only one.
    const selected = [...currentPlayer.hand, ...currentPlayer.faceUp].filter(
      (c) => selectedCardIds.includes(c.id),
    );
    if (
      selected.some((c) => c.joker === 'swap') &&
      selected.every((c) => playableIds.includes(c.id)) &&
      swapTargets(game, game.currentPlayerIndex).length > 1
    ) {
      setSwapPicking(true);
      return;
    }
    playAndHold();
  }

  function onFlip(cardId: string) {
    playFaceDown(cardId);
    const outcome = flipOutcome(useGameStore.getState().recentEvents);
    if (outcome) setFlipResult(outcome);
  }

  // Pass-and-play gate: hide hand until the human taps "I'm ready".
  // Skip the gate entirely when only one human is playing (solo vs bots).
  if (isHumanTurn && !handRevealed && humanCount > 1) {
    return <PassDeviceGate name={currentPlayer.name} lastAction={recent} onReady={revealHand} />;
  }

  if (swapPicking && isHumanTurn) {
    return (
      <SwapTargetPicker
        targets={swapTargets(game, game.currentPlayerIndex).map((id) => game.players[id])}
        onPick={(id) => {
          setSwapPicking(false);
          playAndHold(id);
        }}
        onCancel={() => setSwapPicking(false)}
      />
    );
  }

  if (flipResult) {
    return (
      <FlipResultGate
        playerName={currentPlayer.name}
        card={flipResult.card}
        success={flipResult.success}
        onContinue={() => setFlipResult(null)}
      />
    );
  }

  // While someone else plays, the lone human keeps their cards in view.
  // Pass-and-play (several humans) still hides every hand between turns.
  const watcher = humanCount === 1 ? game.players.find((p) => !p.isBot) ?? null : null;

  const turnTitle =
    (game.phase === 'gameOver'
      ? 'Game over'
      : currentPlayer.isBot
      ? `${currentPlayer.name} is thinking…`
      : `${currentPlayer.name}'s turn`) +
    // Seat-rules tables: name whose rules this turn is played by.
    (game.phase !== 'gameOver' && currentPlayer.rules ? ` · ${currentPlayer.rules.name}` : '');

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.container}>
      {/* Variant badge — shows which ruleset is active */}
      <VariantBadge config={game.ruleConfig} />

      {/* Player scoreboard — fixed order, turn indicator on active player */}
      <View style={styles.scoreboardHeader}>
        <Text style={styles.scoreboardTitle}>Players</Text>
        <Pressable
          onPress={() => setHistoryOpen(true)}
          hitSlop={8}
          style={styles.historyBtn}
          accessibilityLabel="Game history"
          accessibilityRole="button"
        >
          <ScrollText size={20} color={theme.color.textMuted} strokeWidth={2} />
        </Pressable>
      </View>
      <View style={styles.scoreboard}>
        {game.players.map((p, i) => (
          <OpponentStrip
            key={p.id}
            player={p}
            isCurrent={i === game.currentPlayerIndex}
            bubble={tableTalk && tableTalk.playerId === p.id ? tableTalk : null}
          />
        ))}
      </View>

      <ActionCaption caption={actionCaption} highlighted={!!botAction || finalHold} />

      {/* Center: draw / pile / burned — pile is tappable for pickup */}
      <Center
        game={game}
        onPickup={isHumanTurn ? pickup : undefined}
        isHumanTurn={isHumanTurn}
        mustPickup={isHumanTurn && !canPlay}
      />

      <TurnBanner
        title={turnTitle}
        recent={recent}
        selectedCount={selectedCardIds.length}
        onPlay={isHumanTurn && source !== 'faceDown' && canPlay ? onPlayPressed : undefined}
      />

      {/* Toast: empty selection / rejected play */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Player area */}
      <View style={styles.playerArea}>
        {isHumanTurn ? (
          <HandArea
            player={currentPlayer}
            playableIds={playableIds}
            selectedIds={selectedCardIds}
            onToggle={toggleSelect}
            onFlip={onFlip}
          />
        ) : game.phase === 'gameOver' ? null : watcher ? (
          <WatchingHand player={watcher} currentName={currentPlayer.name} />
        ) : (
          <Text style={styles.dim}>Waiting for {currentPlayer.name}…</Text>
        )}
      </View>

      {/* Game history modal */}
      <GameLogModal
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        log={game.log}
      />
    </ScrollView>
    {stickUp && (
      <StickUpCard
        stickUp={stickUp}
        robberIsYou={isSoleHuman(game, stickUp.robberId)}
        victimIsYou={isSoleHuman(game, stickUp.victimId)}
        onClose={() => setStickUp(null)}
      />
    )}
    <AchievementToast earned={earnedThisGame} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.md,
    backgroundColor: theme.color.feltBg,
    minHeight: '100%',
    paddingBottom: 40,
  },
  scoreboard: { marginBottom: 4 },
  scoreboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  scoreboardTitle: {
    color: theme.color.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  historyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  toast: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  toastText: {
    color: theme.color.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  playerArea: {
    marginTop: 8,
    minHeight: 140,
  },
  dim: { color: theme.color.textMuted, fontStyle: 'italic' },
});
