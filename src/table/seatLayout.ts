/**
 * Where everyone sits on the setup screen's table, seen from above.
 *
 * Six places around an oval: yours at the bottom, then clockwise. Which
 * places are used depends on how many are playing, so two face each other
 * and five leave the head of the table empty rather than bunching up on
 * one side. Players take the used places in turn order.
 */
export type SeatSlot = 'bottom' | 'lowerLeft' | 'upperLeft' | 'top' | 'upperRight' | 'lowerRight';

/** Every place, clockwise from yours. */
export const SEAT_SLOTS: SeatSlot[] = [
  'bottom', 'lowerLeft', 'upperLeft', 'top', 'upperRight', 'lowerRight',
];

const LAYOUTS: Record<number, SeatSlot[]> = {
  1: ['bottom'],
  2: ['bottom', 'top'],
  3: ['bottom', 'upperLeft', 'upperRight'],
  4: ['bottom', 'upperLeft', 'top', 'upperRight'],
  5: ['bottom', 'lowerLeft', 'upperLeft', 'upperRight', 'lowerRight'],
  6: SEAT_SLOTS,
};

/** The place each player sits, by position in the lineup. */
export function seatsFor(playerCount: number): SeatSlot[] {
  const n = Math.max(1, Math.min(playerCount, SEAT_SLOTS.length));
  return LAYOUTS[n];
}

/** The places nobody is sitting in, clockwise. */
export function emptySeats(playerCount: number): SeatSlot[] {
  const taken = new Set(seatsFor(playerCount));
  return SEAT_SLOTS.filter((s) => !taken.has(s));
}
