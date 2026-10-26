/**
 * Achievements: what they are and how each one is detected.
 *
 * Pure: no React, no storage. The game store feeds every engine action
 * through `trackAction` (in-game feats) and the end of each game through
 * `gameOverAchievements` (wins, streaks, the campaign); achievementStore
 * keeps what's been unlocked. Earned in campaign and free play alike, by
 * human players only.
 *
 * Most of the list came from Jake the Elder himself (the real one), plus
 * Erich's Bomb Technician and his ideas for streaks and a flawless campaign.
 */
import { GameEvent, GameState, Player } from '../engine/types';
import { getEffectiveTopCard } from '../engine/rules';
import { getPlaySource } from '../engine/engine';

export type AchievementId =
  | 'uno-reverse'
  | 'big-bomb'
  | 'tactical-nuke'
  | 'ninja-warrior'
  | 'bomb-technician'
  | 'novice-duelist'
  | 'master-duelist'
  | 'lucky-sob'
  | 'cracking-aces'
  | 'hat-trick'
  | 'unshedable'
  | 'keeper'
  | 'without-a-scratch';

export interface Achievement {
  id: AchievementId;
  name: string;
  /** How to earn it, shown on the achievements screen. */
  description: string;
  emoji: string;
  /** Who thought of it (shown small). */
  credit?: string;
}

/** Display order on the achievements screen. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'uno-reverse', name: 'Uno Reverse', emoji: '🔁', credit: 'Jake',
    description: 'Play a 7 on a 7.' },
  { id: 'big-bomb', name: 'Big Bomb', emoji: '💣', credit: 'Jake',
    description: 'Play two 10s at the same time.' },
  { id: 'tactical-nuke', name: 'Tactical Nuke', emoji: '☢️', credit: 'Jake',
    description: 'Play three 10s at the same time.' },
  { id: 'ninja-warrior', name: 'Ultimate Ninja Warrior', emoji: '🥷', credit: 'Jake',
    description: 'Play four 8s in a single game.' },
  { id: 'bomb-technician', name: 'Bomb Technician', emoji: '🧯', credit: 'Erich & Jake',
    description: 'Get stuck with a 10 as your last face-up card when someone plays a 7, and pick up the pile.' },
  { id: 'novice-duelist', name: 'Novice Duelist', emoji: '🗡️', credit: 'Jake',
    description: 'Win a game after being the first to pick up the pile.' },
  { id: 'master-duelist', name: 'Master Duelist', emoji: '⚔️', credit: 'Jake',
    description: 'Win a game after picking up the pile three times.' },
  { id: 'lucky-sob', name: 'Lucky SOB', emoji: '🍀', credit: 'Jake',
    description: 'Flip a 10 from your second-to-last face-down card, then win with your last one.' },
  { id: 'cracking-aces', name: 'Cracking Aces', emoji: '🂡', credit: 'Jake',
    description: 'Win by flipping a face-down card that beats an Ace.' },
  { id: 'hat-trick', name: 'Hat Trick', emoji: '🎩', credit: 'Erich',
    description: 'Win three games in a row.' },
  { id: 'unshedable', name: 'Unshedable', emoji: '🔥', credit: 'Erich',
    description: 'Win five games in a row.' },
  { id: 'keeper', name: 'Keeper of the Teachings', emoji: '📜',
    description: 'Restore every table in the campaign.' },
  { id: 'without-a-scratch', name: 'Without a Scratch', emoji: '🛡️', credit: 'Erich',
    description: 'Restore every table in the campaign without losing a single campaign game.' },
];

export const ACHIEVEMENT_BY_ID: Record<AchievementId, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
) as Record<AchievementId, Achievement>;

// ─── Per-game tracking ───────────────────────────────────────────────────────

export interface GameStats {
  /** Pile pickups per player (including failed face-down flips). */
  pickups: number[];
  /** 8s (the transparent rank) played per player. */
  eightsPlayed: number[];
  /** Who picked up the pile first this game. */
  firstPickupBy: number | null;
  /** Set when a player flips a 10 from their second-to-last face-down card;
   *  cleared by the next action. Lucky SOB if that action is a winning flip. */
  luckyArmed: number | null;
}

export function newGameStats(playerCount: number): GameStats {
  return {
    pickups: Array(playerCount).fill(0),
    eightsPlayed: Array(playerCount).fill(0),
    firstPickupBy: null,
    luckyArmed: null,
  };
}

const human = (p: Player | undefined) => !!p && !p.isBot;

/**
 * Feed one engine action through. `prev` is the state the action was taken
 * on, `next` the result. Returns updated stats and any achievements a human
 * earned with this action. Rejected plays (no state change) earn nothing.
 */
export function trackAction(
  prev: GameState,
  events: GameEvent[],
  next: GameState,
  stats: GameStats,
): { stats: GameStats; earned: AchievementId[] } {
  if (next === prev) return { stats, earned: [] };
  const actor = prev.currentPlayerIndex;
  const p = prev.players[actor];
  const cfg = prev.players[actor]?.rules ?? prev.ruleConfig;
  const earned: AchievementId[] = [];
  const s: GameStats = {
    pickups: [...stats.pickups],
    eightsPlayed: [...stats.eightsPlayed],
    firstPickupBy: stats.firstPickupBy,
    luckyArmed: null, // any action disarms; re-armed below if it qualifies
  };
  const topBefore = getEffectiveTopCard(prev.playPile, cfg);
  const source = getPlaySource(p);

  const pickup = events.find((e) => e.type === 'pileTakenUp');
  if (pickup && pickup.type === 'pileTakenUp') {
    s.pickups[actor] += 1;
    if (s.firstPickupBy === null) s.firstPickupBy = actor;
    // Bomb Technician: your one face-up card is a 10, a 7 is on the pile,
    // and you're forced to take it.
    if (
      human(p) &&
      source === 'faceUp' &&
      p.faceUp.length === 1 &&
      p.faceUp[0].rank === cfg.burnRank &&
      topBefore?.rank === cfg.lowerThanRank &&
      !events.some((e) => e.type === 'faceDownFlipFailed')
    ) {
      earned.push('bomb-technician');
    }
  }

  const played = events.find((e) => e.type === 'cardsPlayed');
  if (played && played.type === 'cardsPlayed') {
    const rank = played.cards[0].rank;
    const n = played.cards.length;
    if (rank === cfg.transparentRank) s.eightsPlayed[actor] += n;
    if (human(p)) {
      if (rank === cfg.lowerThanRank && topBefore?.rank === cfg.lowerThanRank) earned.push('uno-reverse');
      if (rank === cfg.burnRank && n === 2) earned.push('big-bomb');
      if (rank === cfg.burnRank && n >= 3) earned.push('tactical-nuke');
      if (rank === cfg.transparentRank && s.eightsPlayed[actor] >= 4 && stats.eightsPlayed[actor] < 4) {
        earned.push('ninja-warrior');
      }
      if (played.source === 'faceDown') {
        const wonNow = next.winnerId === actor && prev.winnerId !== actor;
        if (rank === cfg.burnRank && p.faceDown.length === 2) s.luckyArmed = actor;
        if (wonNow && stats.luckyArmed === actor) earned.push('lucky-sob');
        if (wonNow && topBefore?.rank === 14) earned.push('cracking-aces');
      }
    }
  }
  return { stats: s, earned };
}

// ─── End of game ─────────────────────────────────────────────────────────────

export interface GameOverContext {
  /** Wins in a row before this game. */
  streak: number;
  /** Set for games launched from the campaign map. */
  campaign: {
    presetId: string;
    /** Completed nodes BEFORE this game. */
    completed: Record<string, true>;
    /** The full ladder (PRESET_ORDER). */
    order: string[];
    /** Campaign games lost so far, before this one. */
    losses: number;
  } | null;
}

export interface GameOverResult {
  earned: AchievementId[];
  /** Did any human play? Games with no human don't touch the streak. */
  humanPlayed: boolean;
  /** Did a human win? */
  humanWon: boolean;
}

export function gameOverAchievements(
  state: GameState,
  stats: GameStats,
  ctx: GameOverContext,
): GameOverResult {
  const humanPlayed = state.players.some((p) => !p.isBot);
  const winner = state.winnerId;
  const humanWon = winner !== null && human(state.players[winner]);
  const earned: AchievementId[] = [];
  if (!humanPlayed) return { earned, humanPlayed, humanWon };

  if (humanWon && winner !== null) {
    if (stats.firstPickupBy === winner) earned.push('novice-duelist');
    if (stats.pickups[winner] >= 3) earned.push('master-duelist');
    const streak = ctx.streak + 1;
    if (streak >= 3) earned.push('hat-trick');
    if (streak >= 5) earned.push('unshedable');
  }

  const c = ctx.campaign;
  if (c && humanWon) {
    const done = { ...c.completed, [c.presetId]: true as const };
    if (c.order.every((id) => done[id])) {
      earned.push('keeper');
      if (c.losses === 0) earned.push('without-a-scratch');
    }
  }
  return { earned, humanPlayed, humanWon };
}
