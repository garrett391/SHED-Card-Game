/**
 * The free-play table you last dealt, so setup can open the way you left
 * it: the same variant and the same seats. Saved in profileStore when the
 * cards are dealt. Campaign tables aren't saved: their cast is fixed.
 */
import { BotStyle, PlayerConfig } from '../engine/types';
import { PRESET_ORDER, RULE_PRESETS } from './presets';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export interface SavedSeat {
  name: string;
  isBot: boolean;
  botStyle?: BotStyle;
}

export interface SavedTable {
  modeId: string;
  seats: SavedSeat[];
}

/** What to remember of a lineup: who sat where, not the rules they carry. */
export function toSavedTable(modeId: string, players: readonly PlayerConfig[]): SavedTable {
  return {
    modeId,
    seats: players.map(({ name, isBot, botStyle }) =>
      botStyle ? { name, isBot, botStyle } : { name, isBot },
    ),
  };
}

/** Free play offers Jake's Classic and every variant beaten in the campaign. */
export function isFreePlayMode(modeId: string, completed: Record<string, true>): boolean {
  const idx = PRESET_ORDER.indexOf(modeId);
  if (idx < 0 || !RULE_PRESETS[modeId]) return false;
  return idx === 0 || Boolean(completed[modeId]);
}

/**
 * Turn a saved table back into setup's starting state, or null when
 * there's nothing usable (never saved, or a save that no longer makes
 * sense). A variant that isn't open any more (campaign progress was
 * reset, the table was renamed) falls back to Jake's Classic and keeps
 * the seats.
 */
export function restoreTable(
  saved: unknown,
  completed: Record<string, true>,
): { modeId: string; players: PlayerConfig[] } | null {
  if (!saved || typeof saved !== 'object') return null;
  const { modeId, seats } = saved as Partial<SavedTable>;
  if (!Array.isArray(seats)) return null;
  const players: PlayerConfig[] = [];
  for (const s of seats) {
    if (!s || typeof s.name !== 'string' || typeof s.isBot !== 'boolean') return null;
    players.push(
      s.isBot && s.botStyle
        ? { name: s.name, isBot: true, botStyle: s.botStyle }
        : { name: s.name, isBot: s.isBot },
    );
  }
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) return null;
  const open = typeof modeId === 'string' && isFreePlayMode(modeId, completed);
  return { modeId: open ? (modeId as string) : PRESET_ORDER[0], players };
}
