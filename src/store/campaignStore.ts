/**
 * Campaign progression — linear ladder through PRESET_ORDER.
 *
 * Rules:
 *   - The first preset (Jake's Classic) is always unlocked.
 *   - A preset unlocks when the one before it in PRESET_ORDER is completed.
 *   - A preset is completed when a HUMAN player wins it from the campaign
 *     map. Free-play wins don't count.
 *
 * Persistence: zustand/persist over AsyncStorage (device-local key-value —
 * no server or database involved; on web it's localStorage under the hood).
 * `completed` and `seenCinematics` are persisted; `lastUnlockedId` is a
 * transient UI signal for the game-over screen's "new variant unlocked" banner.
 *
 * Hydration note: AsyncStorage is async, so for one frame after cold start
 * `completed` is {} and everything beyond the first preset reads as locked,
 * then unlocks as the store hydrates. Locked→unlocked flicker is the safe
 * direction, so we don't gate rendering on hydration.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRESET_ORDER } from '../campaign/presets';

interface CampaignStore {
  /** Preset ids a human has won at least once. */
  completed: Record<string, true>;
  /** Cinematics that have already played (once-only). Persisted. */
  seenCinematics: Record<string, true>;
  /** Set when a completion unlocks a NEW preset; game-over shows a banner
   *  and clears it via acknowledgeUnlock. Not persisted. */
  lastUnlockedId: string | null;

  markCompleted: (presetId: string) => void;
  markCinematicSeen: (presetId: string) => void;
  acknowledgeUnlock: () => void;
  resetProgress: () => void;
}

/** First preset is always unlocked; others need the previous one completed. */
export function isUnlocked(completed: Record<string, true>, presetId: string): boolean {
  const idx = PRESET_ORDER.indexOf(presetId);
  if (idx <= 0) return true; // first in order, or unknown id (fail open)
  return Boolean(completed[PRESET_ORDER[idx - 1]]);
}

export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set, get) => ({
      completed: {},
      seenCinematics: {},
      lastUnlockedId: null,

      markCompleted: (presetId) => {
        const { completed } = get();
        if (completed[presetId]) return; // idempotent — safe to call from effects
        const idx = PRESET_ORDER.indexOf(presetId);
        const next = idx >= 0 ? PRESET_ORDER[idx + 1] ?? null : null;
        set({
          completed: { ...completed, [presetId]: true },
          // Completing presetId is exactly what unlocks `next`, so if a next
          // exists it is newly unlocked (idempotence above guarantees we
          // weren't completed before). Exception: saves from before a preset
          // was inserted mid-ladder may already have `next` completed — no
          // banner for a node the player has already beaten.
          lastUnlockedId: next && !completed[next] ? next : null,
        });
      },

      markCinematicSeen: (presetId) =>
        set({ seenCinematics: { ...get().seenCinematics, [presetId]: true } }),

      acknowledgeUnlock: () => set({ lastUnlockedId: null }),

      resetProgress: () =>
        set({ completed: {}, seenCinematics: {}, lastUnlockedId: null }),
    }),
    {
      name: 'shed-campaign-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ completed: s.completed, seenCinematics: s.seenCinematics }),
    },
  ),
);
