/**
 * Which stick-ups at the Outlaw Pass get the wanted-poster panel.
 * Pure: reads engine events and the game they came from.
 */
import type { StickUp } from '../components/StickUpCard';
import { GameEvent, GameState } from '../engine/types';

export type SeatedStickUp = StickUp & { robberId: number; victimId: number };

/** The stick-up panel for a 7 that robbed (or tried to rob) a human, or
 *  that a human played, if there was one. */
export function stickUpFrom(
  events: readonly GameEvent[],
  game: GameState | null,
): SeatedStickUp | null {
  if (!game) return null;
  for (const e of events) {
    if (e.type !== 'cardStolen' && e.type !== 'stickUpPassed') continue;
    const robber = game.players[e.playerId];
    const victim = game.players[e.targetId];
    if (!robber || !victim || (robber.isBot && victim.isBot)) return null;
    const seats = {
      robber: robber.name, victim: victim.name, robberId: e.playerId, victimId: e.targetId,
    };
    if (e.type === 'cardStolen') return { kind: 'trade', ...seats, took: e.took, gave: e.gave };
    if (e.reason === 'nothingBetter') {
      return e.best && e.worst
        ? { kind: 'nothingBetter', ...seats, best: e.best, worst: e.worst }
        : { kind: 'nothingWorth', ...seats };
    }
    return { kind: e.reason, ...seats };
  }
  return null;
}

/** The player is the only human at the table, so the UI can say "you". */
export function isSoleHuman(game: GameState, playerId: number): boolean {
  const humans = game.players.filter((p) => !p.isBot);
  return humans.length === 1 && humans[0].id === playerId;
}
