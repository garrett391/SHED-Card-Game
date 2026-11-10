import { needsCompactHand } from '../handLayout';
import { Card, Player } from '../../engine/types';

const cards = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, rank: 3 + (i % 10), suit: '♠' } as Card));

const player = (hand: number, faceUp = 3, faceDown = 3) =>
  ({ id: 0, name: 'You', isBot: false, isFinished: false,
     hand: cards(hand), faceUp: cards(faceUp), faceDown: cards(faceDown) } as Player);

describe('compact hand', () => {
  // A 393pt phone leaves about 369pt for the row: five full-size cards.
  const PHONE = 369;

  test('a hand that fits two rows stays full size', () => {
    expect(needsCompactHand(player(3), PHONE)).toBe(false);
    expect(needsCompactHand(player(10), PHONE)).toBe(false);
  });

  test('a picked-up pile goes compact', () => {
    expect(needsCompactHand(player(11), PHONE)).toBe(true);
    expect(needsCompactHand(player(24), PHONE)).toBe(true);
  });

  test('a wider screen holds more before it does', () => {
    expect(needsCompactHand(player(14), 800)).toBe(false);
  });

  test('it goes by the cards being played from, not the whole holding', () => {
    // Hand empty: three face-up cards are what's on show.
    expect(needsCompactHand(player(0), PHONE)).toBe(false);
  });
});
