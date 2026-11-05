import { BotStyle, Card, GameState, Player, Rank, RuleConfig } from '../engine/types';
import { canPlayCardOnTop, cardWorth, getEffectiveTopCard, isPowerCard } from '../engine/rules';
import { getPlaySource, pickupPile, playCards, rulesFor, swapTargets } from '../engine/engine';
import { JOKER_RANK, shuffle } from '../engine/cards';

export type BotAction =
  | { type: 'play'; cardIds: string[]; swapTargetId?: number }
  | { type: 'pickup' };

/**
 * The bots: one small heuristic per play style, all reading the same
 * GameState the UI does and only what a player at the table could see (the
 * pile, everyone's face-up cards, hand sizes, the draw pile's size). Nobody
 * peeks at a hidden hand.
 *
 * Every style shares the outline:
 *   - Face-down phase: blind flip (the first card; their order is random).
 *   - No legal play: pick up.
 *   - Otherwise choose cards by style (BotStyle in engine/types.ts):
 *
 *   strategic  The default. Lowest ordinary rank first, all copies at once;
 *              power cards only when nothing else plays, cheapest first
 *              (transparent > lower-than > reverse > reset > burn > joker).
 *   sharp      Thinks ahead: before each move it plays out the rest of the
 *              game dozens of times from each option and picks what wins
 *              most. The cards it can't see are reshuffled for every
 *              playout, so it reasons about what you might hold, never
 *              what you do. Sticks to the strategic move unless another
 *              is clearly better, and may pick up on purpose.
 *   schemer    Strategic, but hoards: while the deck lasts it takes up any
 *              small pile with a power card in it rather than play into it.
 *              Once the deck is gone it burns whenever it can.
 *   coward     The smallest card it can play, one at a time while the deck
 *              lasts (a 2 counts as small); all copies once it's gone.
 *   reckless   The biggest ordinary card it can play, the same way: aces
 *              before kings, kings before queens. Saves its 2s and 10s like
 *              anyone, but throws a joker the moment it can.
 *   novice     One legal card at random: never unloads a set, never saves a
 *              power card. For characters still learning the game.
 *
 * The styles come from docs/design/strategy.md (the "Dickhead" there is
 * `reckless` here). Measured against three strategic bots across the
 * campaign's rule sets (a fair share is 25%), sharp wins about a third of
 * its games; strategic, schemer and coward a fifth to a quarter; reckless
 * about a tenth, nearer a fifth where there are jokers; novices rarely.
 */
export function decideBotAction(state: GameState, playerIdx: number): BotAction {
  const player = state.players[playerIdx];
  const source = getPlaySource(player);
  const cfg = rulesFor(state, playerIdx);
  if (source === null) return { type: 'pickup' };

  if (source === 'faceDown') {
    return { type: 'play', cardIds: [player.faceDown[0].id] };
  }

  const style: BotStyle = player.botStyle ?? 'strategic';
  if (style === 'schemer' && hoards(state, player, cfg)) return { type: 'pickup' };

  const sourceCards = source === 'hand' ? player.hand : player.faceUp;
  const byRank = legalByRank(sourceCards, getEffectiveTopCard(state.playPile, cfg), cfg);
  if (byRank.size === 0) return { type: 'pickup' };

  const choice = chooseCards(style, state, playerIdx, byRank, cfg);
  if (choice === 'pickup') return { type: 'pickup' };
  const swapping = sourceCards.some((c) => choice.includes(c.id) && c.joker === 'swap');
  return swapping
    ? { type: 'play', cardIds: choice, swapTargetId: pickSwapTarget(state, playerIdx, choice) }
    : { type: 'play', cardIds: choice };
}

function chooseCards(
  style: BotStyle,
  state: GameState,
  playerIdx: number,
  byRank: Map<Rank, string[]>,
  cfg: RuleConfig,
): string[] | 'pickup' {
  const ranks = Array.from(byRank.keys());
  const strategic = () => byRank.get(strategicOrder(ranks, cfg)[0])!;
  // Once the deck is gone, every card played is one fewer to shed.
  const late = state.drawPile.length === 0;
  switch (style) {
    case 'novice': {
      // Three of these plus a human make a table the human usually wins,
      // which three strategic bots would not. Only seat them WITH a human
      // in a first-out-wins game, though: playing one card at a time rarely
      // empties a hand, so novices left to each other (an all-bot table, or
      // last-man-standing once the human is out) can trade cards for
      // hundreds of turns, occasionally forever.
      const legal = Array.from(byRank.values()).flat();
      return [legal[Math.floor(Math.random() * legal.length)]];
    }
    case 'coward': {
      const ids = byRank.get(Math.min(...ranks) as Rank)!;
      return late ? ids : [ids[0]];
    }
    case 'reckless': {
      if (byRank.has(JOKER_RANK)) return [byRank.get(JOKER_RANK)![0]];
      const ordinary = ranks.filter((r) => !isPower(r, cfg));
      if (ordinary.length === 0) return strategic();
      const ids = byRank.get(Math.max(...ordinary) as Rank)!;
      return late ? ids : [ids[0]];
    }
    case 'schemer':
      return (late && burningPlay(state, playerIdx, byRank)) || strategic();
    case 'sharp':
      return searchPlay(state, playerIdx, byRank, cfg);
    case 'strategic':
    default:
      return strategic();
  }
}

/** Playable cards from `cards`, grouped by rank. */
function legalByRank(cards: readonly Card[], top: Card | null, cfg: RuleConfig): Map<Rank, string[]> {
  const byRank = new Map<Rank, string[]>();
  for (const c of cards) {
    if (!canPlayCardOnTop(c, top, cfg)) continue;
    const list = byRank.get(c.rank) ?? [];
    list.push(c.id);
    byRank.set(c.rank, list);
  }
  return byRank;
}

/** A card worth saving. A robber's 7 is a weapon, not a card to save. */
function isPower(r: Rank, cfg: RuleConfig): boolean {
  return isPowerCard(r, cfg) && !(cfg.stickUp && r === cfg.lowerThanRank);
}

/** Ranks in the strategic bot's order of preference, best first. */
function strategicOrder(ranks: readonly Rank[], cfg: RuleConfig): Rank[] {
  // Cheapest power card first: transparent > lowerThan > reverse > reset > burn.
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
  return [...ranks].sort((a, b) => {
    const ap = isPower(a, cfg);
    const bp = isPower(b, cfg);
    if (ap && !bp) return 1;       // non-power before power
    if (!ap && bp) return -1;
    if (ap && bp) return (powerOrder[a] ?? 99) - (powerOrder[b] ?? 99);
    return a - b;                  // lowest non-power first
  });
}

// ─── Schemer ────────────────────────────────────────────────────────────────

/** The biggest pile a schemer takes up on purpose. */
const HOARD_MAX_PILE = 3;
/** A schemer stops hoarding once their hand is this big. */
const HOARD_MAX_HAND = 7;

/** A small pile with a power card in it, while the deck lasts: take it. */
function hoards(state: GameState, player: Player, cfg: RuleConfig): boolean {
  if (state.drawPile.length === 0) return false;
  if (player.hand.length === 0 || player.hand.length >= HOARD_MAX_HAND) return false;
  const pile = state.playPile;
  if (pile.length === 0 || pile.length > HOARD_MAX_PILE) return false;
  return pile.some(
    (c) => c.rank === JOKER_RANK || c.rank === cfg.burnRank || c.rank === cfg.resetRank,
  );
}

/** A legal play that burns the pile (a 10, or the fourth of a kind), if any. */
function burningPlay(
  state: GameState,
  playerIdx: number,
  byRank: Map<Rank, string[]>,
): string[] | null {
  for (const ids of byRank.values()) {
    const { events } = playCards(state, playerIdx, ids);
    if (events.some((e) => e.type === 'pileBurned')) return ids;
  }
  return null;
}

// ─── Sharp ──────────────────────────────────────────────────────────────────

/**
 * Search settings, tuned against strategic bots (see decideBotAction):
 * more worlds help up to about 64; the margin keeps the bot from chasing
 * noise, which with fewer worlds or no margin made it weaker than the
 * strategic bot it starts from. A slow phone stops early, at the budget.
 */
export const SEARCH = {
  /** Deals of the unseen cards to play every option out in. */
  worlds: 64,
  /** Never fewer than this, however slow the device. */
  minWorlds: 12,
  /** Stop adding worlds after this long: the table waits on the bot, and
   *  phones run this several times slower than a desktop browser. */
  budgetMs: 150,
  /** Wins out of every 16 worlds another move needs over the strategic one. */
  marginPer16: 1,
  /** A playout this long is called off as a draw. */
  maxTurns: 400,
};

/**
 * Every legal play (all copies of one rank) and, if there's a pile, picking
 * it up, each played out to the end in the same reshuffled worlds so the
 * options are compared like for like. The strategic move stands unless
 * another wins clearly more.
 */
function searchPlay(
  state: GameState,
  playerIdx: number,
  byRank: Map<Rank, string[]>,
  cfg: RuleConfig,
): string[] | 'pickup' {
  const options: (string[] | 'pickup')[] = strategicOrder(Array.from(byRank.keys()), cfg)
    .map((r) => byRank.get(r)!);
  if (state.playPile.length > 0) options.push('pickup');
  if (options.length === 1) return options[0];

  const scores = options.map(() => 0);
  const start = Date.now();
  let worlds = 0;
  while (
    worlds < SEARCH.worlds &&
    (worlds < SEARCH.minWorlds || Date.now() - start < SEARCH.budgetMs)
  ) {
    const world = determinize(state, playerIdx);
    options.forEach((opt, i) => {
      const first = opt === 'pickup' ? pickupPile(world, playerIdx) : playCards(world, playerIdx, opt);
      scores[i] += playout(first.state, playerIdx);
    });
    worlds++;
  }

  let best = 0;
  let bar = scores[0] + (SEARCH.marginPer16 * worlds) / 16;
  for (let i = 1; i < options.length; i++) {
    if (scores[i] > bar) {
      best = i;
      bar = scores[i];
    }
  }
  return options[best];
}

/**
 * One possible world: the cards `me` can't see (other hands, every
 * face-down card, the draw pile) dealt again at random into the same
 * places, and everyone playing the strategic style from here on.
 */
function determinize(state: GameState, me: number): GameState {
  const unseen: Card[] = [...state.drawPile];
  state.players.forEach((p, i) => {
    if (i !== me) unseen.push(...p.hand);
    unseen.push(...p.faceDown);
  });
  // Sorted first, so the deal depends only on which cards are unseen,
  // never on where they really are.
  unseen.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const deck = shuffle(unseen);
  const deal = (n: number) => deck.splice(deck.length - n, n);
  const players = state.players.map((p, i) => ({
    ...p,
    botStyle: 'strategic' as BotStyle,
    hand: i === me ? p.hand : deal(p.hand.length),
    faceDown: deal(p.faceDown.length),
  }));
  return { ...state, players, drawPile: deck };
}

/** Play a world out with strategic bots: 1 if `me` comes out on top, else 0. */
function playout(start: GameState, me: number): number {
  let g = start;
  for (let t = 0; g.phase === 'playing' && t < SEARCH.maxTurns; t++) {
    const idx = g.currentPlayerIndex;
    const a = decideBotAction(g, idx);
    const next = a.type === 'pickup'
      ? pickupPile(g, idx).state
      : playCards(g, idx, a.cardIds, { swapTargetId: a.swapTargetId }).state;
    if (next === g) break;
    g = next;
  }
  if (g.phase !== 'gameOver') return 1 / g.players.filter((p) => !p.isFinished).length;
  if (g.lastManStanding) return g.shitheadId === me ? 0 : 1;
  return g.winnerId === me ? 1 : 0;
}

// ─── The swap and the swap joker ────────────────────────────────────────────

export interface BotSwap {
  handCardId: string;
  faceUpCardId: string;
}

/**
 * The pre-game swap: which hand cards a bot trades for face-up cards.
 *
 * Face-up cards are played late, when there's no hand left to fall back on,
 * so a bot puts its three most useful cards there (by cardWorth, under its
 * own seat's rules) and keeps the rest in hand. The one exception is the
 * swap joker: played from face-up, with an empty hand, it would trade
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

/**
 * Steal the smallest hand at the table (ties go to the earliest seat). But
 * if the bot's own hand will be empty once it plays `cardIds` and draws,
 * it doesn't hand that empty hand to someone it would put out (a player
 * whose hand is all they have left), unless there's no one else.
 */
function pickSwapTarget(
  state: GameState,
  playerIdx: number,
  cardIds: readonly string[],
): number | undefined {
  const targets = swapTargets(state, playerIdx);
  if (targets.length === 0) return undefined;
  const me = state.players[playerIdx];
  const kept = me.hand.filter((c) => !cardIds.includes(c.id)).length;
  const drawn = Math.min(Math.max(0, 3 - kept), state.drawPile.length); // draws back up to 3
  const givingNothing = kept + drawn === 0;
  const putsOut = (id: number) =>
    givingNothing && state.players[id].faceUp.length === 0 && state.players[id].faceDown.length === 0;
  const safe = targets.filter((id) => !putsOut(id));
  return (safe.length > 0 ? safe : targets).reduce((best, id) =>
    state.players[id].hand.length < state.players[best].hand.length ? id : best,
  );
}
