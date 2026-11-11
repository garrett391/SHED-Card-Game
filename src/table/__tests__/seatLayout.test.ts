import { emptySeats, SEAT_SLOTS, seatsFor } from '../seatLayout';

test('everyone gets a place, clockwise from the bottom, nobody shares', () => {
  for (let n = 1; n <= 6; n++) {
    const seats = seatsFor(n);
    expect(seats).toHaveLength(n);
    expect(seats[0]).toBe('bottom');
    expect(new Set(seats).size).toBe(n);
    // Turn order runs clockwise round the table.
    const at = seats.map((s) => SEAT_SLOTS.indexOf(s));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  }
});

test('two face each other; five leave the head of the table empty', () => {
  expect(seatsFor(2)).toEqual(['bottom', 'top']);
  expect(seatsFor(5)).not.toContain('top');
});

test('the layouts mirror left to right', () => {
  const mirror = { upperLeft: 'upperRight', lowerLeft: 'lowerRight' } as const;
  for (let n = 1; n <= 6; n++) {
    const seats = seatsFor(n);
    for (const [l, r] of Object.entries(mirror)) {
      expect(seats.includes(l as never)).toBe(seats.includes(r));
    }
  }
});

test('empty places are whatever is left', () => {
  expect(emptySeats(6)).toEqual([]);
  expect(emptySeats(4)).toEqual(['lowerLeft', 'lowerRight']);
  expect(emptySeats(2)).toHaveLength(4);
});

test('out-of-range counts are clamped', () => {
  expect(seatsFor(0)).toEqual(['bottom']);
  expect(seatsFor(9)).toHaveLength(6);
});
