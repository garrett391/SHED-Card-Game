import { GameState, Rank } from '../engine/types';
import { canPlayCardOnTop, getEffectiveTopCard, isPowerCard } from '../engine/rules';
import { getPlaySource } from '../engine/engine';

export type BotAction =
  | { type: 'play'; cardIds: string[] }
  | { type: 'pickup' };

/**
 * Tiny heuristic bot. Good enough to be a fun opponent, easy to read,
 * easy to replace with something stronger later (MCTS, opponent modeling).
 *
 * Strategy:
 *   - Face-down phase: blind play (pick first remaining; order is random anyway).
 *   - Otherwise: if any legal plays exist, pick a rank by this priority:
 *       1. Non-power, lowest rank first (don't waste high cards or power cards).
 *       2. Among power cards, prefer 8 (skip-like) > 7 (situational) > 2 (resets) > 10 (burns).
 *     and play ALL cards of that rank we hold (we want to unload).
 *   - No legal plays → pick up.
 */
export function decideBotAction(state: GameState, playerIdx: number): BotAction {
  const player = state.players[playerIdx];
  const source = getPlaySource(player);
  if (source === null) return { type: 'pickup' };

  if (source === 'faceDown') {
    return { type: 'play', cardIds: [player.faceDown[0].id] };
  }

  const sourceCards = source === 'hand' ? player.hand : player.faceUp;
  const top = getEffectiveTopCard(state.playPile);

  // Group playable cards by rank.
  const byRank = new Map<Rank, string[]>();
  for (const c of sourceCards) {
    if (!canPlayCardOnTop(c, top)) continue;
    const list = byRank.get(c.rank) ?? [];
    list.push(c.id);
    byRank.set(c.rank, list);
  }
  if (byRank.size === 0) return { type: 'pickup' };

  const powerOrder: Record<number, number> = { 8: 1, 7: 2, 2: 3, 10: 4 };
  const ranks = Array.from(byRank.keys()).sort((a, b) => {
    const ap = isPowerCard(a);
    const bp = isPowerCard(b);
    if (ap && !bp) return 1;       // non-power before power
    if (!ap && bp) return -1;
    if (ap && bp) return (powerOrder[a] ?? 99) - (powerOrder[b] ?? 99);
    return a - b;                  // lowest non-power first
  });

  const chosenRank = ranks[0];
  return { type: 'play', cardIds: byRank.get(chosenRank)! };
}
