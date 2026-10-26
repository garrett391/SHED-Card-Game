import { useGameStore } from '../gameStore';
import { useAchievementStore } from '../achievementStore';
import { decideBotAction } from '../../ai/bot';
import { getPlaySource } from '../../engine/engine';
import { getPreset } from '../../campaign/presets';

// Plays whole games through the real store (the same calls the table makes),
// with the bot deciding for the human seat too, and checks that the
// achievement bookkeeping stays consistent.
test('achievements are tracked through the game store', () => {
  let games = 0;
  let wins = 0;
  for (let n = 0; n < 60; n++) {
    const store = useGameStore.getState();
    store.startGame(
      [{ name: 'You', isBot: false }, { name: 'B1', isBot: true }, { name: 'B2', isBot: true }],
      getPreset(n % 2 ? 'chaos-shed' : 'jake-classic'),
    );
    for (let i = 0; i < 3; i++) useGameStore.getState().finishSwap(i);
    let turns = 0;
    while (useGameStore.getState().game!.phase === 'playing' && turns++ < 4000) {
      const s = useGameStore.getState();
      const g = s.game!;
      const idx = g.currentPlayerIndex;
      const a = decideBotAction(g, idx);
      if (a.type === 'pickup') s.pickup();
      else if (getPlaySource(g.players[idx]) === 'faceDown') s.playFaceDown(a.cardIds[0]);
      else {
        s.clearSelection();
        for (const id of a.cardIds) useGameStore.getState().toggleSelect(id);
        useGameStore.getState().playSelected(a.swapTargetId);
      }
    }
    const end = useGameStore.getState();
    expect(end.game!.phase).toBe('gameOver');
    games++;
    if (end.game!.players[end.game!.winnerId!].isBot === false) wins++;
    // Everything earned this game is recorded as unlocked, with no repeats.
    const unlocked = useAchievementStore.getState().unlocked;
    for (const id of end.earnedThisGame) expect(unlocked[id]).toBeTruthy();
    expect(new Set(end.earnedThisGame).size).toBe(end.earnedThisGame.length);
  }
  expect(games).toBe(60);
  // Something got unlocked over 60 games (pickups alone make duelists likely).
  expect(Object.keys(useAchievementStore.getState().unlocked).length).toBeGreaterThan(0);
  expect(wins).toBeGreaterThan(0);
});
