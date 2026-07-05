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
} from '../engine';
import { getPreset } from '../../campaign/presets';
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

    test('all shipped presets use an ordered (non-wild) reverse rank', () => {
      for (const id of ['chaos-shed', 'backpackers-codex']) {
        const preset = getPreset(id);
        expect(preset.reverseRank).toBe(9);
        expect(preset.reverseRankWild).toBe(false);
      }
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

    test("the Backpacker's Codex preset enables lastManStanding end-to-end", () => {
      const codex = getPreset('backpackers-codex');
      expect(codex.lastManStanding).toBe(true);
      const g = createGame(
        [{ name: 'A', isBot: false }, { name: 'B', isBot: false }],
        codex,
      );
      expect(g.lastManStanding).toBe(true);
    });
  });
});