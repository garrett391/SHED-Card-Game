import { Card, GameState, Rank, RuleConfig } from '../engine/types';
import { canPlayCardOnTop, cardWorth, getEffectiveTopCard, isPowerCard } from '../engine/rules';
import { getPlaySource, rulesFor, swapTargets } from '../engine/engine';
import { JOKER_RANK } from '../engine/cards';

export type BotAction =
  | { type: 'play'; cardIds: string[]; swapTargetId?: number }
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
  const cfg = rulesFor(state, playerIdx);
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
    [JOKER_RANK]: 5, // the most chaotic card: save it for last
  };
  if (cfg.reverseRank !== null) {
    powerOrder[cfg.reverseRank] = 2.5; // between lowerThan and reset
  }

  // A robber's 7 is a weapon, not a card to save: play it like any other.
  const power = (r: Rank) => isPowerCard(r, cfg) && !(cfg.stickUp && r === cfg.lowerThanRank);
  const ranks = Array.from(byRank.keys()).sort((a, b) => {
    const ap = power(a);
    const bp = power(b);
    if (ap && !bp) return 1;       // non-power before power
    if (!ap && bp) return -1;
    if (ap && bp) return (powerOrder[a] ?? 99) - (powerOrder[b] ?? 99);
    return a - b;                  // lowest non-power first
  });

  const chosenRank = ranks[0];
  const cardIds = byRank.get(chosenRank)!;
  const swapping = sourceCards.some((c) => cardIds.includes(c.id) && c.joker === 'swap');
  return swapping
    ? { type: 'play', cardIds, swapTargetId: pickSwapTarget(state, playerIdx) }
    : { type: 'play', cardIds };
}

export interface BotSwap {
  handCardId: string;
  faceUpCardId: string;
}

/**
 * The pre-game swap: which hand cards a bot trades for face-up cards.
 *
 * Face-up cards are played late, when there's no hand left to fall back on,
 * so a strategic bot puts its three most useful cards there (by cardWorth,
 * under its own seat's rules) and keeps the rest in hand. The one exception
 * is the swap joker: played from face-up, with an empty hand, it would trade
 * nothing for someone else's cards, so it stays in hand.
 *
 * Novices don't know the trick and keep the cards they were dealt.
 */
export function decideBotSwaps(state: GameState, playerIdx: number): BotSwap[] {
  const player = state.players[playerIdx];
  if (!player || player.botStyle === 'novice') return [];
  const cfg = rulesFor(state, playerIdx);
  const worth = (c: Card) => faceUpWorth(c, cfg);

  // Rank all six cards; the top ones (as many as there are face-up slots) go up.
  const pool = [...player.faceUp, ...player.hand];
  const up = new Set(
    [...pool].sort((a, b) => worth(b) - worth(a)).slice(0, player.faceUp.length).map((c) => c.id),
  );
  const goingUp = player.hand.filter((c) => up.has(c.id));
  const goingDown = player.faceUp.filter((c) => !up.has(c.id));
  return goingUp.map((c, i) => ({ handCardId: c.id, faceUpCardId: goingDown[i].id }));
}

function faceUpWorth(card: Card, cfg: RuleConfig): number {
  return card.joker === 'swap' ? -1 : cardWorth(card, cfg);
}

/** Steal the smallest hand at the table (ties go to the earliest seat). */
function pickSwapTarget(state: GameState, playerIdx: number): number | undefined {
  const targets = swapTargets(state, playerIdx);
  if (targets.length === 0) return undefined;
  return targets.reduce((best, id) =>
    state.players[id].hand.length < state.players[best].hand.length ? id : best,
  );
}
