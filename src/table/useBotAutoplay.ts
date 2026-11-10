import { useEffect, useRef } from 'react';
import { decideBotAction } from '../ai/bot';
import { getPlaySource } from '../engine/engine';
import { GameEvent, GameState, RuleConfig } from '../engine/types';
import { useGameStore } from '../store/gameStore';

export interface BotActed {
  botName: string;
  playerId: number;
  /** The events the bot's action produced. */
  events: GameEvent[];
  /** The game after the action. */
  game: GameState | null;
  /** The table's rules when the bot acted. */
  cfg: RuleConfig;
}

/**
 * Plays bot turns: when it's a bot's turn and nothing is holding the table
 * (`paused`), wait `thinkMs`, let the bot decide, dispatch its action to
 * the game store, then report what happened through `onActed`.
 */
export function useBotAutoplay(
  game: GameState | null,
  paused: boolean,
  onActed: (acted: BotActed) => void,
  thinkMs: number,
): void {
  // Which turn we last acted for, so re-renders don't fire it twice.
  const lastBotTurnRef = useRef<{ idx: number; epoch: number } | null>(null);
  // The latest callback, without restarting the timer on every render.
  const onActedRef = useRef(onActed);
  onActedRef.current = onActed;

  useEffect(() => {
    if (!game || game.phase !== 'playing' || paused) return;
    const current = game.players[game.currentPlayerIndex];
    if (!current.isBot || current.isFinished) return;

    // Use the game's log length as an "epoch" — any time the state changes
    // meaningfully, the log grows, so we can re-fire for the same bot if
    // they get an extra turn.
    const epoch = game.log.length;
    const turnIdx = game.currentPlayerIndex;
    const last = lastBotTurnRef.current;
    if (last && last.idx === turnIdx && last.epoch === epoch) return;

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
        if (getPlaySource(cur) === 'faceDown') {
          latest.playFaceDown(action.cardIds[0]);
        } else {
          latest.playSelected(action.swapTargetId);
        }
      }

      const after = useGameStore.getState();
      onActedRef.current({
        botName,
        playerId: cur.id,
        events: after.recentEvents,
        game: after.game,
        cfg: latest.game.ruleConfig,
      });
    }, thinkMs);
    return () => clearTimeout(timer);
  }, [game, paused, thinkMs]);
}
