import AsyncStorage from '@react-native-async-storage/async-storage';
import { GAME_SAVE_VERSION, useGameStore } from '../gameStore';
import { getPreset } from '../../campaign/presets';

const SEATS = [{ name: 'You', isBot: false }, { name: 'Friend', isBot: false }];

async function saved() {
  const raw = await AsyncStorage.getItem('shed-game-v1');
  return raw ? JSON.parse(raw) : null;
}

describe('saving the game in progress', () => {
  test('a game survives a restart, and comes back behind the privacy gate', async () => {
    useGameStore.getState().startGame(SEATS, getPreset('jake-classic'), 'jake-classic');
    for (let i = 0; i < 2; i++) useGameStore.getState().finishSwap(i);
    useGameStore.getState().revealHand();
    const before = useGameStore.getState();
    const card = before.game!.players[before.game!.currentPlayerIndex].hand[0];
    useGameStore.getState().toggleSelect(card.id);
    expect((await saved()).version).toBe(GAME_SAVE_VERSION);

    // "Restart": blank the in-memory store without touching the save.
    useGameStore.setState(
      { game: null, campaignPresetId: null, stats: null, earnedThisGame: [],
        selectedCardIds: [], handRevealed: false, recentEvents: [] },
    );
    await AsyncStorage.setItem('shed-game-v1', JSON.stringify({
      state: { game: before.game, campaignPresetId: before.campaignPresetId,
        stats: before.stats, earnedThisGame: before.earnedThisGame },
      version: GAME_SAVE_VERSION,
    }));
    await useGameStore.persist.rehydrate();

    const after = useGameStore.getState();
    expect(after.game).toEqual(before.game);
    expect(after.campaignPresetId).toBe('jake-classic');
    expect(after.stats).toEqual(before.stats);
    // Nothing a second player shouldn't see carries over.
    expect(after.handRevealed).toBe(false);
    expect(after.selectedCardIds).toEqual([]);
  });

  test('leaving a finished game clears the save', async () => {
    useGameStore.getState().startGame(SEATS);
    expect((await saved()).state.game).not.toBeNull();
    useGameStore.getState().reset();
    expect((await saved()).state.game).toBeNull();
  });

  test('a save from another version is dropped', async () => {
    await AsyncStorage.setItem('shed-game-v1', JSON.stringify({
      state: { game: { phase: 'somethingOld' }, campaignPresetId: 'x', stats: null, earnedThisGame: [] },
      version: GAME_SAVE_VERSION - 1,
    }));
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().game).toBeNull();
    expect(useGameStore.getState().campaignPresetId).toBeNull();
  });
});
