import {
  canPlayCardOnTop,
  checkFourOfAKindBurn,
  checkTripleTransparentBurn,
  findStartingPlayer,
  getEffectiveTopCard,
  isPowerCard,
  DEFAULT_RULES,
} from '../rules';
import {
  createGame,
  finishSwap,
  getPlaySource,
  hasPlayableMove,
  pickupPile,
  playCards,
  rulesFor,
  swapTargets,
  getPlayableCardIds,
} from '../engine';
import { getPreset } from '../../campaign/presets';
import { seedRandom } from '../../testing/seededRandom';
import { createDeck, JOKER_RANK } from '../cards';
import { decideBotAction } from '../../ai/bot';
import { Card, GameState, Player, Rank, RuleConfig, Suit } from '../types';

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

/** Build a RuleConfig by overriding specific flags on the default ruleset. */
function rules(overrides: Partial<RuleConfig>): RuleConfig {
  return { ...DEFAULT_RULES, ...overrides };
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
  ruleConfig?: RuleConfig;
}): GameState {
  const ruleConfig = opts.ruleConfig ?? DEFAULT_RULES;
  return {
    players: opts.players.map((p, i) => ({ ...p, id: i })),
    deckCount: opts.players.length > 4 ? 2 : 1,
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
    lastManStanding: ruleConfig.lastManStanding,
    ruleConfig,
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

  test('four-of-a-kind: four 8s at the top burns', () => {
    expect(checkFourOfAKindBurn([
      card(8, '♠', '8a'), card(8, '♥', '8b'),
      card(8, '♦', '8c'), card(8, '♣', '8d'),
    ])).toBe(true);
  });

  test('four-of-a-kind: three 8s is not enough to burn', () => {
    expect(checkFourOfAKindBurn([
      card(8, '♠', '8a'), card(8, '♥', '8b'), card(8, '♦', '8c'),
    ])).toBe(false);
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

  test("createGame carries each bot's play style onto its player", () => {
    const g = createGame([
      { name: 'A', isBot: false },
      { name: 'B', isBot: true, botStyle: 'novice' },
      { name: 'C', isBot: true },
    ]);
    expect(g.players.map((p) => p.botStyle)).toEqual([undefined, 'novice', undefined]);
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
    expect(events.some(e => e.type === 'pileBurned' && e.reason === 'burnRank')).toBe(true);
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

  test('playing four 8s burns the pile and grants an extra turn', () => {
    const g = setupGame({
      players: [
        player({
          hand: [
            card(8, '♠', '8a'), card(8, '♥', '8b'),
            card(8, '♦', '8c'), card(8, '♣', '8d'),
          ],
        }),
        player({ hand: [card(5)] }),
      ],
      pile: [card(9)],
    });
    const { state, events } = playCards(g, 0, ['8a', '8b', '8c', '8d']);
    expect(state.playPile).toHaveLength(0);
    expect(events.some(e => e.type === 'pileBurned' && e.reason === 'fourOfKind')).toBe(true);
    expect(state.currentPlayerIndex).toBe(0); // extra turn
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
    const g: GameState = {
      ...setupGame({
        players: [
          player({ hand: [card(13)] }),               // about to go out
          player({ hand: [card(3)], faceUp: [card(5)] }),
        ],
        pile: [card(4)],
      }),
      lastManStanding: true,
    };
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

  test('createGame handles 6 players by using 2 decks (104 cards) and finishes swap without crashing', () => {
    let g = createGame([
      { name: 'P1', isBot: false },
      { name: 'P2', isBot: false },
      { name: 'P3', isBot: false },
      { name: 'P4', isBot: false },
      { name: 'P5', isBot: false },
      { name: 'P6', isBot: false },
    ]);
    
    expect(g.phase).toBe('swap');
    expect(g.deckCount).toBe(2);
    
    // Each of the 6 players must have fully loaded 3/3/3 piles
    for (const p of g.players) {
      expect(p.hand).toHaveLength(3);
      expect(p.faceUp).toHaveLength(3);
      expect(p.faceDown).toHaveLength(3);
    }
    // 104 total cards - (6 players * 9 cards each) = 50 remaining in draw pile
    expect(g.drawPile).toHaveLength(104 - 6 * 9);

    // Verify everything works cleanly when finishing swaps and finding starting player
    for (let i = 0; i < 6; i++) {
      g = finishSwap(g, i);
    }
    expect(g.phase).toBe('playing');
  });
});

// ─── rule variants ───────────────────────────────────────────────────────
// One focused test per behavioral flag added by the rule-presets refactor.
// Each builds an isolated RuleConfig via rules({ ... }) so only the flag under
// test differs from Jake's Classic.
describe('rule variants', () => {
  // ── Hard Eights (Justin's Schism) ──────────────────────────────────────
  describe('hardEights', () => {
    const cfg = rules({ hardEights: true });

    test('transparent (8) cannot be played on the lowerThan card (7)', () => {
      expect(canPlayCardOnTop(card(8), card(7), cfg)).toBe(false);
    });

    test('reset (2) is still always playable on a 7', () => {
      expect(canPlayCardOnTop(card(2), card(7), cfg)).toBe(true);
    });

    test('8 is still playable on a non-7 (e.g. a 6)', () => {
      expect(canPlayCardOnTop(card(8), card(6), cfg)).toBe(true);
    });

    test('contrast: with default rules, 8 plays freely on a 7', () => {
      expect(canPlayCardOnTop(card(8), card(7), DEFAULT_RULES)).toBe(true);
    });
  });

  // ── Super Tens (burnRankOverridesLowerThan) ────────────────────────────
  describe('burnRankOverridesLowerThan', () => {
    const cfg = rules({ burnRankOverridesLowerThan: true });

    test('burn card (10) can be played on the lowerThan card (7)', () => {
      expect(canPlayCardOnTop(card(10), card(7), cfg)).toBe(true);
    });

    test('a non-burn card is still blocked by the lowerThan rule', () => {
      expect(canPlayCardOnTop(card(9), card(7), cfg)).toBe(false);
    });

    test('contrast: with default rules, 10 is blocked on a 7', () => {
      expect(canPlayCardOnTop(card(10), card(7), DEFAULT_RULES)).toBe(false);
    });
  });

  // ── Burn card restricted on face cards ─────────────────────────────────
  describe('burnRankRestricted', () => {
    const cfg = rules({ burnRankRestricted: true });

    test('burn card (10) cannot be played on a face card (J/Q/K/A)', () => {
      expect(canPlayCardOnTop(card(10), card(11), cfg)).toBe(false); // Jack
      expect(canPlayCardOnTop(card(10), card(12), cfg)).toBe(false); // Queen
      expect(canPlayCardOnTop(card(10), card(13), cfg)).toBe(false); // King
      expect(canPlayCardOnTop(card(10), card(14), cfg)).toBe(false); // Ace
    });

    test('burn card (10) is still playable on a number card', () => {
      expect(canPlayCardOnTop(card(10), card(5), cfg)).toBe(true);
    });

    test('contrast: with default rules, 10 plays on a Jack', () => {
      expect(canPlayCardOnTop(card(10), card(11), DEFAULT_RULES)).toBe(true);
    });
  });

  // ── reverseRank (Chaos Shed): direction flips and persists ─────────────
  describe('reverseRank', () => {
    const cfg = rules({ reverseRank: 9 });

    test('playing the reverse rank flips direction and it persists across turns', () => {
      // 3 players so a direction flip is observable in turn order.
      const g = setupGame({
        players: [
          player({ hand: [card(9, '♠', '9p0'), card(3), card(4)] }),
          player({ hand: [card(5)] }),
          player({ hand: [card(11, '♠', 'Jp2'), card(2)] }),
        ],
        pile: [card(4)],
        ruleConfig: cfg,
      });

      // P0 plays a 9 → direction reverses to -1, turn passes to P2 (0 - 1 mod 3).
      const r1 = playCards(g, 0, ['9p0']);
      expect(r1.state.direction).toBe(-1);
      expect(r1.state.currentPlayerIndex).toBe(2);
      expect(r1.events.some(e => e.type === 'directionReversed')).toBe(true);

      // P2 plays a plain Jack → direction STAYS -1, turn passes to P1.
      const r2 = playCards(r1.state, 2, ['Jp2']);
      expect(r2.state.direction).toBe(-1);
      expect(r2.state.currentPlayerIndex).toBe(1);
      expect(r2.events.some(e => e.type === 'directionReversed')).toBe(false);
    });
  });

  // ── reverseRankWild: wild vs ordered reverse card ───────────────────────
  describe('reverseRankWild', () => {
    test('ordered reverse rank (default) obeys meets-or-beats', () => {
      const cfg = rules({ reverseRank: 9, reverseRankWild: false });
      // 9 on a K is an illegal play when the reverse rank is ordered.
      expect(canPlayCardOnTop(card(9), card(13), cfg)).toBe(false);
      // ...but legal on lower ranks, as any 9 would be.
      expect(canPlayCardOnTop(card(9), card(5), cfg)).toBe(true);
    });

    test('wild reverse rank is always playable', () => {
      const cfg = rules({ reverseRank: 9, reverseRankWild: true });
      expect(canPlayCardOnTop(card(9), card(13), cfg)).toBe(true);
      expect(canPlayCardOnTop(card(9), card(14), cfg)).toBe(true);
    });

    test('wild reverse rank counts as a power card; ordered does not', () => {
      const wild = rules({ reverseRank: 9, reverseRankWild: true });
      const ordered = rules({ reverseRank: 9, reverseRankWild: false });
      expect(isPowerCard(9, wild)).toBe(true);
      expect(isPowerCard(9, ordered)).toBe(false);
    });

    test('Chaos Shed uses jokers, not a reverse rank', () => {
      const preset = getPreset('chaos-shed');
      expect(preset.jokers).toBe(true);
      expect(preset.reverseRank).toBeNull();
    });
  });

  // ── playRejected: illegal plays surface a reason ────────────────────────
  describe('playRejected event', () => {
    test('illegal play emits playRejected with a player-facing reason; state unchanged', () => {
      const p0 = player({ hand: [card(5, '♠', '5s')] });
      const p1 = player({ hand: [card(6)] });
      const state = setupGame({ players: [p0, p1], pile: [card(13, '♦', 'top')] });
      const r = playCards(state, 0, ['5s']); // 5 on a K — illegal
      expect(r.state).toBe(state);
      expect(r.events).toHaveLength(1);
      expect(r.events[0]).toMatchObject({ type: 'playRejected', playerId: 0 });
      expect(r.events[0].type === 'playRejected' && r.events[0].reason).toMatch(/Cannot play 5 on K/);
    });

    test('legal play emits no playRejected', () => {
      const p0 = player({ hand: [card(5, '♠', '5s'), card(9, '♥', '9h')] });
      const p1 = player({ hand: [card(6)] });
      const state = setupGame({ players: [p0, p1], pile: [card(4, '♦', 'top')] });
      const r = playCards(state, 0, ['5s']);
      expect(r.events.some((e) => e.type === 'playRejected')).toBe(false);
      expect(r.events.some((e) => e.type === 'cardsPlayed')).toBe(true);
    });
  });

  // ── strict card-ID resolution: no silent partial plays ──────────────────
  describe('playCards ID validation', () => {
    test('rejects the whole move if any requested ID is not in the source', () => {
      const p0 = player({ hand: [card(5, '♠', '5s'), card(5, '♥', '5h')] });
      const p1 = player({ hand: [card(6)] });
      const state = setupGame({ players: [p0, p1] });
      const r = playCards(state, 0, ['5s', 'not-a-card']);
      expect(r.events).toHaveLength(0);
      expect(r.state).toBe(state); // unchanged — nothing played
    });

    test('rejects duplicate IDs instead of double-resolving one card', () => {
      const p0 = player({ hand: [card(5, '♠', '5s'), card(6, '♥', '6h')] });
      const p1 = player({ hand: [card(6)] });
      const state = setupGame({ players: [p0, p1] });
      const r = playCards(state, 0, ['5s', '5s']);
      expect(r.events).toHaveLength(0);
      expect(r.state).toBe(state);
    });

    test('does NOT reject two-deck games: same rank+suit but distinct namespaced IDs play fine', () => {
      // Mirrors createDeck()'s real ID scheme (`d${deckIndex}-r${rank}-s${suit}`).
      // A 5-6 player game uses 2 decks, so two physically distinct 6♣ cards can
      // legitimately coexist in one hand — they must NOT be treated as duplicates
      // just because rank/suit match; only a literal repeated ID is rejected.
      const sixOfClubsDeckA = card(6, '♣', 'd0-r6-s♣');
      const sixOfClubsDeckB = card(6, '♣', 'd1-r6-s♣');
      const p0 = player({ hand: [sixOfClubsDeckA, sixOfClubsDeckB] });
      const p1 = player({ hand: [card(7)] });
      const state = setupGame({ players: [p0, p1] });
      const r = playCards(state, 0, ['d0-r6-s♣', 'd1-r6-s♣']);
      const played = r.events.find((e) => e.type === 'cardsPlayed');
      expect(played).toBeDefined();
      expect(played && played.type === 'cardsPlayed' && played.cards).toHaveLength(2);
      expect(r.state.players[0].hand).toHaveLength(0);
    });
  });

  // ── sixNineReverse (The 69): 9-on-6 reverses, 9-on-5 does not ──────────
  describe('sixNineReverse', () => {
    const cfg = rules({ sixNineReverse: true });

    test('playing a 9 on a 6 reverses direction', () => {
      const g = setupGame({
        players: [
          player({ hand: [card(9, '♠', '9a'), card(3), card(4)] }),
          player({ hand: [card(5)] }),
          player({ hand: [card(7)] }),
        ],
        pile: [card(6)],
        ruleConfig: cfg,
      });
      const r = playCards(g, 0, ['9a']);
      expect(r.state.direction).toBe(-1);
      expect(r.state.currentPlayerIndex).toBe(2);
      expect(r.events.some(e => e.type === 'directionReversed')).toBe(true);
    });

    test('playing a 9 on a 5 does NOT reverse direction', () => {
      const g = setupGame({
        players: [
          player({ hand: [card(9, '♠', '9b'), card(3), card(4)] }),
          player({ hand: [card(5)] }),
          player({ hand: [card(7)] }),
        ],
        pile: [card(5)],
        ruleConfig: cfg,
      });
      const r = playCards(g, 0, ['9b']);
      expect(r.state.direction).toBe(1);
      expect(r.state.currentPlayerIndex).toBe(1);
      expect(r.events.some(e => e.type === 'directionReversed')).toBe(false);
    });
  });

  // ── The !reversed guard: reverseRank + sixNineReverse don't double-flip ─
  describe('reverseRank + sixNineReverse together', () => {
    const cfg = rules({ reverseRank: 9, sixNineReverse: true });

    test('playing a 9 on a 6 reverses exactly once (no double-flip)', () => {
      const g = setupGame({
        players: [
          player({ hand: [card(9, '♠', '9c'), card(3), card(4)] }),
          player({ hand: [card(5)] }),
          player({ hand: [card(7)] }),
        ],
        pile: [card(6)],
        ruleConfig: cfg,
      });
      const r = playCards(g, 0, ['9c']);
      // A single net flip: -1, not back to 1.
      expect(r.state.direction).toBe(-1);
      // And only ONE directionReversed event, not two.
      const reversals = r.events.filter(e => e.type === 'directionReversed');
      expect(reversals).toHaveLength(1);
    });
  });

  // ── tripleTransparentBurns (OFCOM): three 8s burn, two don't ───────────
  describe('tripleTransparentBurns', () => {
    const cfg = rules({ tripleTransparentBurns: true });

    test('pure check: three consecutive transparents burn', () => {
      expect(checkTripleTransparentBurn(
        [card(8, '♠', '8a'), card(8, '♥', '8b'), card(8, '♦', '8c')],
        cfg,
      )).toBe(true);
    });

    test('pure check: two transparents do not burn', () => {
      expect(checkTripleTransparentBurn(
        [card(8, '♠', '8a'), card(8, '♥', '8b')],
        cfg,
      )).toBe(false);
    });

    test('pure check: a non-transparent breaking the run prevents the burn', () => {
      expect(checkTripleTransparentBurn(
        [card(8, '♠', '8a'), card(8, '♥', '8b'), card(5), card(8, '♦', '8c')],
        cfg,
      )).toBe(false);
    });

    test('pure check: disabled by default', () => {
      expect(checkTripleTransparentBurn(
        [card(8, '♠', '8a'), card(8, '♥', '8b'), card(8, '♦', '8c')],
        DEFAULT_RULES,
      )).toBe(false);
    });

    test('engine: playing the third 8 burns the pile and grants an extra turn', () => {
      const g = setupGame({
        players: [
          player({ hand: [card(8, '♦', '8z'), card(3), card(4)] }),
          player({ hand: [card(5)] }),
        ],
        pile: [card(8, '♠', '8x'), card(8, '♥', '8y')],
        ruleConfig: cfg,
      });
      const { state, events } = playCards(g, 0, ['8z']);
      expect(state.playPile).toHaveLength(0);
      expect(events.some(
        e => e.type === 'pileBurned' && e.reason === 'tripleTransparent',
      )).toBe(true);
      expect(state.currentPlayerIndex).toBe(0); // extra turn
    });

    test('engine: playing only the second 8 does NOT burn', () => {
      const g = setupGame({
        players: [
          player({ hand: [card(8, '♥', '8y'), card(3), card(4)] }),
          player({ hand: [card(5)] }),
        ],
        pile: [card(8, '♠', '8x')],
        ruleConfig: cfg,
      });
      const { state, events } = playCards(g, 0, ['8y']);
      expect(state.playPile).toHaveLength(2);
      expect(events.some(e => e.type === 'pileBurned')).toBe(false);
    });
  });

  // ── burnRank rename: pileBurned reason is 'burnRank', not 'ten' ─────────
  describe('burnRank event reason', () => {
    test('burning with the burn rank reports reason "burnRank"', () => {
      const g = setupGame({
        players: [
          player({ hand: [card(10), card(5), card(6)] }),
          player({ hand: [card(7)] }),
        ],
        pile: [card(9)],
      });
      const { events } = playCards(g, 0, [card(10).id]);
      expect(events.some(
        e => e.type === 'pileBurned' && e.reason === 'burnRank',
      )).toBe(true);
    });
  });

  // ── lastManStanding wired from config ──────────────────────────────────
  describe('lastManStanding from config', () => {
    test('createGame copies ruleConfig.lastManStanding onto state', () => {
      const on = createGame(
        [{ name: 'A', isBot: false }, { name: 'B', isBot: false }],
        rules({ lastManStanding: true }),
      );
      expect(on.lastManStanding).toBe(true);
      expect(on.ruleConfig.lastManStanding).toBe(true);

      const off = createGame(
        [{ name: 'A', isBot: false }, { name: 'B', isBot: false }],
        rules({ lastManStanding: false }),
      );
      expect(off.lastManStanding).toBe(false);
    });

    test('a stacked config (every variant flag on) enables lastManStanding end-to-end', () => {
      const stacked = rules({
        reverseRank: 9,
        reverseRankWild: false,
        tripleTransparentBurns: true,
        hardEights: true,
        burnRankRestricted: true,
        lastManStanding: true,
      });
      const g = createGame(
        [{ name: 'A', isBot: false }, { name: 'B', isBot: false }],
        stacked,
      );
      expect(g.lastManStanding).toBe(true);
    });
  });

  // ── Jokers (Chaos Shed) ─────────────────────────────────────────────────
  describe('jokers', () => {
    const J = rules({ jokers: true });
    const revJ = (id = 'jr'): Card => ({ id, rank: JOKER_RANK, suit: '♥', joker: 'reverse' });
    const swapJ = (id = 'js'): Card => ({ id, rank: JOKER_RANK, suit: '♠', joker: 'swap' });

    test('a deck with jokers has 54 cards: one reverse, one swap', () => {
      const deck = createDeck(1, true);
      expect(deck).toHaveLength(54);
      expect(deck.filter(c => c.joker === 'reverse')).toHaveLength(1);
      expect(deck.filter(c => c.joker === 'swap')).toHaveLength(1);
      expect(createDeck(2, true).filter(c => c.joker)).toHaveLength(4);
      expect(createDeck(1)).toHaveLength(52);
    });

    test('createGame deals from a joker deck when the config asks', () => {
      const g = createGame(
        [{ name: 'A', isBot: false }, { name: 'B', isBot: false }],
        J,
      );
      const all = [...g.drawPile, ...g.players.flatMap(p => [...p.hand, ...p.faceUp, ...p.faceDown])];
      expect(all).toHaveLength(54);
    });

    test('jokers are wild and invisible on the pile', () => {
      expect(canPlayCardOnTop(revJ(), card(14), J)).toBe(true);
      expect(canPlayCardOnTop(swapJ(), card(7), J)).toBe(true);
      expect(getEffectiveTopCard([revJ(), card(9)], J)?.rank).toBe(9);
      expect(isPowerCard(JOKER_RANK, J)).toBe(true);
    });

    test('jokers do not break a four-of-a-kind', () => {
      expect(checkFourOfAKindBurn([card(5), revJ(), card(5), card(5), card(5)], J)).toBe(true);
    });

    test('reverse joker flips the direction of play', () => {
      const state = setupGame({
        players: [
          player({ hand: [revJ(), card(5)] }),
          player({ hand: [card(6)] }),
          player({ hand: [card(6)] }),
        ],
        ruleConfig: J,
      });
      const r = playCards(state, 0, ['jr']);
      expect(r.state.direction).toBe(-1);
      expect(r.state.currentPlayerIndex).toBe(2);
      expect(r.events.some(e => e.type === 'directionReversed')).toBe(true);
    });

    test('swap joker trades hands with the chosen player, after drawing', () => {
      const state = setupGame({
        players: [
          player({ hand: [swapJ(), card(5, '♠', 'mine')] }),
          player({ hand: [card(6, '♠', 'b1')] }),
          player({ hand: [card(9, '♠', 'c1'), card(9, '♥', 'c2')] }),
        ],
        draw: [card(4, '♣', 'drawn')],
        ruleConfig: J,
      });
      const r = playCards(state, 0, ['js'], { swapTargetId: 2 });
      expect(r.state.players[0].hand.map(c => c.id)).toEqual(['c1', 'c2']);
      expect(r.state.players[2].hand.map(c => c.id).sort()).toEqual(['drawn', 'mine']);
      expect(r.state.players[1].hand.map(c => c.id)).toEqual(['b1']);
      expect(r.events).toContainEqual({ type: 'handsSwapped', playerId: 0, targetId: 2 });
      expect(r.state.currentPlayerIndex).toBe(1);
    });

    test('swap joker without a valid target goes to the next player', () => {
      const state = setupGame({
        players: [
          player({ hand: [swapJ(), card(5, '♠', 'mine')] }),
          player({ hand: [card(6, '♠', 'b1')] }),
        ],
        ruleConfig: J,
      });
      const r = playCards(state, 0, ['js'], { swapTargetId: 0 }); // self: invalid
      expect(r.state.players[0].hand.map(c => c.id)).toEqual(['b1']);
      expect(r.state.players[1].hand.map(c => c.id)).toEqual(['mine']);
    });

    test('swapping away your last cards for an empty hand puts you out', () => {
      const state = setupGame({
        players: [
          player({ hand: [swapJ(), card(5, '♠', 'mine')] }),
          player({ hand: [], faceUp: [card(6)] }),
        ],
        ruleConfig: J,
      });
      const r = playCards(state, 0, ['js'], { swapTargetId: 1 });
      expect(r.state.players[0].isFinished).toBe(true);
      expect(r.state.winnerId).toBe(0);
      expect(r.state.players[1].hand.map(c => c.id)).toEqual(['mine']);
    });

    test('no swap when the joker was your last card', () => {
      const state = setupGame({
        players: [player({ hand: [swapJ()] }), player({ hand: [card(6, '♠', 'b1')] })],
        ruleConfig: J,
      });
      const r = playCards(state, 0, ['js']);
      expect(r.state.players[0].isFinished).toBe(true);
      expect(r.events.some(e => e.type === 'handsSwapped')).toBe(false);
    });

    test('swapTargets lists active opponents only', () => {
      const state = setupGame({
        players: [player({ hand: [card(3)] }), player({ isFinished: true }), player({ hand: [card(4)] })],
        ruleConfig: J,
      });
      expect(swapTargets(state, 0)).toEqual([2]);
    });

    test('bot playing a swap joker targets the smallest hand', () => {
      const state = setupGame({
        players: [
          player({ hand: [swapJ()], isBot: true }),
          player({ hand: [card(6), card(7), card(9)] }),
          player({ hand: [card(4)] }),
        ],
        pile: [card(14)], // only the joker is playable
        ruleConfig: J,
      });
      const action = decideBotAction(state, 0);
      expect(action).toEqual({ type: 'play', cardIds: ['js'], swapTargetId: 2 });
    });
  });

  // ── Seat rules (the Council) ────────────────────────────────────────────
  describe('seat rules', () => {
    const superTens = getPreset('super-tens');

    test('each seat plays by its own rules on its own turn', () => {
      const state = setupGame({
        players: [
          player({ hand: [card(10, '♥', 'mine'), card(4)] }),
          player({ hand: [card(10, '♠', 'gregs'), card(4, '♣')], rules: superTens }),
        ],
        pile: [card(7)],
      });
      // Classic seat: a 10 can't go on a 7.
      expect(getPlayableCardIds(state, 0)).toEqual(['4♠']);
      // Super Tens seat: it can.
      expect(getPlayableCardIds({ ...state, currentPlayerIndex: 1 }, 1)).toContain('gregs');
      const r = playCards({ ...state, currentPlayerIndex: 1 }, 1, ['gregs']);
      expect(r.events.some(e => e.type === 'pileBurned')).toBe(true);
    });

    test('rulesFor falls back to the table rules', () => {
      const state = setupGame({ players: [player(), player({ rules: superTens })] });
      expect(rulesFor(state, 0)).toBe(state.ruleConfig);
      expect(rulesFor(state, 1)).toBe(superTens);
    });

    test('createGame keeps seat rules and adds jokers if any seat uses them', () => {
      const g = createGame([
        { name: 'A', isBot: false },
        { name: 'B', isBot: true, rules: getPreset('chaos-shed') },
      ]);
      expect(g.players[1].rules?.id).toBe('chaos-shed');
      expect(g.players[0].rules).toBeUndefined();
      const all = [...g.drawPile, ...g.players.flatMap(p => [...p.hand, ...p.faceUp, ...p.faceDown])];
      expect(all.filter(c => c.joker)).toHaveLength(2);
    });

    test('a full Council game finishes: five seats, mixed rules, two decks', () => {
      const restore = seedRandom(2026); // bot-only games: see seededRandom.ts
      const council = getPreset('the-council');
      for (let n = 0; n < 50; n++) {
        let g = createGame([
          { name: 'You', isBot: true },
          { name: 'Justin', isBot: true, rules: getPreset('justins-schism') },
          { name: 'Greg', isBot: true, rules: superTens },
          { name: 'Gio', isBot: true, rules: getPreset('chaos-shed') },
          { name: 'Tati', isBot: true, rules: getPreset('chaos-shed') },
        ], council);
        for (let i = 0; i < 5; i++) g = finishSwap(g, i);
        let turns = 0;
        while (g.phase === 'playing' && turns++ < 5000) {
          const a = decideBotAction(g, g.currentPlayerIndex);
          g = a.type === 'pickup'
            ? pickupPile(g, g.currentPlayerIndex).state
            : playCards(g, g.currentPlayerIndex, a.cardIds, { swapTargetId: a.swapTargetId }).state;
        }
        expect(g.phase).toBe('gameOver');
      }
      restore();
    });
  });

  // ── Removed ranks (the Second Schism) ───────────────────────────────────
  describe('removed ranks', () => {
    test('the Second Schism deals a deck with no 8s', () => {
      const g = createGame(
        [{ name: 'A', isBot: false }, { name: 'B', isBot: true }, { name: 'C', isBot: true }, { name: 'D', isBot: true }],
        getPreset('second-schism'),
      );
      const all = [...g.drawPile, ...g.players.flatMap(p => [...p.hand, ...p.faceUp, ...p.faceDown])];
      expect(all).toHaveLength(48);
      expect(all.some(c => c.rank === 8)).toBe(false);
    });

    test('Second Schism games still finish', () => {
      const restore = seedRandom(8); // bot-only games: see seededRandom.ts
      for (let n = 0; n < 50; n++) {
        let g = createGame(
          [{ name: 'A', isBot: true }, { name: 'B', isBot: true }, { name: 'C', isBot: true }, { name: 'D', isBot: true }],
          getPreset('second-schism'),
        );
        for (let i = 0; i < 4; i++) g = finishSwap(g, i);
        let turns = 0;
        while (g.phase === 'playing' && turns++ < 5000) {
          const a = decideBotAction(g, g.currentPlayerIndex);
          g = a.type === 'pickup'
            ? pickupPile(g, g.currentPlayerIndex).state
            : playCards(g, g.currentPlayerIndex, a.cardIds).state;
        }
        expect(g.phase).toBe('gameOver');
      }
      restore();
    });
  });

  // ── Stick-up (the bandits) ──────────────────────────────────────────────
  describe('stick-up', () => {
    const bandit = getPreset('bandit');

    test("a bandit's 7 swaps their lowest card for the next player's highest", () => {
      const state = setupGame({
        players: [
          player({ hand: [card(7, '♠', 'b7'), card(3, '♠', 'b3'), card(9, '♠', 'b9')], rules: bandit }),
          player({ hand: [card(4, '♥', 'v4'), card(13, '♥', 'vK'), card(5, '♥', 'v5')] }),
        ],
        pile: [card(5)],
      });
      const r = playCards(state, 0, ['b7']);
      expect(r.state.players[0].hand.map(c => c.id).sort()).toEqual(['b9', 'vK']);
      expect(r.state.players[1].hand.map(c => c.id).sort()).toEqual(['b3', 'v4', 'v5']);
      expect(r.events).toContainEqual(expect.objectContaining({ type: 'cardStolen', playerId: 0, targetId: 1 }));
    });

    test('worth, not face value: the bandit keeps his 2, gives his worst ordinary card', () => {
      // The playtest case: an Ace taken, a 2 left behind, which is a gift.
      const state = setupGame({
        players: [
          player({ hand: [card(7, '♠', 'b7'), card(2, '♠', 'b2'), card(5, '♠', 'b5')], rules: bandit }),
          player({ hand: [card(14, '♥', 'vA'), card(4, '♥', 'v4')] }),
        ],
        pile: [card(5)],
      });
      const r = playCards(state, 0, ['b7']);
      const ev = r.events.find(e => e.type === 'cardStolen');
      expect(ev).toMatchObject({ took: { id: 'vA' }, gave: { id: 'b5' } });
    });

    test('an empty hand is announced as empty', () => {
      const state = setupGame({
        players: [
          player({ name: 'Chief', hand: [card(7, '♠', 'b7'), card(9, '♠', 'b9')], rules: bandit }),
          player({ name: 'Garrett', hand: [], faceUp: [card(13)] }),
        ],
        pile: [card(5)],
      });
      const r = playCards(state, 0, ['b7']);
      expect(r.events).toContainEqual({ type: 'stickUpPassed', playerId: 0, targetId: 1, reason: 'emptyHand' });
      expect(r.state.log.at(-1)?.text).toBe("Chief goes for Garrett's hand… but it's empty.");
    });

    test("the victim's power cards count as their best", () => {
      const state = setupGame({
        players: [
          player({ hand: [card(7, '♠', 'b7'), card(3, '♠', 'b3')], rules: bandit }),
          player({ hand: [card(14, '♥', 'vA'), card(10, '♥', 'v10')] }),
        ],
        pile: [card(5)],
      });
      const ev = playCards(state, 0, ['b7']).events.find(e => e.type === 'cardStolen');
      expect(ev).toMatchObject({ took: { id: 'v10' }, gave: { id: 'b3' } });
    });

    test('only robbers rob: a 7 from a player without stick-up does nothing extra', () => {
      const state = setupGame({
        players: [
          player({ hand: [card(7, '♠', 'h7'), card(3)] }),
          player({ hand: [card(13, '♥', 'vK')], rules: bandit }),
        ],
        pile: [card(5)],
      });
      const r = playCards(state, 0, ['h7']);
      expect(r.events.some(e => e.type === 'cardStolen')).toBe(false);
      expect(r.state.players[1].hand.map(c => c.id)).toEqual(['vK']);
    });

    test('no robbery when it would not cost the victim, and it says so', () => {
      const state = setupGame({
        players: [
          player({ name: 'Chief', hand: [card(7, '♠', 'b7'), card(9, '♠', 'b9')], rules: bandit }),
          player({ name: 'Garrett', hand: [card(4, '♥', 'v4')] }),
        ],
        pile: [card(5)],
      });
      const r = playCards(state, 0, ['b7']);
      expect(r.events.some(e => e.type === 'cardStolen')).toBe(false);
      expect(r.events).toContainEqual({ type: 'stickUpPassed', playerId: 0, targetId: 1, reason: 'nothingBetter' });
      expect(r.state.log.at(-1)?.text).toBe("Chief sizes up Garrett's hand… nothing worth taking.");
    });

    test('robs the next player in the direction of play', () => {
      const state = { ...setupGame({
        players: [
          player({ hand: [card(7, '♠', 'b7'), card(3, '♠', 'b3')], rules: bandit }),
          player({ hand: [card(12, '♥', 'q')] }),
          player({ hand: [card(13, '♥', 'k')] }),
        ],
        pile: [card(5)],
      }), direction: -1 as const };
      const r = playCards(state, 0, ['b7']);
      expect(r.events).toContainEqual(expect.objectContaining({ type: 'cardStolen', targetId: 2 }));
    });

    test("bandits skip each other and rob the next player who isn't a bandit", () => {
      const state = setupGame({
        players: [
          player({ hand: [card(7, '♠', 'b7'), card(3, '♠', 'b3')], rules: bandit }),
          player({ hand: [card(13, '♣', 'partnerK')], rules: bandit }),
          player({ hand: [card(12, '♥', 'youQ')] }),
        ],
        pile: [card(5)],
      });
      const r = playCards(state, 0, ['b7']);
      expect(r.events).toContainEqual(expect.objectContaining({ type: 'cardStolen', targetId: 2 }));
      expect(r.state.players[1].hand.map(c => c.id)).toEqual(['partnerK']);
    });

    test('bandit bots play their 7s instead of saving them', () => {
      const state = setupGame({
        players: [
          player({ hand: [card(7, '♠', 'b7'), card(9, '♠', 'b9')], rules: bandit, isBot: true }),
          player({ hand: [card(13, '♥', 'vK')] }),
        ],
        pile: [card(5)],
      });
      expect(decideBotAction(state, 0)).toEqual({ type: 'play', cardIds: ['b7'] });
    });
  });
});
