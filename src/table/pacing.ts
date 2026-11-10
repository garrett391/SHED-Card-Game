/**
 * How fast the table moves on bot turns. The player picks a speed in
 * Settings (saved in profileStore); the table screen reads its timings
 * from here.
 */
export type GameSpeed = 'normal' | 'fast';

export interface Pacing {
  /** How long a bot "thinks" before it plays. */
  thinkMs: number;
  /** How long a bot's play (or the winning play) holds the table. */
  displayMs: number;
  /** How long the "who played what" caption stays: a touch longer than
   *  the hold, so the line lingers into the next turn. */
  captionMs: number;
}

export const PACING: Record<GameSpeed, Pacing> = {
  // Readable for someone still learning what the cards do.
  normal: { thinkMs: 700, displayMs: 1800, captionMs: 2600 },
  // For players who read the pile at a glance: under half the wait.
  fast: { thinkMs: 300, displayMs: 800, captionMs: 1600 },
};

export const GAME_SPEEDS: readonly GameSpeed[] = ['normal', 'fast'];

/** The timings for a saved speed; anything unrecognised plays at normal. */
export function pacingFor(speed: unknown): Pacing {
  return speed === 'fast' ? PACING.fast : PACING.normal;
}
