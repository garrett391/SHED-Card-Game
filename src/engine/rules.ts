import { Card, Player, Rank } from './types';

/**
 * Power cards per Cousin Jake:
 *   - High tier (always playable): 2 (reset), 8 (invisible)
 *   - Low tier: 7 (next must be ≤7 or 8), 10 (burn)
 *   - Four-of-a-kind also burns (separate rule).
 */
export const POWER_RANKS: ReadonlySet<Rank> = new Set([2, 7, 8, 10]);

export function isPowerCard(rank: Rank): boolean {
  return POWER_RANKS.has(rank);
}

/**
 * "8 is invisible." The effective top of the pile is the first non-8 card.
 * Returns null when the pile is empty or contains only 8s — meaning the next
 * player can play anything.
 */
export function getEffectiveTopCard(playPile: readonly Card[]): Card | null {
  for (const card of playPile) {
    if (card.rank !== 8) return card;
  }
  return null;
}

/**
 * Can `card` be played on top of `top` (the effective, 8-skipped top)?
 *
 *   - 2 and 8 are always playable.
 *   - On an empty effective top, anything is playable.
 *   - On a 7: next card must be ≤ 7 (the 8 case is covered by the always-playable
 *     rule above; 10 cannot be played on a 7 because 10 > 7).
 *   - Otherwise: meets-or-beats — card.rank >= top.rank.
 */
export function canPlayCardOnTop(card: Card, top: Card | null): boolean {
  if (card.rank === 2 || card.rank === 8) return true;
  if (top === null) return true;
  if (top.rank === 7) return card.rank <= 7;
  return card.rank >= top.rank;
}

/**
 * Multi-card play: a player may play any number of same-rank cards at once
 * (this is how four-of-a-kind in one turn can happen, and how players unload).
 * All cards must share a rank, and that rank must be playable on top.
 */
export function canPlayMultiple(
  cards: readonly Card[],
  top: Card | null,
): { ok: true } | { ok: false; reason: string } {
  if (cards.length === 0) return { ok: false, reason: 'No cards selected' };
  const rank = cards[0].rank;
  if (!cards.every(c => c.rank === rank)) {
    return { ok: false, reason: 'All selected cards must share a rank' };
  }
  if (!canPlayCardOnTop(cards[0], top)) {
    return { ok: false, reason: `Cannot play ${rank} on ${top?.rank ?? 'empty pile'}` };
  }
  return { ok: true };
}

/**
 * Four-of-a-kind burn check. Walk down the pile from the top, skipping
 * invisible 8s. If the first four non-8 cards share a rank, the pile burns.
 *
 * Per Cousin Jake: "An 8 does not break a four-of-a-kind sequence."
 * Example pile (top→bottom): [5, 8, 5, 5, 5] → burns.
 */
export function checkFourOfAKindBurn(playPile: readonly Card[]): boolean {
  let targetRank: Rank | null = null;
  let count = 0;
  for (const card of playPile) {
    if (card.rank === 8) continue;
    if (targetRank === null) {
      targetRank = card.rank;
      count = 1;
    } else if (card.rank === targetRank) {
      count++;
    } else {
      return false;
    }
    if (count >= 4) return true;
  }
  return false;
}

/**
 * The starting player is the one holding the lowest non-power card.
 * Power ranks (2, 7, 8, 10) are excluded from this comparison.
 * Per the rules, we search starting from the player to the left of the dealer
 * — here we treat player 0 as that seat, so iteration order is players[0..n-1].
 */
export function findStartingPlayer(players: readonly Player[]): number {
  let bestPlayer = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  for (let i = 0; i < players.length; i++) {
    let lowest = Number.POSITIVE_INFINITY;
    for (const c of players[i].hand) {
      if (!isPowerCard(c.rank) && c.rank < lowest) lowest = c.rank;
    }
    if (lowest < bestRank) {
      bestRank = lowest;
      bestPlayer = i;
    }
  }
  // Fallback: someone got dealt only power cards. Vanishingly rare but handle it.
  return bestPlayer === -1 ? 0 : bestPlayer;
}
