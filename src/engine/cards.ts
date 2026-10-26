import { Card, JokerKind, Rank, Suit } from './types';

/** Rank given to jokers. Above the ace, so a sorted hand puts them last. */
export const JOKER_RANK = 15 as const;

const SUITS: readonly Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Build a fresh, ordered deck. Supports combining multiple decks with
 *  explicit namespacing. With `jokers`, each deck adds a red reverse joker
 *  and a black swap joker. */
export function createDeck(deckCount = 1, jokers = false): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        // Namespaced ID format like "d0-r14-s♠" for bulletproof multiplayer logs
        deck.push({ id: `d${d}-r${rank}-s${suit}`, rank, suit });
      }
    }
    if (jokers) {
      deck.push({ id: `d${d}-joker-reverse`, rank: JOKER_RANK, suit: '♥', joker: 'reverse' });
      deck.push({ id: `d${d}-joker-swap`, rank: JOKER_RANK, suit: '♠', joker: 'swap' });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle, returns a new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rankLabel(rank: Rank): string {
  if (rank === JOKER_RANK) return 'Joker';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return String(rank);
}

export function isRedSuit(suit: Suit): boolean {
  return suit === '♥' || suit === '♦';
}

export function jokerLabel(kind: JokerKind): string {
  return kind === 'reverse' ? 'Reverse Joker' : 'Swap Joker';
}

export function cardLabel(card: Card): string {
  if (card.joker) return jokerLabel(card.joker);
  return `${rankLabel(card.rank)}${card.suit}`;
}
