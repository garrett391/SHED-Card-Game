import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Center } from '../src/components/Center';
import { GameLogModal } from '../src/components/GameLogModal';
import { OpponentStrip } from '../src/components/OpponentStrip';
import { PlayingCard } from '../src/components/PlayingCard';
import { VariantBadge } from '../src/components/VariantBadge';
import { theme } from '../src/components/theme';
import { decideBotAction } from '../src/ai/bot';
import { rankLabel, cardLabel } from '../src/engine/cards';
import {
  getPlayableCardIds,
  getPlaySource,
  hasPlayableMove,
} from '../src/engine/engine';
import { useGameStore } from '../src/store/gameStore';
import { useCampaignStore } from '../src/store/campaignStore';
import {
  characterByName,
  maybeQuip,
  maybeReaction,
  powerReaction,
} from '../src/campaign/characters';
import { playSfx } from '../src/audio/sfx';
import { Card, GameEvent, GameState, RuleConfig } from '../src/engine/types';

const BOT_THINK_MS = 700;
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
 *  1. Bot turns auto-advance with a small delay so you can see what happened.
 *     The played card is already visible on top of the pile; a short caption
 *     names WHO played (the one thing the pile can't show) and then fades.
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
  const campaignPresetId = useGameStore((s) => s.campaignPresetId);

  // Face-down flip result: pause to show what was flipped before bots continue.
  const [flipResult, setFlipResult] = useState<{
    card: Card;
    success: boolean;
  } | null>(null);

  // Game history modal
  const [historyOpen, setHistoryOpen] = useState(false);

  // Hold before routing to game-over when a HUMAN's play ended the game, so
  // their winning play shows in the caption for a beat before the podium.
  // (Bot wins get this beat via botAction; winning face-down flips via the
  // flipResult gate, which waits for a Continue tap.)
  const [finalHold, setFinalHold] = useState(false);

  // Toast: empty-selection taps and rejected-play reasons
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // Bot action pacing: while set, the next bot turn is held for BOT_DISPLAY_MS
  // so plays don't blitz past faster than you can read them. Also carries the
  // character's quip, which becomes table talk when the window closes.
  const [botAction, setBotAction] = useState<{
    botName: string;
    playerId: number;   // which strip a follow-up speech bubble attaches to
    headline: string;   // e.g. "played K♠"
    detail?: string;    // e.g. "🔥 Burns the pile!"
    quip?: string;      // in-character one-liner, shown as table talk after
    card?: Card;        // (unused in UI now; retained from the event builder)
    emoji: string;      // leading emoji
  } | null>(null);

  // Ephemeral action caption: a short "Name played X" line above the pile that
  // fades after a few seconds. Text only — the played card is already on top of
  // the pile, so re-showing it there just read as a confusing second pile.
  // nonce restarts the fade for back-to-back plays with identical text.
  const [actionCaption, setActionCaption] = useState<{
    emoji: string;
    text: string;
    nonce: number;
  } | null>(null);

  // Table talk: an ephemeral speech bubble on a player's strip. Fired when a
  // bot's interstitial dismisses (so the line lands as a reaction at the
  // table, not a caption over it). One at a time; nonce restarts the
  // animation when the same character speaks twice in a row.
  const [tableTalk, setTableTalk] = useState<{
    playerId: number;
    text: string;
    nonce: number;
  } | null>(null);

  // Track which player we last triggered a bot action for, to avoid
  // re-firing on every re-render.
  const lastBotTurnRef = useRef<{ idx: number; epoch: number } | null>(null);

  // Bail to home if state was wiped (e.g. dev reload).
  useEffect(() => {
    if (!game) router.replace('/');
  }, [game, router]);

  // Route to game-over when phase changes. Wait for every "show the final play"
  // beat to finish first: bot pacing (botAction), the human's winning-play hold
  // (finalHold), and the face-down flip gate (flipResult — without this a
  // winning flip would route before its card was ever shown).
  useEffect(() => {
    if (game && game.phase === 'gameOver' && !botAction && !flipResult && !finalHold) {
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
  }, [game, router, botAction, flipResult, finalHold, campaignPresetId]);

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
    const turnIdx = game.currentPlayerIndex;
    const last = lastBotTurnRef.current;
    if (last && last.idx === turnIdx && last.epoch === epoch) {
      return;
    }

    const botName = current.name;

    const timer = setTimeout(() => {
      // Re-read latest store state in case something changed.
      const latest = useGameStore.getState();
      if (!latest.game || latest.game.phase !== 'playing') return;
      // Bail if the turn moved on between scheduling and firing. This also makes
      // effect teardown/re-run (and React StrictMode's double-invoke) safe:
      // because we haven't claimed the turn yet, a canceled timer leaves nothing
      // claimed, so the re-run can still schedule and act.
      if (latest.game.currentPlayerIndex !== turnIdx || latest.game.log.length !== epoch) return;
      const cur = latest.game.players[turnIdx];
      if (!cur.isBot || cur.isFinished) return;

      // Claim the turn only now that we're actually committing to act.
      lastBotTurnRef.current = { idx: turnIdx, epoch };

      const action = decideBotAction(latest.game, turnIdx);
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
      const cfg = latest.game?.ruleConfig ?? game.ruleConfig;
      const display = buildBotActionDisplay(botName, events, cfg);
      const character = characterByName(botName);
      // Situational line beats generic: their burn > their pickup > their
      // power card > table talk.
      let quip: string | undefined;
      if (character) {
        const played = events.find((e) => e.type === 'cardsPlayed');
        const power =
          played && played.type === 'cardsPlayed'
            ? powerReaction(played.cards[0].rank, cfg)
            : null;
        if (events.some((e) => e.type === 'pileBurned')) {
          quip = maybeReaction(character, 'selfBurn') ?? undefined;
        } else if (events.some((e) => e.type === 'pileTakenUp')) {
          quip = maybeReaction(character, 'selfPickup') ?? undefined;
        } else if (power) {
          quip = maybeReaction(character, power) ?? undefined;
        } else {
          quip = maybeQuip(character) ?? undefined;
        }
      }
      setBotAction({ ...display, playerId: cur.id, quip });
      setActionCaption({
        emoji: display.emoji,
        text: captionText(character ? `${character.emoji} ${botName}` : botName, display),
        nonce: Date.now(),
      });
    }, BOT_THINK_MS);
    return () => clearTimeout(timer);
  }, [game, flipResult, botAction]);

  // Game sounds, driven by engine events rather than buttons, so every path
  // is covered — human taps, bot turns, forced pickups, failed face-down
  // flips. recentEvents is replaced wholesale on each action, so each sound
  // fires exactly once per action. The two branches are mutually exclusive
  // in practice (an action emits cardsPlayed OR pileTakenUp, never both — a
  // failed flip emits faceDownFlipFailed + pileTakenUp); the pickup branch
  // is checked first as the salient moment just in case that ever changes.
  useEffect(() => {
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
    // A HUMAN picking up or burning the pile invites commentary: a random
    // character at the table reacts after a short beat (so it reads as a
    // response, not a simultaneous caption). Bot pickups and burns are
    // excluded — those characters already speak via their own interstitial
    // dismissal. Burns only draw lines from characters written to react to
    // them; everyone else stays quiet.
    if (!game) return;
    const isHuman = (id: number) => game.players[id] ? !game.players[id].isBot : false;
    const pickup = recentEvents.find((e) => e.type === 'pileTakenUp');
    const played = recentEvents.find((e) => e.type === 'cardsPlayed');
    let kind: 'humanPickup' | 'humanBurn' | null = null;
    if (pickup && pickup.type === 'pileTakenUp' && isHuman(pickup.playerId)) {
      kind = 'humanPickup';
    } else if (
      recentEvents.some((e) => e.type === 'pileBurned') &&
      played && played.type === 'cardsPlayed' &&
      isHuman(played.playerId)
    ) {
      kind = 'humanBurn';
    }
    if (!kind) return;
    const hecklers = game.players.filter((p) => {
      if (!p.isBot || p.isFinished) return false;
      const c = characterByName(p.name);
      if (!c) return false;
      return kind === 'humanPickup' || (c.reactions.humanBurn?.length ?? 0) > 0;
    });
    if (hecklers.length === 0) return;
    const h = hecklers[Math.floor(Math.random() * hecklers.length)];
    const line = maybeReaction(characterByName(h.name)!, kind);
    if (!line) return;
    const t = setTimeout(
      () => setTableTalk({ playerId: h.id, text: line, nonce: Date.now() }),
      600,
    );
    return () => clearTimeout(t);
  }, [recentEvents, game]);

  // Auto-dismiss bot action interstitial after BOT_DISPLAY_MS. If the bot
  // had a quip, it becomes a speech bubble on their strip as the game area
  // returns — table talk, not a caption.
  useEffect(() => {
    if (!botAction) return;
    const timer = setTimeout(() => {
      if (botAction.quip) {
        setTableTalk({
          playerId: botAction.playerId,
          text: botAction.quip,
          nonce: Date.now(),
        });
      }
      setBotAction(null);
    }, BOT_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [botAction]);

  // Bubble lifetime: cleared after the fade-out completes (timings live in
  // OpponentStrip; this just retires the state).
  useEffect(() => {
    if (!tableTalk) return;
    const timer = setTimeout(() => setTableTalk(null), 3400);
    return () => clearTimeout(timer);
  }, [tableTalk]);

  // Retire the action caption after a short beat so it reads as an ephemeral
  // notification, not a permanent label. A touch longer than the bot pacing
  // window so the line lingers briefly into the next turn before fading.
  useEffect(() => {
    if (!actionCaption) return;
    const timer = setTimeout(() => setActionCaption(null), 2600);
    return () => clearTimeout(timer);
  }, [actionCaption]);

  // Release the human's winning-play hold after the same beat bots get.
  useEffect(() => {
    if (!finalHold) return;
    const timer = setTimeout(() => setFinalHold(false), BOT_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [finalHold]);

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

  // Phase guard matters now: the screen stays mounted for a beat after the
  // game ends (finalHold / botAction), and nothing should be tappable then.
  const isHumanTurn =
    game.phase === 'playing' && !currentPlayer.isBot && !currentPlayer.isFinished;
  const source = getPlaySource(currentPlayer);
  const playableIds = isHumanTurn
    ? getPlayableCardIds(game, game.currentPlayerIndex)
    : [];
  const canPlay = isHumanTurn && hasPlayableMove(game, game.currentPlayerIndex);

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
              {summarizeRecent(recentEvents, game.players, game.ruleConfig)}
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
          <Text style={styles.passLabel}>{currentPlayer.name} flipped…</Text>
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
          <Text style={styles.sectionLabel}>{currentPlayer.name}'s hand</Text>
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
          <Text style={styles.historyBtnText}>📜</Text>
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

      {/* Ephemeral action caption — who just played what. Text above the pile
          (never a card), so it can't be mistaken for a second pile. Reserved
          height keeps the layout from jumping as it fades in and out. */}
      <View style={styles.captionZone}>
        {actionCaption && (
          <ActionCaption
            caption={actionCaption}
            highlighted={!!botAction || finalHold}
          />
        )}
      </View>

      {/* Center: draw / pile / burned — pile is tappable for pickup */}
      <Center
        game={game}
        onPickup={isHumanTurn ? pickup : undefined}
        isHumanTurn={isHumanTurn}
        mustPickup={isHumanTurn && !canPlay}
      />

      {/* Turn banner — info left, play button right */}
      <View style={styles.turnBanner}>
        <View style={styles.turnInfo}>
          <Text style={styles.turnText}>
            {game.phase === 'gameOver'
              ? '🏆 Game over'
              : currentPlayer.isBot
              ? `${currentPlayer.name} is thinking…`
              : `${currentPlayer.name}'s turn`}
          </Text>
          {recentEvents.length > 0 && (
            <Text style={styles.recent}>{summarizeRecent(recentEvents, game.players, game.ruleConfig)}</Text>
          )}
        </View>
        {isHumanTurn && source !== 'faceDown' && canPlay && (
          <Pressable
            onPress={() => {
              if (selectedCardIds.length === 0) {
                setToast('Select a card first');
                return;
              }
              const playerName = currentPlayer.name;
              playSelected();
              // If that play just ended the game, surface it in the caption and
              // hold the game-over route for a beat — otherwise the podium
              // appears before you ever see what you played. Set synchronously
              // (not via effect) so the routing effect sees the hold this commit.
              const latest = useGameStore.getState();
              if (latest.game?.phase === 'gameOver') {
                const d = buildBotActionDisplay(
                  playerName,
                  latest.recentEvents,
                  latest.game.ruleConfig,
                );
                setActionCaption({
                  emoji: d.emoji,
                  text: captionText(playerName, d),
                  nonce: Date.now(),
                });
                setFinalHold(true);
              }
            }}
            style={({ pressed }) => [
              styles.playBtn,
              selectedCardIds.length > 0
                ? styles.playBtnActive
                : styles.playBtnDim,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.playBtnText,
                selectedCardIds.length === 0 && styles.playBtnTextDim,
              ]}
            >
              {selectedCardIds.length > 1
                ? `Play ${selectedCardIds.length}`
                : 'Play'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Toast: empty selection / rejected play */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Player area */}
      <View style={styles.playerArea}>
        {isHumanTurn ? (
          renderHandArea()
        ) : game.phase === 'gameOver' ? null : (
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
  );
}

/** Compose the caption line: "Name played X" plus any effect, on one line. */
function captionText(
  name: string,
  display: { headline: string; detail?: string },
): string {
  const effect = display.detail ? ' · ' + display.detail.replace(/\n/g, ' · ') : '';
  return `${name} ${display.headline}${effect}`;
}

/**
 * Ephemeral caption above the pile: fades in, holds, fades out — keyed on
 * nonce so consecutive identical lines still re-animate (mirrors the
 * table-talk bubble timing). Text only; the played card lives on the pile.
 */
function ActionCaption({
  caption,
  highlighted,
}: {
  caption: { emoji: string; text: string; nonce: number };
  highlighted: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    seq.start();
    return () => seq.stop();
  }, [caption.nonce, anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.caption,
        highlighted && styles.captionActive,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.captionText} numberOfLines={2}>
        {caption.emoji} {caption.text}
      </Text>
    </Animated.View>
  );
}

/** Build a display object from bot action events (headline + effect + card). */
function buildBotActionDisplay(
  botName: string,
  events: GameEvent[],
  cfg: RuleConfig,
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
    const reversed = events.find((e) => e.type === 'directionReversed');

    let detail: string | undefined;
    if (burn && burn.type === 'pileBurned') {
      detail = burn.reason === 'burnRank'
        ? '🔥 Burns the pile!'
        : burn.reason === 'tripleTransparent'
        ? `🔥 Triple ${rankLabel(cfg.transparentRank)}s — burns the pile!`
        : '🔥 Four-of-a-kind — burns the pile!';
    }
    if (reversed) {
      detail = (detail ? detail + '\n' : '') + '🔄 Direction reversed!';
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
  cfg: RuleConfig,
): string {
  const playerName = (id: number) => players?.find((p) => p.id === id)?.name ?? 'Someone';

  // Walk most-impactful → least.
  for (const e of events) {
    if (e.type === 'pileBurned') {
      return e.reason === 'burnRank'
        ? `🔥 ${rankLabel(cfg.burnRank)} burns the pile`
        : e.reason === 'tripleTransparent'
        ? `🔥 Triple ${rankLabel(cfg.transparentRank)}s burn the pile`
        : '🔥 Four-of-a-kind burns the pile';
    }
    if (e.type === 'directionReversed') {
      return '🔄 Direction reversed!';
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
      const label = rankLabel(e.cards[0].rank);
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
  historyBtnText: {
    fontSize: 18,
  },
  turnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 6,
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
  },
  turnInfo: {
    flex: 1,
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
  playBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    marginLeft: 10,
  },
  playBtnActive: {
    backgroundColor: theme.color.primary,
  },
  playBtnDim: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  playBtnTextDim: {
    color: theme.color.textMuted,
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
  // Ephemeral action caption above the pile
  captionZone: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  caption: {
    maxWidth: '92%',
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  captionActive: {
    borderColor: theme.color.accent,
  },
  captionText: {
    color: theme.color.textOnDark,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
