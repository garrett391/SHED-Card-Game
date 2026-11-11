/**
 * The record book, remembered on this device: totals, the leaderboard and
 * the last games played. What goes in it is decided in
 * src/records/records.ts; the game store adds each game as it ends.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_RECORDS, GameRecord, recordGame, Records } from '../records/records';

interface RecordStore {
  records: Records;
  /** `streak`: human wins in a row including this game (0 after a loss). */
  add: (record: GameRecord, streak: number) => void;
  clear: () => void;
}

export const useRecordStore = create<RecordStore>()(
  persist(
    (set) => ({
      records: EMPTY_RECORDS,
      add: (record, streak) => set((s) => ({ records: recordGame(s.records, record, streak) })),
      clear: () => set({ records: EMPTY_RECORDS }),
    }),
    {
      name: 'shed-records-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
