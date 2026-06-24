import {
  Card,
  GameEvent,
  GameState,
  LogEntry,
  PlayResult,
  Player,
  PlayerConfig,
  PlaySource,
  Rank,
  RuleConfig,
} from './types';
import { createDeck, shuffle, rankLabel } from './cards';
import {
  canPlayCardOnTop,
  canPlayMultiple,
  checkFourOfAKindBurn,
  checkTripleTransparentBurn,
  DEFAULT_RULES,
  findStartingPlayer,
  getEffectiveTopCard,
} from './rules';

const HAND_SIZE = 3;
const FACE_UP_SIZE = 3;
const FACE_DOWN_SIZE = 3;

let _logSeq = 0;
function entry(text: string, playerId?: number): LogEntry {
  return { id: _logSeq++, text, playerId };
}

/**
 * Build a fresh game from player configs and an optional rule config.
 * Deals 3-3-3 per the rules: face-down, face-up, then hand.
 * After this the game is in 'swap' phase.
 */
export function createGame(
  playerConfigs: PlayerConfig[],
  ruleConfig: RuleConfig = DEFAULT_RULES,
): GameState {
  if (playerConfigs.length < 2 || playerConfigs.length > 6) {
    throw new Error('SHED supports 2–6 players');
  }

  // Explicitly calculate the deck configuration based on num players
  const deckCount = playerConfigs.length > 4 ? 2 : 1;
  const deck = shuffle(createDeck(deckCount));

  const players: Player[] = playerConfigs.map((cfg, i) => ({
    id: i,
    name: cfg.name,
    isBot: cfg.isBot,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
  }));

  // Deal one card at a time, clockwise, per the rules.
  for (let r = 0; r < FACE_DOWN_SIZE; r++) {
    for (const p of players) p.faceDown.push(deck.pop()!);
  }
  for (let r = 0; r < FACE_UP_SIZE; r++) {
    for (const p of players) p.faceUp.push(deck.pop()!);
  }
  for (let r = 0; r < HAND_SIZE; r++) {
    for (const p of players) p.hand.push(deck.pop()!);
  }

  return {
    players,
    deckCount,
    drawPile: deck,
    playPile: [],
    burnedPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    phase: 'swap',
    swapsComplete: players.map(() => false),
    startingPlayerIndex: 0,
    pendingExtraTurn: false,
    log: [entry('Dealt. Swap any hand cards with face-up cards before play.')],
    ruleConfig,
    lastManStanding: ruleConfig.lastManStanding,
    winnerId: null,
    shitheadId: null,
  };
}

/** Swap one hand card with one face-up card (during swap phase). */
export function swapCards(
  state: GameState,
  playerIdx: number,
  handCardId: string,
  faceUpCardId: string,
): GameState {
  if (state.phase !== 'swap') return state;
  const player = state.players[playerIdx];
  const hi = player.hand.findIndex(c => c.id === handCardId);
  const fi = player.faceUp.findIndex(c => c.id === faceUpCardId);
  if (hi === -1 || fi === -1) return state;

  const players = state.players.map((p, i) => {
    if (i !== playerIdx) return p;
    const hand = [...p.hand];
    const faceUp = [...p.faceUp];
    [hand[hi], faceUp[fi]] = [faceUp[fi], hand[hi]];
    return { ...p, hand, faceUp };
  });
  return { ...state, players };
}

/** Mark a player's swap turn done; advance to playing once everyone is ready. */
export function finishSwap(state: GameState, playerIdx: number): GameState {
  if (state.phase !== 'swap') return state;
  const swapsComplete = [...state.swapsComplete];
  swapsComplete[playerIdx] = true;
  if (!swapsComplete.every(Boolean)) {
    return { ...state, swapsComplete };
  }
  const starter = findStartingPlayer(state.players, state.ruleConfig);
  return {
    ...state,
    swapsComplete,
    phase: 'playing',
    currentPlayerIndex: starter,
    startingPlayerIndex: starter,
    log: [
      ...state.log,
      entry(
        `${state.players[starter].name} starts (lowest non-power card).`,
        starter,
      ),
    ],
  };
}

/**
 * A player's current "source" is implied by what cards they have:
 *   - hand non-empty → play from hand
 *   - else face-up non-empty → mid-game phase
 *   - else face-down non-empty → late-game phase
 *   - else → finished
 */
export function getPlaySource(player: Player): PlaySource | null {
  if (player.hand.length > 0) return 'hand';
  if (player.faceUp.length > 0) return 'faceUp';
  if (player.faceDown.length > 0) return 'faceDown';
  return null;
}

/** Get card IDs from the active source that could legally be played alone. */
export function getPlayableCardIds(state: GameState, playerIdx: number): string[] {
  const player = state.players[playerIdx];
  const source = getPlaySource(player);
  if (source === null) return [];
  // Face-down is blind — any one of them may be chosen; legality is post-reveal.
  if (source === 'faceDown') return player.faceDown.map(c => c.id);
  const cards = source === 'hand' ? player.hand : player.faceUp;
  const top = getEffectiveTopCard(state.playPile, state.ruleConfig);
  return cards.filter(c => canPlayCardOnTop(c, top, state.ruleConfig)).map(c => c.id);
}

/**
 * Returns true if the player has no playable card from their current source.
 * Face-down is always considered "playable" (the player commits to flip).
 *
 * When allowVoluntaryPickup is true, hasPlayableMove still reports accurately
 * — the UI uses it to decide whether to FORCE pickup. Voluntary pickup is
 * handled separately by the UI offering a "pick up" button at all times.
 */
export function hasPlayableMove(state: GameState, playerIdx: number): boolean {
  const player = state.players[playerIdx];
  const source = getPlaySource(player);
  if (source === null) return false;
  if (source === 'faceDown') return true;
  return getPlayableCardIds(state, playerIdx).length > 0;
}

/**
 * Main play action. `cardIds` must all be from the same source and same rank.
 *
 * For face-down: pass a single card ID. If the flipped card can't beat the
 * top, the player picks up the pile (with that card added) and the turn ends.
 *
 * Returns the new state plus a list of events the UI can use to animate /
 * narrate what happened.
 */
export function playCards(
  state: GameState,
  playerIdx: number,
  cardIds: string[],
): PlayResult {
  if (state.phase !== 'playing') return { state, events: [] };
  if (state.currentPlayerIndex !== playerIdx) return { state, events: [] };

  const cfg = state.ruleConfig;
  const player = state.players[playerIdx];
  const source = getPlaySource(player);
  if (source === null) return { state, events: [] };

  const sourceArr =
    source === 'hand' ? player.hand
    : source === 'faceUp' ? player.faceUp
    : player.faceDown;

  const cards = cardIds
    .map(id => sourceArr.find(c => c.id === id))
    .filter((c): c is Card => Boolean(c));
  if (cards.length === 0) return { state, events: [] };

  const top = getEffectiveTopCard(state.playPile, cfg);

  // ─── Face-down special path ─────────────────────────────────────────────
  if (source === 'faceDown') {
    const card = cards[0]; // face-down is always single-card
    const remainingFaceDown = player.faceDown.filter(c => c.id !== card.id);

    if (!canPlayCardOnTop(card, top, cfg)) {
      // Failed flip: pick up pile + this card.
      const newHand = [...player.hand, card, ...state.playPile];
      const players = state.players.map((p, i) =>
        i === playerIdx ? { ...p, hand: newHand, faceDown: remainingFaceDown } : p,
      );
      const events: GameEvent[] = [
        { type: 'faceDownFlipFailed', playerId: playerIdx, card },
        { type: 'pileTakenUp', playerId: playerIdx, cardCount: state.playPile.length + 1 },
      ];
      const log: LogEntry[] = [
        ...state.log,
        entry(
          `${player.name} flipped ${rankLabel(card.rank)} — can't beat ${top ? rankLabel(top.rank) : 'pile'}, picks up.`,
          playerIdx,
        ),
      ];
      return {
        state: advanceTurn({
          ...state,
          players,
          playPile: [],
          log,
          pendingExtraTurn: false,
        }),
        events,
      };
    }
    // Successful flip falls through to normal play logic below.
  } else {
    // Hand / face-up: must be valid multi-card play
    const check = canPlayMultiple(cards, top, cfg);
    if (!check.ok) return { state, events: [] };
  }

  // ─── Normal play (hand, face-up, or successful face-down flip) ──────────
  const cardIdSet = new Set(cards.map(c => c.id));
  const newSourceArr = sourceArr.filter(c => !cardIdSet.has(c.id));
  let newPlayPile: Card[] = [...cards, ...state.playPile]; // newest on top

  let players: Player[] = state.players.map((p, i) => {
    if (i !== playerIdx) return p;
    if (source === 'hand') return { ...p, hand: newSourceArr };
    if (source === 'faceUp') return { ...p, faceUp: newSourceArr };
    return { ...p, faceDown: newSourceArr };
  });

  const events: GameEvent[] = [
    { type: 'cardsPlayed', playerId: playerIdx, cards, source },
  ];
  const rank = cards[0].rank;
  const log: LogEntry[] = [
    ...state.log,
    entry(
      `${player.name} played ${cards.length > 1 ? cards.length + '× ' : ''}${rankLabel(rank)}.`,
      playerIdx,
    ),
  ];

  // ─── Reverse checks ────────────────────────────────────────────────────
  let direction = state.direction;
  let reversed = false;

  // reverseRank: any time this rank is played, direction reverses
  if (cfg.reverseRank !== null && rank === cfg.reverseRank) {
    direction = direction === 1 ? -1 : 1;
    reversed = true;
    events.push({ type: 'directionReversed', playerId: playerIdx });
    log.push(entry('Direction reversed!', playerIdx));
  }

  // sixNineReverse: playing a 9 on a 6 reverses direction (skip if reverseRank already handled it)
  if (!reversed && cfg.sixNineReverse && rank === 9 && top !== null && top.rank === 6) {
    direction = direction === 1 ? -1 : 1;
    events.push({ type: 'directionReversed', playerId: playerIdx });
    log.push(entry('9 on 6 — direction reversed!', playerIdx));
  }

  // ─── Burn checks ───────────────────────────────────────────────────────
  let burned = false;
  let burnReason: 'ten' | 'fourOfKind' | 'tripleTransparent' | null = null;

  if (rank === cfg.burnRank) {
    burned = true;
    burnReason = 'ten';
  } else if (checkFourOfAKindBurn(newPlayPile, cfg)) {
    burned = true;
    burnReason = 'fourOfKind';
  } else if (checkTripleTransparentBurn(newPlayPile, cfg)) {
    burned = true;
    burnReason = 'tripleTransparent';
  }

  let burnedPile = state.burnedPile;
  let pendingExtraTurn = false;
  if (burned) {
    burnedPile = [...state.burnedPile, ...newPlayPile];
    newPlayPile = [];
    pendingExtraTurn = true;
    events.push({ type: 'pileBurned', reason: burnReason! });
    log.push(entry(
      burnReason === 'ten'
        ? `Burned by ${rankLabel(cfg.burnRank)}!`
        : burnReason === 'tripleTransparent'
        ? `Triple ${rankLabel(cfg.transparentRank)}s — burned!`
        : 'Four of a kind — burned!',
      playerIdx,
    ));
    events.push({ type: 'extraTurn', playerId: playerIdx });
  }

  // Refill hand to 3 from draw pile, but only when playing from hand
  // and only while the draw pile has cards.
  let drawPile = state.drawPile;
  if (source === 'hand') {
    const current = players[playerIdx];
    const needed = Math.max(0, HAND_SIZE - current.hand.length);
    if (needed > 0 && drawPile.length > 0) {
      const drawCount = Math.min(needed, drawPile.length);
      const drawn = drawPile.slice(-drawCount);
      drawPile = drawPile.slice(0, drawPile.length - drawCount);
      players = players.map((p, i) =>
        i === playerIdx ? { ...p, hand: [...p.hand, ...drawn] } : p,
      );
      events.push({ type: 'cardsDrawn', playerId: playerIdx, count: drawCount });
    }
  }

  // Did this player just go out (all piles empty)?
  const after = players[playerIdx];
  if (after.hand.length === 0 && after.faceUp.length === 0 && after.faceDown.length === 0) {
    players = players.map((p, i) => (i === playerIdx ? { ...p, isFinished: true } : p));
    events.push({ type: 'playerFinished', playerId: playerIdx });
    log.push(entry(`${player.name} is out!`, playerIdx));
  }

  let phase: GameState['phase'] = state.phase;
  let winnerId = state.winnerId;
  let shitheadId = state.shitheadId;

  // First player to finish wins; mark winner so we never overwrite.
  if (winnerId === null && events.some(e => e.type === 'playerFinished')) {
    winnerId = playerIdx;
  }

  const remaining = players.filter(p => !p.isFinished);

  if (state.lastManStanding) {
    if (remaining.length <= 1) {
      phase = 'gameOver';
      shitheadId = remaining[0]?.id ?? null;
      events.push({ type: 'gameOver', winnerId: winnerId!, shitheadId });
      log.push(entry(
        remaining[0]
          ? `Game over — ${remaining[0].name} is the Shithead.`
          : 'Game over.',
      ));
    }
  } else {
    if (winnerId !== null && events.some(e => e.type === 'playerFinished' && e.playerId === winnerId)) {
      phase = 'gameOver';
      shitheadId = null;
      events.push({ type: 'gameOver', winnerId, shitheadId });
      log.push(entry(`Game over — ${players[winnerId].name} wins!`));
    }
  }

  const next: GameState = {
    ...state,
    players,
    playPile: newPlayPile,
    burnedPile,
    drawPile,
    direction,
    pendingExtraTurn,
    log,
    phase,
    winnerId,
    shitheadId,
  };

  if (phase === 'gameOver') return { state: next, events };
  return { state: advanceTurn(next), events };
}

/** Voluntarily (or forced) pick up the entire play pile and end turn. */
export function pickupPile(state: GameState, playerIdx: number): PlayResult {
  if (state.phase !== 'playing') return { state, events: [] };
  if (state.currentPlayerIndex !== playerIdx) return { state, events: [] };
  if (state.playPile.length === 0) return { state, events: [] };

  const player = state.players[playerIdx];
  const pickedUp = state.playPile;
  const players = state.players.map((p, i) =>
    i === playerIdx ? { ...p, hand: [...p.hand, ...pickedUp] } : p,
  );
  const events: GameEvent[] = [
    { type: 'pileTakenUp', playerId: playerIdx, cardCount: pickedUp.length },
  ];
  const log: LogEntry[] = [
    ...state.log,
    entry(`${player.name} picks up the pile (${pickedUp.length} cards).`, playerIdx),
  ];
  return {
    state: advanceTurn({
      ...state,
      players,
      playPile: [],
      log,
      pendingExtraTurn: false,
    }),
    events,
  };
}

/**
 * Advance to the next non-finished player, respecting pendingExtraTurn
 * (used after burns — same player plays again).
 */
function advanceTurn(state: GameState): GameState {
  if (state.phase === 'gameOver') return state;

  if (state.pendingExtraTurn) {
    const current = state.players[state.currentPlayerIndex];
    if (!current.isFinished) {
      return { ...state, pendingExtraTurn: false };
    }
  }

  let next = state.currentPlayerIndex;
  for (let attempt = 0; attempt < state.players.length; attempt++) {
    next = (next + state.direction + state.players.length) % state.players.length;
    if (!state.players[next].isFinished) {
      return { ...state, currentPlayerIndex: next, pendingExtraTurn: false };
    }
  }
  return { ...state, pendingExtraTurn: false };
}
