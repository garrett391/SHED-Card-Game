/**
 * The record book: every finished game with a human at the table, kept as
 * a short history plus running totals and a leaderboard by player name.
 *
 * Pure: no React, no storage. The game store hands each finished game to
 * `recordGame`; recordStore keeps the result on the device. Games played
 * by bots alone aren't recorded, the same as the win streak.
 *
 * The leaderboard counts by name, so pass-and-play friends who keep their
 * names from game to game each get a row, and so does every host you've
 * sat down with. A bot and a person with the same name are kept apart.
 */
import { GameState, Player } from '../engine/types';

/** How many finished games the history keeps. Totals count them all. */
export const RECENT_LIMIT = 30;

export interface RecordedPlayer {
  name: string;
  isBot: boolean;
  /** Cards still held when the game ended (0 for anyone who got out). */
  cardsLeft: number;
}

export interface GameRecord {
  /** ISO date the game ended. */
  at: string;
  /** The table's name (the rule set's). */
  table: string;
  /** Played from the campaign map. */
  campaign: boolean;
  /** Final standings: winner first, then fewest cards left. */
  players: RecordedPlayer[];
  /** The one left holding cards at a last-man-standing table. Elsewhere
   *  everyone but the winner is a Shithead, so nobody is singled out. */
  shithead: string | null;
  turns: number;
}

export interface Tally {
  name: string;
  isBot: boolean;
  games: number;
  wins: number;
}

export interface Records {
  /** Games with a human at the table. */
  games: number;
  /** Of those, the ones a human won. */
  wins: number;
  /** Longest run of human wins. */
  bestStreak: number;
  /** Tallies by player, keyed by `tallyKey`. */
  tallies: Record<string, Tally>;
  /** Newest first, at most RECENT_LIMIT. */
  recent: GameRecord[];
}

export const EMPTY_RECORDS: Records = {
  games: 0,
  wins: 0,
  bestStreak: 0,
  tallies: {},
  recent: [],
};

export function tallyKey(p: { name: string; isBot: boolean }): string {
  return `${p.isBot ? 'bot' : 'human'}:${p.name}`;
}

const cardsLeft = (p: Player) => p.hand.length + p.faceUp.length + p.faceDown.length;

/** What to keep of a finished game, or null if it isn't one to record. */
export function summarizeGame(
  game: GameState,
  opts: { turns: number; campaign: boolean; at: string },
): GameRecord | null {
  if (game.phase !== 'gameOver' || game.winnerId === null) return null;
  if (!game.players.some((p) => !p.isBot)) return null;
  const standings = [...game.players].sort((a, b) => {
    if (a.id === game.winnerId) return -1;
    if (b.id === game.winnerId) return 1;
    return cardsLeft(a) - cardsLeft(b);
  });
  const shithead =
    game.lastManStanding && game.shitheadId !== null
      ? game.players[game.shitheadId]?.name ?? null
      : null;
  return {
    at: opts.at,
    table: game.ruleConfig.name,
    campaign: opts.campaign,
    players: standings.map((p) => ({ name: p.name, isBot: p.isBot, cardsLeft: cardsLeft(p) })),
    shithead,
    turns: opts.turns,
  };
}

/**
 * Add a finished game to the book. `streak` is the run of human wins
 * including this game (0 after a loss).
 */
export function recordGame(records: Records, record: GameRecord, streak: number): Records {
  const winner = record.players[0];
  const tallies = { ...records.tallies };
  // Two seats with the same name (two "Bot"s, say) count as one player.
  const seen = new Set<string>();
  for (const p of record.players) {
    const key = tallyKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    const t = tallies[key] ?? { name: p.name, isBot: p.isBot, games: 0, wins: 0 };
    tallies[key] = {
      ...t,
      games: t.games + 1,
      wins: t.wins + (key === tallyKey(winner) ? 1 : 0),
    };
  }
  return {
    games: records.games + 1,
    wins: records.wins + (winner.isBot ? 0 : 1),
    bestStreak: Math.max(records.bestStreak, streak),
    tallies,
    recent: [record, ...records.recent].slice(0, RECENT_LIMIT),
  };
}

/** Whole-number win rate, 0 to 100. */
export function winRate(t: { games: number; wins: number }): number {
  return t.games === 0 ? 0 : Math.round((t.wins / t.games) * 100);
}

/** Most wins first; ties go to the better win rate, then to more games. */
export function leaderboard(records: Records): Tally[] {
  return Object.values(records.tallies).sort(
    (a, b) =>
      b.wins - a.wins ||
      b.wins / b.games - a.wins / a.games ||
      b.games - a.games ||
      a.name.localeCompare(b.name),
  );
}

/**
 * One line for a game in the history. With a single human at the table it
 * speaks to them; otherwise it names the winner.
 */
export function resultLine(record: GameRecord): { text: string; tone: 'won' | 'lost' | 'plain' } {
  const winner = record.players[0];
  const humans = record.players.filter((p) => !p.isBot);
  const you = humans.length === 1 ? humans[0] : null;
  if (!you) return { text: `${winner.name} won`, tone: 'plain' };
  if (you === winner) return { text: 'You won', tone: 'won' };
  if (you.cardsLeft === 0) return { text: `${winner.name} won · you got out`, tone: 'plain' };
  const n = you.cardsLeft;
  return { text: `${winner.name} won · you held ${n} card${n === 1 ? '' : 's'}`, tone: 'lost' };
}
