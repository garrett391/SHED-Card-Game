import { Card, Rank, Suit } from './types';

const SUITS: readonly Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Build a fresh, ordered deck (no jokers). Supports combining multiple decks. */
export function createDeck(deckCount = 1): Card[] {
  const deck: Card[] = [];
  let i = 0;
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `c${i++}`, rank, suit });
      }
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
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return String(rank);
}

export function isRedSuit(suit: Suit): boolean {
  return suit === '♥' || suit === '♦';
}

export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${card.suit}`;
}
