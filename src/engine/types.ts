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

// ─── Rule configuration ────────────────────────────────────────────────────────
// Parameterizes every house rule so the engine stays pure and variant-agnostic.
// Pass one of these to createGame(); it's stored on GameState for the engine to
// reference on every move.

export interface RuleConfig {
  id: string;
  name: string;
  description: string;
  flavorText: string;

  // Power card rank assignments
  resetRank: Rank;         // Always playable, resets pile (Jake default: 2)
  lowerThanRank: Rank;     // Forces next play ≤ this rank   (Jake default: 7)
  transparentRank: Rank;   // Invisible / skip               (Jake default: 8)
  burnRank: Rank;          // Instant burn                    (Jake default: 10)

  // Optional power card
  reverseRank: Rank | null; // Reverses play direction (e.g. 9). null = disabled.
  // When true, the reverse rank is wild: always playable, like a power card.
  // When false (all current presets), it's an ordinary card that obeys
  // meets-or-beats — its reverse effect still fires when legally played.
  reverseRankWild: boolean;

  // Burn variants
  fourOfAKindBurns: boolean;        // 4 same-rank (skipping transparent) burns pile
  tripleTransparentBurns: boolean;  // OFCOM rule: 3 consecutive transparents burn

  // Play restriction variants
  hardEights: boolean;              // Transparent can't be played on lowerThan (Justin's Schism)
  burnRankRestricted: boolean;      // Burn card can't be played on face cards (J/Q/K/A)
  burnRankOverridesLowerThan: boolean; // Burn card CAN play on lowerThan (Super 10s)

  // Special combos
  sixNineReverse: boolean;          // Playing 9 on a 6 reverses direction

  // Gameplay variants
  // Note: voluntary pickup (choosing to take the pile even when you can play)
  // is a standing rule in every variant — the pile is always tappable on your
  // turn — so it isn't configurable here.
  lastManStanding: boolean;         // true = play until one remains; false = first out wins
}

// ─── Game state ─────────────────────────────────────────────────────────────────

export interface GameState {
  players: Player[];
  deckCount: number;             // Explicitly tracks how many decks this game uses
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
  ruleConfig: RuleConfig;        // active ruleset for this game
  lastManStanding: boolean;       // true = play until one remains; false = first winner ends it
  winnerId: number | null;       // first to empty all piles
  shitheadId: number | null;     // last player remaining (set on gameOver)
}

export type GameEvent =
  | { type: 'cardsPlayed'; playerId: number; cards: Card[]; source: PlaySource }
  | { type: 'pileBurned'; reason: 'burnRank' | 'fourOfKind' | 'tripleTransparent' }
  | { type: 'extraTurn'; playerId: number }
  | { type: 'pileTakenUp'; playerId: number; cardCount: number }
  | { type: 'cardsDrawn'; playerId: number; count: number }
  | { type: 'playerFinished'; playerId: number }
  | { type: 'gameOver'; winnerId: number; shitheadId: number | null }
  | { type: 'faceDownFlipFailed'; playerId: number; card: Card }
  /** An attempted play was illegal under the current rules. State is
   *  unchanged; `reason` is player-facing text explaining why. */
  | { type: 'playRejected'; playerId: number; reason: string }
  | { type: 'directionReversed'; playerId: number };

export interface PlayResult {
  state: GameState;
  events: GameEvent[];
}
