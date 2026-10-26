/**
 * Unlocked achievements and the running counters they need, remembered on
 * this device. Detection lives in src/achievements/achievements.ts; the game
 * store calls into this after each action and at the end of each game.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AchievementId } from '../achievements/achievements';

interface AchievementStore {
  /** id → ISO date first unlocked. */
  unlocked: Partial<Record<AchievementId, string>>;
  /** Wins in a row (games with at least one human). */
  streak: number;
  /** Campaign games lost since this device started tracking. */
  campaignLosses: number;

  /** Record ids as unlocked; returns only the ones that are new. */
  unlock: (ids: AchievementId[]) => AchievementId[];
  recordResult: (humanWon: boolean, campaignGame: boolean) => void;
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set, get) => ({
      unlocked: {},
      streak: 0,
      campaignLosses: 0,

      unlock: (ids) => {
        const { unlocked } = get();
        const fresh = [...new Set(ids)].filter((id) => !unlocked[id]);
        if (fresh.length === 0) return [];
        const now = new Date().toISOString();
        set({ unlocked: { ...unlocked, ...Object.fromEntries(fresh.map((id) => [id, now])) } });
        return fresh;
      },

      recordResult: (humanWon, campaignGame) =>
        set((s) => ({
          streak: humanWon ? s.streak + 1 : 0,
          campaignLosses: s.campaignLosses + (campaignGame && !humanWon ? 1 : 0),
        })),
    }),
    {
      name: 'shed-achievements-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
