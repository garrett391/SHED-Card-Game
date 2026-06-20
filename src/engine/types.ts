// Core type definitions for the SHED game engine.
// The engine is pure: no React, no side effects, all state transitions return new state.

export type Suit = '♠' | '♥' | '♦' | '♣';

// Card value: 2-10 literal, J=11, Q=12, K=13, A=14
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export interface PlayerConfig {
  name: string;
  isBot: boolean;
}

export interface Player {
  id: number;
  name: string;
  isBot: boolean;
  hand: Card[];      // private cards in hand
  faceUp: Card[];    // mid-game pile (visible to all)
  faceDown: Card[];  // late-game pile (hidden, played at random)
  isFinished: boolean;
}

export type GamePhase = 'swap' | 'playing' | 'gameOver';

// Where a player is currently drawing cards FROM to play.
// Determined implicitly by what they have left.
export type PlaySource = 'hand' | 'faceUp' | 'faceDown';

export interface LogEntry {
  id: number;
  text: string;
  playerId?: number;
}

export interface GameState {
  players: Player[];
  drawPile: Card[];              // pop from end
  playPile: Card[];              // index 0 = top of pile
  burnedPile: Card[];            // out of play (debug / future stats)
  currentPlayerIndex: number;
  direction: 1 | -1;             // 1 = clockwise (player order)
  phase: GamePhase;
  swapsComplete: boolean[];      // per player
  startingPlayerIndex: number;
  pendingExtraTurn: boolean;     // after burn (10 or 4-of-a-kind)
  log: LogEntry[];
  lastManStanding: boolean;       // true = play until one remains; false = first winner ends it
  winnerId: number | null;       // first to empty all piles
  shitheadId: number | null;     // last player remaining (set on gameOver)
}

export type GameEvent =
  | { type: 'cardsPlayed'; playerId: number; cards: Card[]; source: PlaySource }
  | { type: 'pileBurned'; reason: 'ten' | 'fourOfKind' }
  | { type: 'extraTurn'; playerId: number }
  | { type: 'pileTakenUp'; playerId: number; cardCount: number }
  | { type: 'cardsDrawn'; playerId: number; count: number }
  | { type: 'playerFinished'; playerId: number }
  | { type: 'gameOver'; winnerId: number; shitheadId: number | null }
  | { type: 'faceDownFlipFailed'; playerId: number; card: Card };

export interface PlayResult {
  state: GameState;
  events: GameEvent[];
}