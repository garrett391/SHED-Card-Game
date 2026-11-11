/**
 * The game in progress.
 *
 * Saved on the device after every action (zustand/persist over AsyncStorage,
 * like the campaign and achievements), so a refresh, a tab the phone threw
 * away or an app restart picks the game back up: Home offers "Resume game",
 * and the table screens wait for the save to load before giving up on a
 * game. Only the game itself is saved. The selection, the last action's
 * events and the privacy reveal start fresh, so pass-and-play comes back
 * behind the "pass the device" gate.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameEvent, GameState, PlayerConfig, RuleConfig } from '../engine/types';
import { DEFAULT_RULES } from '../engine/rules';
import * as engine from '../engine/engine';
import { decideBotSwaps } from '../ai/bot';
import {
  AchievementId,
  gameOverAchievements,
  GameStats,
  newGameStats,
  trackAction,
} from '../achievements/achievements';
import { useAchievementStore } from './achievementStore';
import { useCampaignStore } from './campaignStore';
import { useRecordStore } from './recordStore';
import { summarizeGame } from '../records/records';
import { PRESET_ORDER } from '../campaign/presets';

interface GameStore {
  game: GameState | null;
  recentEvents: GameEvent[];
  selectedCardIds: string[];
  // Privacy: hand is hidden until the current human player taps "I'm ready".
  handRevealed: boolean;
  // Set when the game was launched from the campaign map (setup passes the
  // node's preset id). Free play leaves it null — the ruleConfig alone can't
  // distinguish the two, since free play offers the same presets. Game-over
  // uses this to show "Continue campaign" / "Try again" instead of the
  // generic actions.
  campaignPresetId: string | null;
  /** Per-game counters for achievements (pickups, 8s played, …). */
  stats: GameStats | null;
  /** Achievements newly unlocked this game, in order. The table shows a
   *  toast per entry; game-over lists them. */
  earnedThisGame: AchievementId[];

  // lifecycle
  startGame: (
    configs: PlayerConfig[],
    ruleConfig?: RuleConfig,
    campaignPresetId?: string | null,
  ) => void;
  reset: () => void;

  // swap phase
  swap: (playerIdx: number, handCardId: string, faceUpCardId: string) => void;
  finishSwap: (playerIdx: number) => void;
  /** A bot's whole swap turn: its chosen swaps, then done. */
  botSwap: (playerIdx: number) => void;

  // playing phase
  toggleSelect: (cardId: string) => void;
  /** Long-press: select every card of this card's rank in the cards being
   *  played from, or clear them if the whole set is already selected. */
  selectRank: (cardId: string) => void;
  clearSelection: () => void;
  /** swapTargetId: whose hand a swap joker takes (see engine.playCards). */
  playSelected: (swapTargetId?: number) => void;
  playFaceDown: (cardId: string) => void;
  pickup: () => void;

  // ui state
  revealHand: () => void;
  hideHand: () => void;
}

/**
 * Bump when GameState, RuleConfig or GameStats change shape: a save from
 * an older version is dropped instead of loaded into an engine that can't
 * read it.
 */
export const GAME_SAVE_VERSION = 1;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
  game: null,
  recentEvents: [],
  selectedCardIds: [],
  handRevealed: false,
  campaignPresetId: null,
  stats: null,
  earnedThisGame: [],

  startGame: (configs, ruleConfig, campaignPresetId = null) => {
    const config = ruleConfig ?? DEFAULT_RULES;
    const game = engine.createGame(configs, config);
    set({
      game,
      recentEvents: [],
      selectedCardIds: [],
      handRevealed: false,
      campaignPresetId,
      stats: newGameStats(game.players.length),
      earnedThisGame: [],
    });
  },

  reset: () =>
    set({
      game: null,
      recentEvents: [],
      selectedCardIds: [],
      handRevealed: false,
      campaignPresetId: null,
      stats: null,
      earnedThisGame: [],
    }),

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

  botSwap: (playerIdx) =>
    set((s) => {
      if (!s.game) return s;
      let game = s.game;
      for (const { handCardId, faceUpCardId } of decideBotSwaps(game, playerIdx)) {
        game = engine.swapCards(game, playerIdx, handCardId, faceUpCardId);
      }
      return { game: engine.finishSwap(game, playerIdx), handRevealed: false };
    }),

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

  selectRank: (id) =>
    set((s) => {
      const game = s.game;
      if (!game) return s;
      const current = game.players[game.currentPlayerIndex];
      const source = engine.getPlaySource(current);
      // Face-down cards are flipped blind, one at a time: no sets there.
      if (source !== 'hand' && source !== 'faceUp') return s;
      const cards = source === 'hand' ? current.hand : current.faceUp;
      const card = cards.find((c) => c.id === id);
      if (!card) return s;
      const rankIds = cards.filter((c) => c.rank === card.rank).map((c) => c.id);
      const allSelected =
        s.selectedCardIds.length === rankIds.length &&
        rankIds.every((x) => s.selectedCardIds.includes(x));
      return { selectedCardIds: allSelected ? [] : rankIds };
    }),

  clearSelection: () => set({ selectedCardIds: [] }),

  playSelected: (swapTargetId) => {
    const { game, selectedCardIds, handRevealed } = get();
    if (!game || selectedCardIds.length === 0) return;
    const prevIdx = game.currentPlayerIndex;
    const r = engine.playCards(game, game.currentPlayerIndex, selectedCardIds, {
      swapTargetId,
    });
    const ach = achievementsFor(get(), game, r);
    // Keep hand revealed only if the SAME player still holds the turn (e.g. burn).
    const stillSamePlayer = r.state.currentPlayerIndex === prevIdx;
    // On a rejected play, keep the selection so the player can adjust it
    // instead of re-tapping everything from scratch.
    const rejected = r.events.some((e) => e.type === 'playRejected');
    set({
      game: r.state,
      recentEvents: r.events,
      selectedCardIds: rejected ? selectedCardIds : [],
      handRevealed: stillSamePlayer ? handRevealed : false,
      ...ach,
    });
  },

  playFaceDown: (id) => {
    const { game, handRevealed } = get();
    if (!game) return;
    const prevIdx = game.currentPlayerIndex;
    const r = engine.playCards(game, game.currentPlayerIndex, [id]);
    const stillSamePlayer = r.state.currentPlayerIndex === prevIdx;
    const ach = achievementsFor(get(), game, r);
    set({
      game: r.state,
      recentEvents: r.events,
      selectedCardIds: [],
      handRevealed: stillSamePlayer ? handRevealed : false,
      ...ach,
    });
  },

  pickup: () => {
    const { game } = get();
    if (!game) return;
    const r = engine.pickupPile(game, game.currentPlayerIndex);
    const ach = achievementsFor(get(), game, r);
    // Pick up always ends turn — clear privacy reveal.
    set({
      game: r.state,
      recentEvents: r.events,
      selectedCardIds: [],
      handRevealed: false,
      ...ach,
    });
  },

  revealHand: () => set({ handRevealed: true }),
  hideHand: () => set({ handRevealed: false }),
    }),
    {
      name: 'shed-game-v1',
      version: GAME_SAVE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        game: s.game,
        campaignPresetId: s.campaignPresetId,
        stats: s.stats,
        earnedThisGame: s.earnedThisGame,
      }),
      // Any other version: start with no game rather than guess at its shape.
      migrate: () => ({
        game: null,
        campaignPresetId: null,
        stats: null,
        earnedThisGame: [],
      }),
    },
  ),
);

/**
 * False until the saved game (if any) has loaded from the device. Screens
 * that send you home when there's no game wait for this first, so a
 * refresh on the table doesn't bounce to the menu before the save arrives.
 */
export function useGameHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated());
  useEffect(() => {
    setHydrated(useGameStore.persist.hasHydrated());
    return useGameStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

/**
 * Run one engine action through achievement tracking: in-game feats on
 * every action, plus wins, streaks and the campaign when the game ends.
 * Unlocks are saved to achievementStore, and a finished game goes in the
 * record book (recordStore); returns the store fields to set.
 */
function achievementsFor(
  store: Pick<GameStore, 'stats' | 'earnedThisGame' | 'campaignPresetId'>,
  prev: GameState,
  r: { state: GameState; events: GameEvent[] },
): Pick<GameStore, 'stats' | 'earnedThisGame'> {
  const stats = store.stats ?? newGameStats(prev.players.length);
  const t = trackAction(prev, r.events, r.state, stats);
  const ids = [...t.earned];
  const ach = useAchievementStore.getState();
  if (r.state.phase === 'gameOver' && prev.phase !== 'gameOver') {
    const campaignId = store.campaignPresetId;
    const result = gameOverAchievements(r.state, t.stats, {
      streak: ach.streak,
      campaign: campaignId
        ? {
            presetId: campaignId,
            completed: useCampaignStore.getState().completed,
            order: PRESET_ORDER,
            losses: ach.campaignLosses,
          }
        : null,
    });
    ids.push(...result.earned);
    if (result.humanPlayed) {
      ach.recordResult(result.humanWon, !!campaignId);
      const record = summarizeGame(r.state, {
        turns: t.stats.turns,
        campaign: !!campaignId,
        at: new Date().toISOString(),
      });
      if (record) {
        useRecordStore.getState().add(record, result.humanWon ? ach.streak + 1 : 0);
      }
    }
  }
  const fresh = ach.unlock(ids);
  return { stats: t.stats, earnedThisGame: [...store.earnedThisGame, ...fresh] };
}
