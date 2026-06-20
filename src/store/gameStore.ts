import { create } from 'zustand';
import { GameEvent, GameState, PlayerConfig } from '../engine/types';
import * as engine from '../engine/engine';

interface GameStore {
  game: GameState | null;
  recentEvents: GameEvent[];
  selectedCardIds: string[];
  // Privacy: hand is hidden until the current human player taps "I'm ready".
  handRevealed: boolean;

  // lifecycle
  startGame: (configs: PlayerConfig[], lastManStanding?: boolean) => void;
  reset: () => void;

  // swap phase
  swap: (playerIdx: number, handCardId: string, faceUpCardId: string) => void;
  finishSwap: (playerIdx: number) => void;

  // playing phase
  toggleSelect: (cardId: string) => void;
  clearSelection: () => void;
  playSelected: () => void;
  playFaceDown: (cardId: string) => void;
  pickup: () => void;

  // ui state
  revealHand: () => void;
  hideHand: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  recentEvents: [],
  selectedCardIds: [],
  handRevealed: false,

  startGame: (configs, lastManStanding) => {
    const game = engine.createGame(configs);
    set({
      game: { ...game, lastManStanding: lastManStanding ?? false },
      recentEvents: [],
      selectedCardIds: [],
      handRevealed: false,
    });
  },

  reset: () => set({ game: null, recentEvents: [], selectedCardIds: [], handRevealed: false }),

  swap: (playerIdx, handId, faceUpId) =>
    set((s) =>
      s.game ? { game: engine.swapCards(s.game, playerIdx, handId, faceUpId) } : s,
    ),

  finishSwap: (playerIdx) =>
    set((s) =>
      s.game
        ? { game: engine.finishSwap(s.game, playerIdx), handRevealed: false }
        : s,
    ),

  toggleSelect: (id) =>
    set((s) => {
      // Only allow selecting cards of one rank at a time (multi-play rule).
      const game = s.game;
      if (!game) return s;
      const current = game.players[game.currentPlayerIndex];
      const card =
        current.hand.find((c) => c.id === id) ??
        current.faceUp.find((c) => c.id === id);
      if (!card) return s;

      if (s.selectedCardIds.includes(id)) {
        return { selectedCardIds: s.selectedCardIds.filter((x) => x !== id) };
      }
      // If we already have selections, they must match the new card's rank.
      if (s.selectedCardIds.length > 0) {
        const firstId = s.selectedCardIds[0];
        const firstCard =
          current.hand.find((c) => c.id === firstId) ??
          current.faceUp.find((c) => c.id === firstId);
        if (firstCard && firstCard.rank !== card.rank) {
          // Replace selection with new rank instead of mixing.
          return { selectedCardIds: [id] };
        }
      }
      return { selectedCardIds: [...s.selectedCardIds, id] };
    }),

  clearSelection: () => set({ selectedCardIds: [] }),

  playSelected: () => {
    const { game, selectedCardIds, handRevealed } = get();
    if (!game || selectedCardIds.length === 0) return;
    const prevIdx = game.currentPlayerIndex;
    const r = engine.playCards(game, game.currentPlayerIndex, selectedCardIds);
    // Keep hand revealed only if the SAME player still holds the turn (e.g. burn).
    const stillSamePlayer = r.state.currentPlayerIndex === prevIdx;
    set({
      game: r.state,
      recentEvents: r.events,
      selectedCardIds: [],
      handRevealed: stillSamePlayer ? handRevealed : false,
    });
  },

  playFaceDown: (id) => {
    const { game, handRevealed } = get();
    if (!game) return;
    const prevIdx = game.currentPlayerIndex;
    const r = engine.playCards(game, game.currentPlayerIndex, [id]);
    const stillSamePlayer = r.state.currentPlayerIndex === prevIdx;
    set({
      game: r.state,
      recentEvents: r.events,
      selectedCardIds: [],
      handRevealed: stillSamePlayer ? handRevealed : false,
    });
  },

  pickup: () => {
    const { game } = get();
    if (!game) return;
    const r = engine.pickupPile(game, game.currentPlayerIndex);
    // Pick up always ends turn — clear privacy reveal.
    set({
      game: r.state,
      recentEvents: r.events,
      selectedCardIds: [],
      handRevealed: false,
    });
  },

  revealHand: () => set({ handRevealed: true }),
  hideHand: () => set({ handRevealed: false }),
}));