/**
 * The player's own settings, remembered on this device.
 *
 * playerName: what the first human seat is called. Setup pre-fills it and
 * saves whatever was typed when the cards are dealt, so it carries from
 * table to table (campaign and free play alike). Kept apart from
 * campaignStore so resetting campaign progress doesn't forget your name.
 *
 * gameSpeed: how fast bot turns go by (see src/table/pacing.ts).
 * sfxMuted: card and game sounds off. The root layout hands it to sfx.ts.
 * radioStationId: the last station picked, so the radio comes back on it.
 * Whether the radio was playing is deliberately not remembered: it always
 * starts paused (see radioStore).
 * lastTable: the free-play table last dealt (see src/campaign/lastTable.ts).
 * homeScene: the Home screen scene pinned in Settings, or 'follow' to move
 * with the campaign (see src/campaign/homeScenes.ts).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameSpeed } from '../table/pacing';
import type { SavedTable } from '../campaign/lastTable';
import { FOLLOW_CAMPAIGN } from '../campaign/homeScenes';

export const DEFAULT_PLAYER_NAME = 'Player 1';

interface ProfileStore {
  playerName: string;
  setPlayerName: (name: string) => void;
  gameSpeed: GameSpeed;
  setGameSpeed: (speed: GameSpeed) => void;
  sfxMuted: boolean;
  setSfxMuted: (muted: boolean) => void;
  radioStationId: string | null;
  setRadioStationId: (id: string) => void;
  lastTable: SavedTable | null;
  setLastTable: (table: SavedTable) => void;
  homeScene: string;
  setHomeScene: (id: string) => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      playerName: DEFAULT_PLAYER_NAME,
      setPlayerName: (name) => {
        const trimmed = name.trim();
        if (trimmed) set({ playerName: trimmed });
      },
      gameSpeed: 'normal',
      setGameSpeed: (gameSpeed) => set({ gameSpeed }),
      sfxMuted: false,
      setSfxMuted: (sfxMuted) => set({ sfxMuted }),
      radioStationId: null,
      setRadioStationId: (radioStationId) => set({ radioStationId }),
      lastTable: null,
      setLastTable: (lastTable) => set({ lastTable }),
      homeScene: FOLLOW_CAMPAIGN,
      setHomeScene: (homeScene) => set({ homeScene }),
    }),
    {
      name: 'shed-profile-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
