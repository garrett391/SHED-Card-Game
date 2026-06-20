import { create } from 'zustand';
import {
  GameState,
  PlayResult,
  Rank,
  ActivePile,
} from '../../shared/game-rules/types';
import {
  createGame,
  swapCard as engineSwap,
  doneSwapping as engineDoneSwapping,
  playCards as enginePlayCards,
  playFaceDownCard as enginePlayFaceDown,
  pickUpPile as enginePickUp,
  getPlayableCardIds as engineGetPlayable,
  hasPlayableCards as engineHasPlayable,
  getActivePile,
} from '../../shared/game-rules/engine';

interface GameStore extends GameState {
  // ── Setup ───────────────────────────────────────────────────────────────
  initGame: (playerNames: string[]) => void;
  resetGame: () => void;

  // ── Swap phase ──────────────────────────────────────────────────────────
  swapCard: (playerIndex: number, handCardId: string, faceUpCardId: string) => void;
  doneSwapping: (playerIndex: number) => void;

  // ── Gameplay ────────────────────────────────────────────────────────────
  playCards: (playerIndex: number, cardIds: string[]) => PlayResult;
  playFaceDownCard: (playerIndex: number, cardId: string) => PlayResult;
  pickUpPile: (playerIndex: number) => void;

  // ── Derived helpers (avoid re-computing in components) ──────────────────
  getPlayableCardIds: (playerIndex: number) => Set<string>;
  hasPlayableCards: (playerIndex: number) => boolean;
  getActivePile: (playerIndex: number) => ActivePile;
}

// Minimal initial state — replaced by initGame() before any real use.
const EMPTY_STATE: GameState = {
  players: [],
  currentPlayerIndex: 0,
  dealerIndex: 0,
  drawPile: [],
  playPile: [],
  gamePhase: 'swapping',
  swapPhasePlayerIndex: 0,
  finishedCount: 0,
  firstTurnConstraint: null,
  isFirstTurn: true,
  lastAction: '',
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...EMPTY_STATE,

  initGame: (playerNames) => set(createGame(playerNames)),
  resetGame: () => set(EMPTY_STATE),

  swapCard: (playerIndex, handCardId, faceUpCardId) =>
    set(state => engineSwap(state, playerIndex, handCardId, faceUpCardId)),

  doneSwapping: (_playerIndex) =>
    set(state => engineDoneSwapping(state)),

  playCards: (playerIndex, cardIds) => {
    let result!: PlayResult;
    set(state => {
      const { newState, result: r } = enginePlayCards(state, playerIndex, cardIds);
      result = r;
      return r.success ? newState : state;
    });
    return result;
  },

  playFaceDownCard: (playerIndex, cardId) => {
    let result!: PlayResult;
    set(state => {
      const { newState, result: r } = enginePlayFaceDown(state, playerIndex, cardId);
      result = r;
      // Even on failure (picked up pile) we update state
      return newState;
    });
    return result;
  },

  pickUpPile: (playerIndex) =>
    set(state => enginePickUp(state, playerIndex)),

  getPlayableCardIds: (playerIndex) =>
    engineGetPlayable(get(), playerIndex),

  hasPlayableCards: (playerIndex) =>
    engineHasPlayable(get(), playerIndex),

  getActivePile: (playerIndex) =>
    getActivePile(get().players[playerIndex]),
}));
