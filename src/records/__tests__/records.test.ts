import {
  EMPTY_RECORDS,
  GameRecord,
  leaderboard,
  RECENT_LIMIT,
  recordGame,
  resultLine,
  summarizeGame,
  winRate,
} from '../records';
import { createGame } from '../../engine/engine';
import { DEFAULT_RULES } from '../../engine/rules';
import { GameState } from '../../engine/types';

const rec = (
  players: [name: string, isBot: boolean, cardsLeft: number][],
  extra: Partial<GameRecord> = {},
): GameRecord => ({
  at: '2026-11-10T00:00:00.000Z',
  table: "Jake's Classic",
  campaign: false,
  players: players.map(([name, isBot, cardsLeft]) => ({ name, isBot, cardsLeft })),
  shithead: null,
  turns: 40,
  ...extra,
});

/** A dealt game ended by hand: `winner` holds nothing, the rest keep their cards. */
function finished(configs: { name: string; isBot: boolean }[], winner: number): GameState {
  const g = createGame(configs, DEFAULT_RULES);
  return {
    ...g,
    phase: 'gameOver',
    winnerId: winner,
    players: g.players.map((p) =>
      p.id === winner ? { ...p, hand: [], faceUp: [], faceDown: [] } : p,
    ),
  };
}

describe('summarizeGame', () => {
  const opts = { turns: 12, campaign: true, at: '2026-11-10T00:00:00.000Z' };

  test('winner first, then fewest cards left', () => {
    const g = finished(
      [{ name: 'Garrett', isBot: false }, { name: 'Greg', isBot: true }, { name: 'Jake', isBot: true }],
      1,
    );
    g.players[2] = { ...g.players[2], hand: g.players[2].hand.slice(0, 1), faceUp: [] };
    const r = summarizeGame(g, opts)!;
    expect(r.players.map((p) => p.name)).toEqual(['Greg', 'Jake', 'Garrett']);
    expect(r.players[0].cardsLeft).toBe(0);
    expect(r.players[1].cardsLeft).toBeLessThan(r.players[2].cardsLeft);
    expect(r).toMatchObject({ table: DEFAULT_RULES.name, campaign: true, turns: 12, shithead: null });
  });

  test('a last-man-standing table names its Shithead', () => {
    const g = finished([{ name: 'Nick', isBot: false }, { name: 'Erich', isBot: false }], 0);
    const r = summarizeGame({ ...g, lastManStanding: true, shitheadId: 1 }, opts)!;
    expect(r.shithead).toBe('Erich');
  });

  test('bots alone and unfinished games are left out', () => {
    const bots = finished([{ name: 'A', isBot: true }, { name: 'B', isBot: true }], 0);
    expect(summarizeGame(bots, opts)).toBeNull();
    const live = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], DEFAULT_RULES);
    expect(summarizeGame(live, opts)).toBeNull();
  });
});

describe('recordGame', () => {
  test('totals, tallies and the best streak', () => {
    let r = EMPTY_RECORDS;
    r = recordGame(r, rec([['Garrett', false, 0], ['Greg', true, 5]]), 1);
    r = recordGame(r, rec([['Garrett', false, 0], ['Greg', true, 2]]), 2);
    r = recordGame(r, rec([['Greg', true, 0], ['Garrett', false, 7]]), 0);
    expect(r).toMatchObject({ games: 3, wins: 2, bestStreak: 2 });
    expect(r.tallies['human:Garrett']).toMatchObject({ games: 3, wins: 2 });
    expect(r.tallies['bot:Greg']).toMatchObject({ games: 3, wins: 1 });
    expect(EMPTY_RECORDS).toMatchObject({ games: 0, tallies: {}, recent: [] });
  });

  test('a bot and a person with the same name are kept apart', () => {
    const r = recordGame(EMPTY_RECORDS, rec([['Jake', false, 0], ['Jake', true, 3]]), 1);
    expect(r.tallies['human:Jake']).toMatchObject({ games: 1, wins: 1 });
    expect(r.tallies['bot:Jake']).toMatchObject({ games: 1, wins: 0 });
  });

  test('two seats with one name count once', () => {
    const r = recordGame(
      EMPTY_RECORDS,
      rec([['Bot', true, 0], ['Garrett', false, 2], ['Bot', true, 4]]),
      0,
    );
    expect(r.tallies['bot:Bot']).toMatchObject({ games: 1, wins: 1 });
  });

  test('the history is newest first and capped; totals keep counting', () => {
    let r = EMPTY_RECORDS;
    for (let i = 0; i < RECENT_LIMIT + 5; i++) {
      r = recordGame(r, rec([['Garrett', false, 0], ['Greg', true, 1]], { turns: i }), i + 1);
    }
    expect(r.recent).toHaveLength(RECENT_LIMIT);
    expect(r.recent[0].turns).toBe(RECENT_LIMIT + 4);
    expect(r.games).toBe(RECENT_LIMIT + 5);
  });
});

test('leaderboard: most wins, then win rate, then games', () => {
  let r = EMPTY_RECORDS;
  r = recordGame(r, rec([['Nick', false, 0], ['Erich', false, 1], ['Garrett', false, 3]]), 1);
  r = recordGame(r, rec([['Nick', false, 0], ['Erich', false, 1]]), 2);
  r = recordGame(r, rec([['Garrett', false, 0], ['Erich', false, 1]]), 3);
  r = recordGame(r, rec([['Garrett', false, 0], ['Nick', false, 1]]), 4);
  // Nick 2/3, Garrett 2/3, Erich 0/3; the tie breaks by name.
  expect(leaderboard(r).map((t) => t.name)).toEqual(['Garrett', 'Nick', 'Erich']);
  r = recordGame(r, rec([['Erich', false, 0], ['Garrett', false, 2]]), 5);
  // Nick 2/3 now leads Garrett 2/4.
  expect(leaderboard(r).map((t) => t.name)).toEqual(['Nick', 'Garrett', 'Erich']);
  expect(winRate(r.tallies['human:Nick'])).toBe(67);
  expect(winRate({ games: 0, wins: 0 })).toBe(0);
});

describe('resultLine', () => {
  test('speaks to a lone human', () => {
    expect(resultLine(rec([['Garrett', false, 0], ['Greg', true, 4]]))).toEqual({
      text: 'You won', tone: 'won',
    });
    expect(resultLine(rec([['Greg', true, 0], ['Garrett', false, 1]]))).toEqual({
      text: 'Greg won · you held 1 card', tone: 'lost',
    });
    expect(
      resultLine(rec([['Greg', true, 0], ['Garrett', false, 0], ['Jake', true, 6]], { shithead: 'Jake' })),
    ).toEqual({ text: 'Greg won · you got out', tone: 'plain' });
  });

  test('names the winner at a pass-and-play table', () => {
    expect(resultLine(rec([['Nick', false, 0], ['Erich', false, 4]]))).toEqual({
      text: 'Nick won', tone: 'plain',
    });
  });
});
