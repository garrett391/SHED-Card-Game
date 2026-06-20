import {
  canPlayCardOnTop,
  checkFourOfAKindBurn,
  findStartingPlayer,
  getEffectiveTopCard,
  isPowerCard,
} from '../rules';
import {
  createGame,
  finishSwap,
  getPlaySource,
  hasPlayableMove,
  pickupPile,
  playCards,
} from '../engine';
import { Card, GameState, Player, Rank, Suit } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────
function card(rank: Rank, suit: Suit = '♠', id = `${rank}${suit}`): Card {
  return { id, rank, suit };
}
function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 0,
    name: 'P',
    isBot: false,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    ...overrides,
  };
}

/**
 * Force the game into the playing phase with a deterministic player setup.
 * Skips the random deal — we hand-build the state for clarity in tests.
 */
function setupGame(opts: {
  players: Player[];
  pile?: Card[];
  draw?: Card[];
  current?: number;
}): GameState {
  return {
    players: opts.players.map((p, i) => ({ ...p, id: i })),
    drawPile: opts.draw ?? [],
    playPile: opts.pile ?? [],
    burnedPile: [],
    currentPlayerIndex: opts.current ?? 0,
    direction: 1,
    phase: 'playing',
    swapsComplete: opts.players.map(() => true),
    startingPlayerIndex: opts.current ?? 0,
    pendingExtraTurn: false,
    log: [],
    winnerId: null,
    shitheadId: null,
  };
}

// ─── pure rules ──────────────────────────────────────────────────────────
describe('rules', () => {
  test('power ranks', () => {
    expect(isPowerCard(2)).toBe(true);
    expect(isPowerCard(7)).toBe(true);
    expect(isPowerCard(8)).toBe(true);
    expect(isPowerCard(10)).toBe(true);
    expect(isPowerCard(3)).toBe(false);
    expect(isPowerCard(14)).toBe(false);
  });

  test('8 is invisible — effective top skips them', () => {
    expect(getEffectiveTopCard([card(8), card(8), card(5)])?.rank).toBe(5);
    expect(getEffectiveTopCard([card(8)])).toBeNull();
    expect(getEffectiveTopCard([])).toBeNull();
  });

  test('2 and 8 always playable, even on an Ace', () => {
    const ace = card(14);
    expect(canPlayCardOnTop(card(2), ace)).toBe(true);
    expect(canPlayCardOnTop(card(8), ace)).toBe(true);
  });

  test('7 forces next card ≤ 7', () => {
    const seven = card(7);
    expect(canPlayCardOnTop(card(3), seven)).toBe(true);
    expect(canPlayCardOnTop(card(7), seven)).toBe(true);
    expect(canPlayCardOnTop(card(9), seven)).toBe(false);
    // 8 still playable (always-playable rule)
    expect(canPlayCardOnTop(card(8), seven)).toBe(true);
    // 10 cannot be played on 7
    expect(canPlayCardOnTop(card(10), seven)).toBe(false);
  });

  test('10 is playable on anything except a 7', () => {
    const ten = card(10);
    
    // Playable on lower cards
    expect(canPlayCardOnTop(ten, card(4))).toBe(true);
    
    // BUG FIX: Playable on higher face cards
    expect(canPlayCardOnTop(ten, card(12))).toBe(true); // Queen
    expect(canPlayCardOnTop(ten, card(13))).toBe(true); // King
    expect(canPlayCardOnTop(ten, card(14))).toBe(true); // Ace
    
    // Still respects the 7 rule (blocked)
    expect(canPlayCardOnTop(ten, card(7))).toBe(false);
    });

  test('meets-or-beats', () => {
    expect(canPlayCardOnTop(card(5), card(5))).toBe(true);
    expect(canPlayCardOnTop(card(6), card(5))).toBe(true);
    expect(canPlayCardOnTop(card(4), card(5))).toBe(false);
  });

  test('four-of-a-kind: straight four burns', () => {
    expect(checkFourOfAKindBurn([
      card(5, '♠', '5a'), card(5, '♥', '5b'),
      card(5, '♦', '5c'), card(5, '♣', '5d'),
    ])).toBe(true);
  });

  test('four-of-a-kind: 8 in the middle does NOT break the sequence', () => {
    // Top → bottom: 5, 8, 5, 5, 5  (Jake's example)
    expect(checkFourOfAKindBurn([
      card(5, '♠', '5a'), card(8),
      card(5, '♥', '5b'), card(5, '♦', '5c'), card(5, '♣', '5d'),
    ])).toBe(true);
  });

  test('four-of-a-kind: any non-8 between matching cards DOES break it', () => {
    expect(checkFourOfAKindBurn([
      card(5, '♠', '5a'), card(6),
      card(5, '♥', '5b'), card(5, '♦', '5c'), card(5, '♣', '5d'),
    ])).toBe(false);
  });

  test('starting player picks lowest non-power card', () => {
    const players: Player[] = [
      player({ id: 0, name: 'A', hand: [card(4), card(5), card(6)] }),
      player({ id: 1, name: 'B', hand: [card(3), card(7), card(13)] }),
      player({ id: 2, name: 'C', hand: [card(2), card(8), card(10)] }),
    ];
    // B has 3 (lowest non-power)
    expect(findStartingPlayer(players)).toBe(1);
  });

  test('starting player tiebreaks to lowest-index player', () => {
    const players: Player[] = [
      player({ id: 0, name: 'A', hand: [card(4)] }),
      player({ id: 1, name: 'B', hand: [card(4)] }),
    ];
    expect(findStartingPlayer(players)).toBe(0);
  });
});

// ─── engine integration ─────────────────────────────────────────────────
describe('engine', () => {
  test('createGame deals 3/3/3 to every player and is in swap phase', () => {
    const g = createGame([
      { name: 'A', isBot: false },
      { name: 'B', isBot: false },
      { name: 'C', isBot: true },
    ]);
    expect(g.phase).toBe('swap');
    for (const p of g.players) {
      expect(p.hand).toHaveLength(3);
      expect(p.faceUp).toHaveLength(3);
      expect(p.faceDown).toHaveLength(3);
    }
    // 52 − (9 × 3) = 25 cards left in draw pile
    expect(g.drawPile).toHaveLength(52 - 9 * 3);
  });

  test('finishing swap for all players starts play', () => {
    let g = createGame([
      { name: 'A', isBot: false },
      { name: 'B', isBot: false },
    ]);
    g = finishSwap(g, 0);
    expect(g.phase).toBe('swap');
    g = finishSwap(g, 1);
    expect(g.phase).toBe('playing');
    expect(g.currentPlayerIndex).toBe(g.startingPlayerIndex);
  });

  test('rejects play of a card lower than the top', () => {
    const g = setupGame({
      players: [player({ hand: [card(3)] }), player()],
      pile: [card(9)],
    });
    const { state } = playCards(g, 0, [card(3).id]);
    // No move applied: card still in hand, pile unchanged
    expect(state.players[0].hand).toHaveLength(1);
    expect(state.playPile).toHaveLength(1);
    expect(state.currentPlayerIndex).toBe(0);
  });

  test('playing a 10 burns the pile and grants an extra turn', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(10), card(5), card(6)] }),
        player({ hand: [card(7)] }),
      ],
      pile: [card(9)],
    });
    const { state, events } = playCards(g, 0, [card(10).id]);
    expect(state.playPile).toHaveLength(0);
    expect(events.some(e => e.type === 'pileBurned' && e.reason === 'ten')).toBe(true);
    expect(state.currentPlayerIndex).toBe(0); // extra turn
  });

  test('playing a 2 lets any card follow on the next turn', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(2)], faceDown: [card(11)] }),
        player({ hand: [card(3)], faceDown: [card(12)] }),
      ],
      pile: [card(13)], // King
    });
    const r = playCards(g, 0, [card(2).id]);
    expect(r.state.currentPlayerIndex).toBe(1);
    // Player 2 can now play their 3
    const r2 = playCards(r.state, 1, [card(3).id]);
    expect(r2.state.playPile[0].rank).toBe(3);
  });

  test('an 8 keeps the under-card as effective top', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(8)], faceDown: [card(11)] }),
        player({ hand: [card(3), card(9)] }),
      ],
      pile: [card(5)],
    });
    const r = playCards(g, 0, [card(8).id]);
    // Effective top should still be 5, so a 3 is illegal but 9 is legal.
    expect(getEffectiveTopCard(r.state.playPile)?.rank).toBe(5);
    const r2 = playCards(r.state, 1, [card(3).id]);
    // 3 invalid → no-op
    expect(r2.state.playPile.length).toBe(2);
    const r3 = playCards(r.state, 1, [card(9).id]);
    expect(r3.state.playPile[0].rank).toBe(9);
  });

  test('multi-card same-rank play unloads multiple cards', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(5, '♠', '5a'), card(5, '♥', '5b'), card(7)] }),
        player({ hand: [card(9)] }),
      ],
      pile: [card(4)],
    });
    const { state } = playCards(g, 0, ['5a', '5b']);
    expect(state.players[0].hand).toEqual([card(7)]);
    expect(state.playPile.slice(0, 2).every(c => c.rank === 5)).toBe(true);
  });

  test('four matching cards across turns (with an 8 mixed in) burn', () => {
    // P0 has three 5s; P1 plays an 8; P0 plays a 5 → burn.
    const g = setupGame({
      players: [
        player({
          hand: [
            card(5, '♠', '5a'), card(5, '♥', '5b'),
            card(5, '♦', '5c'), card(5, '♣', '5d'),
          ],
        }),
        player({ hand: [card(8)], faceDown: [card(11)] }),
      ],
      pile: [card(4)],
    });
    const r1 = playCards(g, 0, ['5a', '5b', '5c']);
    expect(r1.state.currentPlayerIndex).toBe(1);
    const r2 = playCards(r1.state, 1, [card(8).id]);
    expect(r2.state.currentPlayerIndex).toBe(0);
    const r3 = playCards(r2.state, 0, ['5d']);
    expect(r3.state.playPile).toHaveLength(0);
    expect(r3.events.some(e => e.type === 'pileBurned' && e.reason === 'fourOfKind')).toBe(true);
    expect(r3.state.currentPlayerIndex).toBe(0); // burn = extra turn
  });

  test('player draws back to 3 after playing from hand while draw pile has cards', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(9)] }),
        player({ hand: [card(13)] }),
      ],
      pile: [card(4)],
      draw: [card(11, '♠', 'J'), card(12, '♥', 'Q')], // last popped first
    });
    const { state } = playCards(g, 0, [card(9).id]);
    expect(state.players[0].hand).toHaveLength(2);
    expect(state.drawPile).toHaveLength(0);
  });

  test('pickupPile transfers entire pile to hand and ends turn', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(3)] }),
        player(),
      ],
      pile: [card(11), card(9), card(5)],
    });
    const { state } = pickupPile(g, 0);
    expect(state.players[0].hand).toHaveLength(4);
    expect(state.playPile).toHaveLength(0);
    expect(state.currentPlayerIndex).toBe(1);
  });

  test('hand → face-up phase transition is automatic when hand and draw empty', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(11)], faceUp: [card(5), card(6), card(7)] }),
        player({ hand: [card(13)] }),
      ],
      pile: [card(4)],
    });
    const { state } = playCards(g, 0, [card(11).id]);
    // Hand and draw both empty → source should now be faceUp.
    expect(getPlaySource(state.players[0])).toBe('faceUp');
  });

  test('face-down failed flip picks up pile and adds the card to hand', () => {
    const g = setupGame({
      players: [
        player({ faceDown: [card(3, '♠', '3fd')] }),
        player({ hand: [card(5)] }),
      ],
      pile: [card(11)], // Jack, higher than the 3
    });
    const { state, events } = playCards(g, 0, ['3fd']);
    expect(state.players[0].hand).toHaveLength(2); // pile (J) + flipped 3
    expect(state.players[0].faceDown).toHaveLength(0);
    expect(state.playPile).toHaveLength(0);
    expect(events.some(e => e.type === 'faceDownFlipFailed')).toBe(true);
    expect(state.currentPlayerIndex).toBe(1);
  });

  test('emptying all piles wins; last with cards is the shithead', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(13)] }),               // about to go out
        player({ hand: [card(3)], faceUp: [card(5)] }),
      ],
      pile: [card(4)],
    });
    const { state } = playCards(g, 0, [card(13).id]);
    expect(state.phase).toBe('gameOver');
    expect(state.winnerId).toBe(0);
    expect(state.shitheadId).toBe(1);
  });

  test('hasPlayableMove is false when no card beats the top', () => {
    const g = setupGame({
      players: [
        player({ hand: [card(3), card(4), card(5)] }),
        player(),
      ],
      pile: [card(13)],
    });
    expect(hasPlayableMove(g, 0)).toBe(false);
  });
});
