// ─── Card primitives ────────────────────────────────────────────────────────

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  /** Globally unique ID, e.g. "10-hearts" */
  id: string;
  rank: Rank;
  suit: Suit;
}

// ─── Player ─────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  /** Early-game hand (also holds picked-up pile during mid/late game) */
  hand: Card[];
  /** Mid-game: 3 face-up cards visible to all */
  faceUpCards: Card[];
  /** Late-game: 3 face-down cards no one may look at */
  faceDownCards: Card[];
  hasFinished: boolean;
  /** 1 = first to finish (winner), 2 = second, etc. */
  finishPosition: number | null;
}

/**
 * Which pile a player is currently playing from.
 * Derived from card counts; never stored explicitly.
 */
export type ActivePile = 'hand' | 'faceUp' | 'faceDown' | 'finished';

// ─── Game state ──────────────────────────────────────────────────────────────

export type GamePhase = 'swapping' | 'playing' | 'finished';

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  /** Index of the dealer (player 0 is left of dealer for start-player purposes) */
  dealerIndex: number;
  drawPile: Card[];
  /** The central playing pile */
  playPile: Card[];
  gamePhase: GamePhase;
  /** During 'swapping', tracks whose swap turn it is */
  swapPhasePlayerIndex: number;
  /** Count of players who have finished (used for finish positions) */
  finishedCount: number;
  /**
   * The rank the starting player MUST play on the very first turn.
   * Null if there are no non-power cards in any hand (extremely rare edge case).
   */
  firstTurnConstraint: Rank | null;
  isFirstTurn: boolean;
  /** Human-readable description of the last action (for log/display) */
  lastAction: string;
}

// ─── Action results ──────────────────────────────────────────────────────────

export interface PlayResult {
  success: boolean;
  burnOccurred: boolean;
  playerFinished: boolean;
  goAgain: boolean;  // true when same player takes another turn (burn, and they haven't won)
  message: string;
}
