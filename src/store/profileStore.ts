/**
 * The player's own settings, remembered on this device.
 *
 * playerName: what the first human seat is called. Setup pre-fills it and
 * saves whatever was typed when the cards are dealt, so it carries from
 * table to table (campaign and free play alike). Kept apart from
 * campaignStore so resetting campaign progress doesn't forget your name.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_PLAYER_NAME = 'Player 1';

interface ProfileStore {
  playerName: string;
  setPlayerName: (name: string) => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      playerName: DEFAULT_PLAYER_NAME,
      setPlayerName: (name) => {
        const trimmed = name.trim();
        if (trimmed) set({ playerName: trimmed });
      },
    }),
    {
      name: 'shed-profile-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
