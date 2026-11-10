import { useGameStore } from '../gameStore';
import { Card, GameState } from '../../engine/types';

const card = (id: string, rank: number): Card => ({ id, rank, suit: '♠' } as Card);

/** A dealt two-player game with the current player's cards replaced. */
function seat(hand: Card[], faceUp: Card[] = [card('u1', 4), card('u2', 4), card('u3', 9)]) {
  const s = useGameStore.getState();
  s.startGame([{ name: 'You', isBot: false }, { name: 'Friend', isBot: false }]);
  for (let i = 0; i < 2; i++) useGameStore.getState().finishSwap(i);
  const game = useGameStore.getState().game as GameState;
  const idx = game.currentPlayerIndex;
  const players = game.players.map((p, i) => (i === idx ? { ...p, hand, faceUp } : p));
  useGameStore.setState({ game: { ...game, players }, selectedCardIds: [] });
}

const selected = () => [...useGameStore.getState().selectedCardIds].sort();

describe('holding a card selects its set', () => {
  test('every card of that rank in the hand, and nothing else', () => {
    seat([card('a', 9), card('b', 9), card('c', 5), card('d', 9)]);
    useGameStore.getState().selectRank('b');
    expect(selected()).toEqual(['a', 'b', 'd']);
  });

  test('it replaces a selection of another rank', () => {
    seat([card('a', 9), card('b', 9), card('c', 5)]);
    useGameStore.getState().toggleSelect('c');
    useGameStore.getState().selectRank('a');
    expect(selected()).toEqual(['a', 'b']);
  });

  test('holding again clears the set; a tap can still hold one back', () => {
    seat([card('a', 9), card('b', 9), card('c', 9)]);
    useGameStore.getState().selectRank('a');
    useGameStore.getState().toggleSelect('c');
    expect(selected()).toEqual(['a', 'b']);
    // Part of the set is selected: holding completes it, then clears it.
    useGameStore.getState().selectRank('a');
    expect(selected()).toEqual(['a', 'b', 'c']);
    useGameStore.getState().selectRank('a');
    expect(selected()).toEqual([]);
  });

  test('with the hand empty it works on the face-up cards', () => {
    seat([]);
    useGameStore.getState().selectRank('u1');
    expect(selected()).toEqual(['u1', 'u2']);
  });

  test('face-up cards are left alone while there is still a hand', () => {
    seat([card('a', 9)]);
    useGameStore.getState().selectRank('u1');
    expect(selected()).toEqual([]);
  });
});
