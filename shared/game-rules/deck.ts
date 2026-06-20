import { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Create an ordered 52-card deck (no jokers). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle — returns a new shuffled array. */
export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export interface DealResult {
  playerHands: Card[][];
  playerFaceUpCards: Card[][];
  playerFaceDownCards: Card[][];
  remainingDeck: Card[];
}

/**
 * Deal cards to `playerCount` players following the SHED dealing order:
 *  1. 3 face-down cards each (one at a time, clockwise)
 *  2. 3 face-up cards each (directly on top of the face-down grid)
 *  3. 3 hand cards each
 *
 * Uses pop() off the end of the deck, so deal clockwise = consume from end.
 */
export function dealCards(deck: Card[], playerCount: number): DealResult {
  const d = [...deck];

  const faceDown: Card[][] = Array.from({ length: playerCount }, () => []);
  const faceUp: Card[][] = Array.from({ length: playerCount }, () => []);
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  // One card at a time, per person, clockwise
  for (let round = 0; round < 3; round++) {
    for (let p = 0; p < playerCount; p++) faceDown[p].push(d.pop()!);
  }
  for (let round = 0; round < 3; round++) {
    for (let p = 0; p < playerCount; p++) faceUp[p].push(d.pop()!);
  }
  for (let round = 0; round < 3; round++) {
    for (let p = 0; p < playerCount; p++) hands[p].push(d.pop()!);
  }

  return {
    playerHands: hands,
    playerFaceUpCards: faceUp,
    playerFaceDownCards: faceDown,
    remainingDeck: d,
  };
}
