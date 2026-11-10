import { getPlaySource } from '../engine/engine';
import { Player } from '../engine/types';

/** The width one full-size card takes in a row of the hand, margins included. */
export const CARD_SLOT_WIDTH = 66;

/**
 * Whether a player's cards need the small size: more of them than two
 * rows of full-size cards would hold in `rowWidth`. Picking up a big pile
 * is routine in Shed, and at full size a hand like that pushes the pile
 * and the Play button off a phone screen.
 */
export function needsCompactHand(player: Player, rowWidth: number): boolean {
  const source = getPlaySource(player);
  const count =
    source === 'hand' ? player.hand.length
    : source === 'faceUp' ? player.faceUp.length
    : source === 'faceDown' ? player.faceDown.length
    : 0;
  const perRow = Math.max(1, Math.floor(rowWidth / CARD_SLOT_WIDTH));
  return count > perRow * 2;
}
