/**
 * SHED Rules Engine
 * Pure TypeScript — no UI dependencies.
 * All functions are immutable: they return new state objects.
 *
 * Power card summary (from Elder Jake):
 *   HIGH TIER (always playable): 2 (resets pile), 8 (invisible/skip)
 *   LOW TIER (situational):      7 (force next ≤7), 10 (burn pile)
 *   FOUR-OF-A-KIND:              burns pile (8s don't break the sequence)
 */

import { ActivePile, Card, GameState, Player, PlayResult, Rank } from './types';
import { createDeck, dealCards, shuffleDeck } from './deck';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Numeric value for "meets or beats" comparisons. */
export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,  '3': 3,  '4': 4,  '5': 5,  '6': 6,  '7': 7,  '8': 8,
  '9': 9,  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

/**
 * Power cards are excluded from the "who goes first" lowest-card check.
 * Source: the rules state non-power cards begin the game.
 */
const POWER_RANKS = new Set<Rank>(['2', '7', '8', '10']);

// ─── Pile helpers ─────────────────────────────────────────────────────────────

/**
 * The "effective top card" is the topmost non-8 card in the play pile.
 * 8 is invisible — it doesn't change the play value beneath it.
 * Returns null if the pile is empty or contains only 8s.
 */
export function getEffectiveTopCard(pile: Card[]): Card | null {
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank !== '8') return pile[i];
  }
  return null;
}

/**
 * Count consecutive same-rank cards from the top of the pile, skipping 8s.
 * Used for four-of-a-kind burn detection.
 * Example: [5, 5, 8, 5] → { rank: '5', count: 3 }
 */
function countTopConsecutive(pile: Card[]): { rank: Rank; count: number } | null {
  const effective = getEffectiveTopCard(pile);
  if (!effective) return null;

  let count = 0;
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank === '8') continue;        // 8 is transparent
    if (pile[i].rank === effective.rank) count++;
    else break;
  }
  return { rank: effective.rank, count };
}

// ─── Playability ──────────────────────────────────────────────────────────────

/**
 * Can a single card be legally placed on the current play pile?
 *
 * Rules:
 *  • 2 — always playable (high-tier power, resets)
 *  • 8 — always playable (high-tier power, invisible; passes 7 to next player per Jake)
 *  • 10 — burns the pile, but CANNOT be played on a 7
 *  • 7 — forces next player to play ≤7; cannot be played on anything higher than 7
 *         (except on an 8, since 8 is invisible)
 *  • All others — must meet or beat the effective top card
 */
export function canPlayCard(card: Card, pile: Card[]): boolean {
  if (card.rank === '2' || card.rank === '8') return true;

  const effective = getEffectiveTopCard(pile);
  const sevenOnTop = effective?.rank === '7';

  // 10 cannot be played on a 7
  if (card.rank === '10' && sevenOnTop) return false;

  // Empty pile (or pile is all-8s): anything goes
  if (!effective) return true;

  // 7-restriction zone: next card must be ≤7
  if (sevenOnTop) {
    return RANK_VALUES[card.rank] <= RANK_VALUES['7'];
  }

  // 7 itself can only be played on ≤7 (but 8 beneath counts as transparent,
  // so we already handled effective top correctly)
  if (card.rank === '7') {
    return RANK_VALUES[effective.rank] <= RANK_VALUES['7'];
  }

  // Standard meets-or-beats
  return RANK_VALUES[card.rank] >= RANK_VALUES[effective.rank];
}

/** Validate a multi-card play (all same rank, and that rank is legal). */
export function canPlayCards(cards: Card[], pile: Card[]): boolean {
  if (cards.length === 0) return false;
  const rank = cards[0].rank;
  if (!cards.every(c => c.rank === rank)) return false;
  return canPlayCard(cards[0], pile);
}

// ─── Burn detection ───────────────────────────────────────────────────────────

/**
 * Should the pile burn after the latest play?
 *
 * Burns when:
 *  1. The most-recently played card is a 10 (10 always burns immediately)
 *  2. Four cards of the same rank appear consecutively from the top (8s transparent)
 */
export function checkForBurn(pile: Card[]): boolean {
  if (pile.length === 0) return false;

  const top = pile[pile.length - 1];
  if (top.rank === '10') return true;

  const consecutive = countTopConsecutive(pile);
  return consecutive !== null && consecutive.count >= 4;
}

// ─── Player phase ─────────────────────────────────────────────────────────────

/**
 * Which pile should this player play from?
 * Priority: hand → faceUp → faceDown → finished
 * (A player returns to 'hand' if they pick up the pile during mid/late game.)
 */
export function getActivePile(player: Player): ActivePile {
  if (player.hasFinished) return 'finished';
  if (player.hand.length > 0) return 'hand';
  if (player.faceUpCards.length > 0) return 'faceUp';
  if (player.faceDownCards.length > 0) return 'faceDown';
  return 'finished';
}

// ─── Start-of-game helpers ────────────────────────────────────────────────────

/**
 * Find which player goes first and what rank they must open with.
 * Rule: the player with the lowest non-power card in their hand.
 * Tie-break: whoever is earliest in clockwise order (lowest index, as index 0 = left of dealer).
 */
export function findStartingPlayer(players: Player[]): {
  playerIndex: number;
  mustPlayRank: Rank | null;
} {
  let globalMin = Infinity;

  for (const p of players) {
    for (const c of p.hand) {
      if (!POWER_RANKS.has(c.rank)) {
        globalMin = Math.min(globalMin, RANK_VALUES[c.rank]);
      }
    }
  }

  // Extremely unlikely edge case: all hand cards are power cards
  if (globalMin === Infinity) return { playerIndex: 0, mustPlayRank: null };

  for (let i = 0; i < players.length; i++) {
    const match = players[i].hand.find(
      c => !POWER_RANKS.has(c.rank) && RANK_VALUES[c.rank] === globalMin,
    );
    if (match) return { playerIndex: i, mustPlayRank: match.rank };
  }

  return { playerIndex: 0, mustPlayRank: null };
}

// ─── Game creation ────────────────────────────────────────────────────────────

export function createGame(playerNames: string[]): GameState {
  const deck = shuffleDeck(createDeck());
  const { playerHands, playerFaceUpCards, playerFaceDownCards, remainingDeck } = dealCards(
    deck,
    playerNames.length,
  );

  const players: Player[] = playerNames.map((name, i) => ({
    id: `player-${i}`,
    name,
    hand: playerHands[i],
    faceUpCards: playerFaceUpCards[i],
    faceDownCards: playerFaceDownCards[i],
    hasFinished: false,
    finishPosition: null,
  }));

  return {
    players,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    drawPile: remainingDeck,
    playPile: [],
    gamePhase: 'swapping',
    swapPhasePlayerIndex: 0,
    finishedCount: 0,
    firstTurnConstraint: null,
    isFirstTurn: true,
    lastAction: 'Cards dealt. Players may now swap hand cards with their face-up cards.',
  };
}

// ─── Swap phase ───────────────────────────────────────────────────────────────

/**
 * Exchange one hand card for one face-up card during the pre-game swap phase.
 * Both players and card IDs must be valid; silently no-ops otherwise.
 */
export function swapCard(
  state: GameState,
  playerIndex: number,
  handCardId: string,
  faceUpCardId: string,
): GameState {
  const p = state.players[playerIndex];
  const fromHand = p.hand.find(c => c.id === handCardId);
  const fromFaceUp = p.faceUpCards.find(c => c.id === faceUpCardId);
  if (!fromHand || !fromFaceUp) return state;

  const newPlayers = state.players.map((player, i) => {
    if (i !== playerIndex) return player;
    return {
      ...player,
      hand: player.hand.map(c => (c.id === handCardId ? fromFaceUp : c)),
      faceUpCards: player.faceUpCards.map(c => (c.id === faceUpCardId ? fromHand : c)),
    };
  });

  return { ...state, players: newPlayers };
}

/**
 * Advance the swap phase to the next player, or transition to 'playing' when done.
 */
export function doneSwapping(state: GameState): GameState {
  const next = state.swapPhasePlayerIndex + 1;

  if (next < state.players.length) {
    return { ...state, swapPhasePlayerIndex: next };
  }

  // All players done — determine starting player and begin
  const { playerIndex, mustPlayRank } = findStartingPlayer(state.players);
  const starterName = state.players[playerIndex].name;

  return {
    ...state,
    gamePhase: 'playing',
    currentPlayerIndex: playerIndex,
    firstTurnConstraint: mustPlayRank,
    isFirstTurn: true,
    lastAction: mustPlayRank
      ? `${starterName} goes first (must open with a ${mustPlayRank}).`
      : `${starterName} goes first.`,
  };
}

// ─── Draw helper ──────────────────────────────────────────────────────────────

/** Refill a player's hand to 3 cards from the draw pile (if available). */
function drawUpToThree(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex];
  if (state.drawPile.length === 0 || player.hand.length >= 3) return state;

  const drawPile = [...state.drawPile];
  const hand = [...player.hand];

  while (hand.length < 3 && drawPile.length > 0) {
    hand.push(drawPile.pop()!);
  }

  return {
    ...state,
    drawPile,
    players: state.players.map((p, i) => (i === playerIndex ? { ...p, hand } : p)),
  };
}

// ─── Turn helpers ─────────────────────────────────────────────────────────────

/** Advance currentPlayerIndex, skipping players who have finished. */
function nextPlayerIndex(state: GameState): number {
  const n = state.players.length;
  let idx = (state.currentPlayerIndex + 1) % n;
  let guard = 0;
  while (state.players[idx].hasFinished && guard < n) {
    idx = (idx + 1) % n;
    guard++;
  }
  return idx;
}

/** Mark a player as finished and check if the game should end. */
function markFinished(state: GameState, playerIndex: number): GameState {
  const pos = state.finishedCount + 1;
  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, hasFinished: true, finishPosition: pos } : p,
  );
  const finishedCount = state.finishedCount + 1;
  const remaining = players.filter(p => !p.hasFinished).length;
  const gamePhase = remaining <= 1 ? 'finished' : state.gamePhase;

  return { ...state, players, finishedCount, gamePhase };
}

function cardLabel(c: Card): string {
  const suit = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[c.suit];
  return `${c.rank}${suit}`;
}

// ─── Core actions ─────────────────────────────────────────────────────────────

/**
 * Play one or more same-rank cards from hand or face-up pile.
 * For face-down cards, use `playFaceDownCard` instead.
 */
export function playCards(
  state: GameState,
  playerIndex: number,
  cardIds: string[],
): { newState: GameState; result: PlayResult } {
  const fail = (message: string): { newState: GameState; result: PlayResult } => ({
    newState: state,
    result: { success: false, burnOccurred: false, playerFinished: false, goAgain: false, message },
  });

  const player = state.players[playerIndex];
  const source = getActivePile(player);

  if (source === 'finished') return fail('Player has already finished.');
  if (source === 'faceDown') return fail('Use playFaceDownCard() for face-down cards.');
  if (cardIds.length === 0) return fail('No cards selected.');

  const pool = source === 'hand' ? player.hand : player.faceUpCards;
  const cards = cardIds.map(id => pool.find(c => c.id === id)).filter(Boolean) as Card[];

  if (cards.length !== cardIds.length) return fail('One or more cards not found in player pile.');
  if (cards.some(c => c.rank !== cards[0].rank)) return fail('All played cards must share the same rank.');

  // First-turn constraint
  if (state.isFirstTurn && state.firstTurnConstraint && cards[0].rank !== state.firstTurnConstraint) {
    return fail(`First turn: must open with a ${state.firstTurnConstraint}.`);
  }

  if (!canPlayCards(cards, state.playPile)) {
    return fail(`Cannot play ${cards.map(cardLabel).join(', ')} on ${cardLabel(getEffectiveTopCard(state.playPile) ?? cards[0]) || 'empty pile'}.`);
  }

  // Apply the play
  const newPlayPile = [...state.playPile, ...cards];
  const idSet = new Set(cardIds);
  let newState: GameState = {
    ...state,
    isFirstTurn: false,
    playPile: newPlayPile,
    players: state.players.map((p, i) => {
      if (i !== playerIndex) return p;
      if (source === 'hand') return { ...p, hand: p.hand.filter(c => !idSet.has(c.id)) };
      return { ...p, faceUpCards: p.faceUpCards.filter(c => !idSet.has(c.id)) };
    }),
  };

  // Refill hand from draw pile (early-game rule)
  if (source === 'hand') newState = drawUpToThree(newState, playerIndex);

  const burned = checkForBurn(newPlayPile);
  if (burned) newState = { ...newState, playPile: [] };

  // Check if the player has cleared all their cards
  const updatedPlayer = newState.players[playerIndex];
  const playerFinished =
    updatedPlayer.hand.length === 0 &&
    updatedPlayer.faceUpCards.length === 0 &&
    updatedPlayer.faceDownCards.length === 0;

  if (playerFinished) newState = markFinished(newState, playerIndex);

  const label = cards.map(cardLabel).join(', ');
  let message: string;
  let goAgain = false;

  if (burned && !playerFinished) {
    message = `${player.name} played ${label} — 🔥 PILE BURNED! ${player.name} goes again.`;
    goAgain = true;
    // Stay on current player
  } else if (playerFinished) {
    const pos = newState.players[playerIndex].finishPosition;
    message = `${player.name} played ${label} and finished in position ${pos}!`;
    if (newState.gamePhase !== 'finished') {
      newState = { ...newState, currentPlayerIndex: nextPlayerIndex(newState) };
    }
  } else {
    message = `${player.name} played ${label}.`;
    newState = { ...newState, currentPlayerIndex: nextPlayerIndex(newState) };
  }

  return {
    newState: { ...newState, lastAction: message },
    result: { success: true, burnOccurred: burned, playerFinished, goAgain, message },
  };
}

/**
 * Reveal and attempt to play one face-down card (late-game).
 * The player selects a card without knowing its value.
 * If it can't be played, the player picks up the pile + the revealed card.
 */
export function playFaceDownCard(
  state: GameState,
  playerIndex: number,
  cardId: string,
): { newState: GameState; result: PlayResult } {
  const fail = (message: string): { newState: GameState; result: PlayResult } => ({
    newState: state,
    result: { success: false, burnOccurred: false, playerFinished: false, goAgain: false, message },
  });

  const player = state.players[playerIndex];
  if (getActivePile(player) !== 'faceDown') return fail('Not in the late-game phase.');

  const card = player.faceDownCards.find(c => c.id === cardId);
  if (!card) return fail('Card not found.');

  const newFaceDown = player.faceDownCards.filter(c => c.id !== cardId);

  // Card cannot be played → pick up pile + card
  if (!canPlayCard(card, state.playPile)) {
    const newHand = [...state.playPile, card];
    const players = state.players.map((p, i) =>
      i === playerIndex ? { ...p, hand: newHand, faceDownCards: newFaceDown } : p,
    );
    const message = `${player.name} flipped ${cardLabel(card)} — can't play it! Picked up ${newHand.length} cards.`;

    return {
      newState: {
        ...state,
        players,
        playPile: [],
        isFirstTurn: false,
        currentPlayerIndex: nextPlayerIndex({ ...state, players }),
        lastAction: message,
      },
      result: { success: false, burnOccurred: false, playerFinished: false, goAgain: false, message },
    };
  }

  // Card is playable
  const newPlayPile = [...state.playPile, card];
  let newState: GameState = {
    ...state,
    isFirstTurn: false,
    playPile: newPlayPile,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, faceDownCards: newFaceDown } : p,
    ),
  };

  const burned = checkForBurn(newPlayPile);
  if (burned) newState = { ...newState, playPile: [] };

  const updatedPlayer = newState.players[playerIndex];
  const playerFinished =
    updatedPlayer.hand.length === 0 &&
    updatedPlayer.faceUpCards.length === 0 &&
    updatedPlayer.faceDownCards.length === 0;

  if (playerFinished) newState = markFinished(newState, playerIndex);

  let message: string;
  let goAgain = false;

  if (burned && !playerFinished) {
    message = `${player.name} flipped ${cardLabel(card)} — 🔥 PILE BURNED! Goes again.`;
    goAgain = true;
  } else if (playerFinished) {
    const pos = newState.players[playerIndex].finishPosition;
    message = `${player.name} flipped ${cardLabel(card)} and finished in position ${pos}!`;
    if (newState.gamePhase !== 'finished') {
      newState = { ...newState, currentPlayerIndex: nextPlayerIndex(newState) };
    }
  } else {
    message = `${player.name} flipped ${cardLabel(card)} — played!`;
    newState = { ...newState, currentPlayerIndex: nextPlayerIndex(newState) };
  }

  return {
    newState: { ...newState, lastAction: message },
    result: { success: true, burnOccurred: burned, playerFinished, goAgain, message },
  };
}

/**
 * Pick up the entire play pile (forced when no legal play, or voluntary).
 * Always ends the current player's turn.
 */
export function pickUpPile(state: GameState, playerIndex: number): GameState {
  if (state.playPile.length === 0) return state;

  const player = state.players[playerIndex];
  const newHand = [...player.hand, ...state.playPile];
  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, hand: newHand } : p,
  );
  const newState = { ...state, players, playPile: [], isFirstTurn: false };
  const message = `${player.name} picked up the pile (${state.playPile.length} cards). Their hand now has ${newHand.length}.`;

  return {
    ...newState,
    currentPlayerIndex: nextPlayerIndex(newState),
    lastAction: message,
  };
}

// ─── UI-query helpers ─────────────────────────────────────────────────────────

/**
 * Returns the set of card IDs the current player can legally play right now.
 * (Does not include face-down cards — those are always "tappable" but unknown.)
 */
export function getPlayableCardIds(state: GameState, playerIndex: number): Set<string> {
  const player = state.players[playerIndex];
  const source = getActivePile(player);
  const playable = new Set<string>();

  if (source === 'finished' || source === 'faceDown') return playable;

  const pool = source === 'hand' ? player.hand : player.faceUpCards;

  for (const card of pool) {
    if (state.isFirstTurn && state.firstTurnConstraint) {
      if (card.rank === state.firstTurnConstraint) playable.add(card.id);
    } else if (canPlayCard(card, state.playPile)) {
      playable.add(card.id);
    }
  }

  return playable;
}

/** True if the player has at least one legal play (or is in late-game with face-down cards). */
export function hasPlayableCards(state: GameState, playerIndex: number): boolean {
  const source = getActivePile(state.players[playerIndex]);
  if (source === 'faceDown') return true; // always "playable" (unknown reveal)
  return getPlayableCardIds(state, playerIndex).size > 0;
}
