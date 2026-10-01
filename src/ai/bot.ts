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
 *       2. Among power cards, prefer transparent > lowerThan > reset > burn.
 *     and play ALL cards of that rank we hold (we want to unload).
 *   - No legal plays → pick up.
 *
 * A player with botStyle 'novice' follows the same outline but skips the
 * rank priority: it plays one legal card, chosen at random.
 */
export function decideBotAction(state: GameState, playerIdx: number): BotAction {
  const player = state.players[playerIdx];
  const source = getPlaySource(player);
  const cfg = state.ruleConfig;
  if (source === null) return { type: 'pickup' };

  if (source === 'faceDown') {
    return { type: 'play', cardIds: [player.faceDown[0].id] };
  }

  const sourceCards = source === 'hand' ? player.hand : player.faceUp;
  const top = getEffectiveTopCard(state.playPile, cfg);

  // Group playable cards by rank.
  const byRank = new Map<Rank, string[]>();
  for (const c of sourceCards) {
    if (!canPlayCardOnTop(c, top, cfg)) continue;
    const list = byRank.get(c.rank) ?? [];
    list.push(c.id);
    byRank.set(c.rank, list);
  }
  if (byRank.size === 0) return { type: 'pickup' };

  // Novice: any one legal card. Three of these plus a human make a table the
  // human usually wins, which three strategic bots would not. Only seat them
  // WITH a human in a first-out-wins game, though: playing one card at a time
  // rarely empties a hand, so novices left to each other (an all-bot table,
  // or last-man-standing once the human is out) can trade cards for hundreds
  // of turns, occasionally forever.
  if (player.botStyle === 'novice') {
    const legal = Array.from(byRank.values()).flat();
    return { type: 'play', cardIds: [legal[Math.floor(Math.random() * legal.length)]] };
  }

  // Build a power card priority map from the config.
  // Prefer transparent (skip-like) > lowerThan > reverse > reset > burn.
  const powerOrder: Record<number, number> = {
    [cfg.transparentRank]: 1,
    [cfg.lowerThanRank]: 2,
    [cfg.resetRank]: 3,
    [cfg.burnRank]: 4,
  };
  if (cfg.reverseRank !== null) {
    powerOrder[cfg.reverseRank] = 2.5; // between lowerThan and reset
  }

  const ranks = Array.from(byRank.keys()).sort((a, b) => {
    const ap = isPowerCard(a, cfg);
    const bp = isPowerCard(b, cfg);
    if (ap && !bp) return 1;       // non-power before power
    if (!ap && bp) return -1;
    if (ap && bp) return (powerOrder[a] ?? 99) - (powerOrder[b] ?? 99);
    return a - b;                  // lowest non-power first
  });

  const chosenRank = ranks[0];
  return { type: 'play', cardIds: byRank.get(chosenRank)! };
}
