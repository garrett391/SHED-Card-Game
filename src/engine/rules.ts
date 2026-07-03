import { Card, Player, Rank, RuleConfig } from './types';
import { rankLabel } from './cards';

// ─── Default rule config (Jake the Elder's rules) ──────────────────────────────

export const DEFAULT_RULES: RuleConfig = {
  id: 'jake-classic',
  name: "Jake's Classic",
  description: '2 resets, 7 or lower, 8 is invisible, 10 burns.',
  flavorText: 'The rules passed from Jake the Elder to his disciples.',
  resetRank: 2,
  lowerThanRank: 7,
  transparentRank: 8,
  burnRank: 10,
  reverseRank: null,
  reverseRankWild: false,
  fourOfAKindBurns: true,
  tripleTransparentBurns: false,
  hardEights: false,
  burnRankRestricted: false,
  burnRankOverridesLowerThan: false,
  sixNineReverse: false,
  lastManStanding: false,
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

// Cache the derived power-rank Set per config object. The ranks are fixed for the
// lifetime of a RuleConfig (presets are immutable constants), so we compute the
// Set once and reuse it — isPowerCard runs inside bot sort comparisons and the
// findStartingPlayer inner loop, where re-allocating a Set each call adds up.
const _powerRankCache = new WeakMap<RuleConfig, ReadonlySet<Rank>>();

/** Derive the set of power ranks from a config (memoized per config object). */
export function getPowerRanks(config: RuleConfig = DEFAULT_RULES): ReadonlySet<Rank> {
  const cached = _powerRankCache.get(config);
  if (cached) return cached;

  const ranks: Rank[] = [
    config.resetRank,
    config.lowerThanRank,
    config.transparentRank,
    config.burnRank,
  ];
  // The reverse rank counts as a power card only when it's wild (always
  // playable). An ordered reverse rank is a normal card that happens to flip
  // direction, so it stays in the starting-card calc and isn't hoarded.
  if (config.reverseRank !== null && config.reverseRankWild) ranks.push(config.reverseRank);
  const set: ReadonlySet<Rank> = new Set(ranks);
  _powerRankCache.set(config, set);
  return set;
}

export function isPowerCard(rank: Rank, config: RuleConfig = DEFAULT_RULES): boolean {
  return getPowerRanks(config).has(rank);
}

// ─── Pile inspection ────────────────────────────────────────────────────────────

/**
 * "Transparent card is invisible." The effective top of the pile is the first
 * non-transparent card. Returns null when the pile is empty or all transparent.
 */
export function getEffectiveTopCard(
  playPile: readonly Card[],
  config: RuleConfig = DEFAULT_RULES,
): Card | null {
  for (const card of playPile) {
    if (card.rank !== config.transparentRank) return card;
  }
  return null;
}

// ─── Legality checks ────────────────────────────────────────────────────────────

/**
 * Can `card` be played on top of `top` (the effective, transparent-skipped top)?
 *
 *   - Reset rank is always playable.
 *   - Transparent rank is always playable UNLESS hardEights is on and top is lowerThan.
 *   - Reverse rank (if set) is always playable only when reverseRankWild is on;
 *     otherwise it obeys the normal meets-or-beats rule.
 *   - On an empty effective top, anything is playable.
 *   - On a lowerThan card: next card must be <= lowerThanRank,
 *     unless burnRankOverridesLowerThan is true and card is the burn rank.
 *   - Burn rank is playable on anything UNLESS burnRankRestricted is on
 *     and the top is a face card (J/Q/K/A).
 *   - Otherwise: meets-or-beats — card.rank >= top.rank.
 */
export function canPlayCardOnTop(
  card: Card,
  top: Card | null,
  config: RuleConfig = DEFAULT_RULES,
): boolean {
  // Reset rank: always playable
  if (card.rank === config.resetRank) return true;

  // Transparent rank: always playable — unless Hard Eights and top is lowerThan
  if (card.rank === config.transparentRank) {
    if (config.hardEights && top !== null && top.rank === config.lowerThanRank) {
      return false;
    }
    return true;
  }

  // Reverse rank: always playable ONLY when configured wild (Chaos). Otherwise
  // it falls through to the normal meets-or-beats rule below — its reverse
  // effect still fires when it's legally played (see applyCardEffects).
  if (config.reverseRank !== null && config.reverseRankWild && card.rank === config.reverseRank) {
    return true;
  }

  // Empty pile — anything goes
  if (top === null) return true;

  // LowerThan constraint: when the top is lowerThanRank, next must be ≤ it
  if (top.rank === config.lowerThanRank) {
    // Super 10s override: burn rank can be played on lowerThan
    if (card.rank === config.burnRank && config.burnRankOverridesLowerThan) return true;
    return card.rank <= config.lowerThanRank;
  }

  // Burn rank
  if (card.rank === config.burnRank) {
    if (config.burnRankRestricted && top.rank >= 11) return false; // face cards
    return true;
  }

  // Default: meets or beats
  return card.rank >= top.rank;
}

/**
 * Multi-card play: all cards must share a rank and that rank must be legal.
 */
export function canPlayMultiple(
  cards: readonly Card[],
  top: Card | null,
  config: RuleConfig = DEFAULT_RULES,
): { ok: true } | { ok: false; reason: string } {
  if (cards.length === 0) return { ok: false, reason: 'No cards selected' };
  const rank = cards[0].rank;
  if (!cards.every(c => c.rank === rank)) {
    return { ok: false, reason: 'All selected cards must share a rank' };
  }
  if (!canPlayCardOnTop(cards[0], top, config)) {
    return {
      ok: false,
      reason: `Cannot play ${rankLabel(rank)} on ${top ? rankLabel(top.rank) : 'empty pile'}`,
    };
  }
  return { ok: true };
}

// ─── Burn checks ────────────────────────────────────────────────────────────────

/**
 * Four-of-a-kind burn check. Walk down the pile from the top, skipping
 * transparent cards. If the first four non-transparent cards share a rank,
 * the pile burns.
 *
 * Per Cousin Jake: "A transparent card does not break a four-of-a-kind sequence."
 *
 * Special case: four transparents at the top also burn (they'd otherwise be
 * skipped by the main loop).
 */
export function checkFourOfAKindBurn(
  playPile: readonly Card[],
  config: RuleConfig = DEFAULT_RULES,
): boolean {
  if (!config.fourOfAKindBurns) return false;

  // Count leading transparents
  let leadingTransparent = 0;
  for (const card of playPile) {
    if (card.rank === config.transparentRank) leadingTransparent++;
    else break;
  }
  if (leadingTransparent >= 4) return true;

  // General case: skip transparents, check first 4 non-transparent
  let targetRank: Rank | null = null;
  let count = 0;
  for (const card of playPile) {
    if (card.rank === config.transparentRank) continue;
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
 * OFCOM rule: three consecutive transparent cards at the top of the pile burn it.
 */
export function checkTripleTransparentBurn(
  playPile: readonly Card[],
  config: RuleConfig,
): boolean {
  if (!config.tripleTransparentBurns) return false;
  let consecutive = 0;
  for (const card of playPile) {
    if (card.rank === config.transparentRank) {
      consecutive++;
      if (consecutive >= 3) return true;
    } else {
      break;
    }
  }
  return false;
}

// ─── Starting player ────────────────────────────────────────────────────────────

/**
 * The starting player is the one holding the lowest non-power card.
 */
export function findStartingPlayer(
  players: readonly Player[],
  config: RuleConfig = DEFAULT_RULES,
): number {
  const powerRanks = getPowerRanks(config);
  let bestPlayer = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  for (let i = 0; i < players.length; i++) {
    let lowest = Number.POSITIVE_INFINITY;
    for (const c of players[i].hand) {
      if (!powerRanks.has(c.rank) && c.rank < lowest) lowest = c.rank;
    }
    if (lowest < bestRank) {
      bestRank = lowest;
      bestPlayer = i;
    }
  }
  return bestPlayer === -1 ? 0 : bestPlayer;
}
