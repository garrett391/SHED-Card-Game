import { decideBotAction, decideBotSwaps } from '../bot';
import { createGame, finishSwap, pickupPile, playCards, swapCards } from '../../engine/engine';
import { cardWorth, DEFAULT_RULES } from '../../engine/rules';
import { JOKER_RANK } from '../../engine/cards';
import { Card, GameState, Player, Rank, Suit } from '../../engine/types';

// ─── helpers (same shapes as the engine tests) ───────────────────────────
function card(rank: Rank, suit: Suit = '♠', id = `${rank}${suit}`): Card {
  return { id, rank, suit };
}
function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 0,
    name: 'P',
    isBot: true,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    ...overrides,
  };
}
function setupGame(opts: { players: Player[]; pile?: Card[] }): GameState {
  return {
    players: opts.players.map((p, i) => ({ ...p, id: i })),
    deckCount: 1,
    drawPile: [],
    playPile: opts.pile ?? [],
    burnedPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    phase: 'playing',
    swapsComplete: opts.players.map(() => true),
    startingPlayerIndex: 0,
    pendingExtraTurn: false,
    log: [],
    winnerId: null,
    shitheadId: null,
    lastManStanding: DEFAULT_RULES.lastManStanding,
    ruleConfig: DEFAULT_RULES,
  };
}

// On a 9: the 4 is too low; the pair of jacks, the 10 and the 2 all play.
const HAND = [card(4, '♥'), card(11, '♠'), card(10, '♦'), card(11, '♥'), card(2, '♣')];
const LEGAL = ['11♠', '11♥', '10♦', '2♣'];
const onANine = (botStyle?: Player['botStyle']) =>
  setupGame({
    players: [player({ hand: HAND, botStyle }), player()],
    pile: [card(9)],
  });

afterEach(() => jest.restoreAllMocks());

describe('decideBotAction', () => {
  describe('strategic (the default)', () => {
    test('unloads every card of the lowest legal non-power rank', () => {
      expect(decideBotAction(onANine(), 0)).toEqual({
        type: 'play',
        cardIds: ['11♠', '11♥'],
      });
    });

    test('an explicit strategic style plays the same way', () => {
      expect(decideBotAction(onANine('strategic'), 0)).toEqual(
        decideBotAction(onANine(), 0),
      );
    });
  });

  describe('novice', () => {
    test('plays a single card even when holding a set', () => {
      for (let i = 0; i < 200; i++) {
        const action = decideBotAction(onANine('novice'), 0);
        expect(action.type).toBe('play');
        if (action.type === 'play') expect(action.cardIds).toHaveLength(1);
      }
    });

    test('never picks an illegal card', () => {
      for (let i = 0; i < 200; i++) {
        const action = decideBotAction(onANine('novice'), 0);
        if (action.type === 'play') expect(LEGAL).toContain(action.cardIds[0]);
      }
    });

    test('can land on any legal card, power cards included', () => {
      const chosen = new Set<string>();
      // Four legal cards → one quarter of the random range each. 0.999
      // guards the top edge (Math.random never returns 1).
      for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
        jest.spyOn(Math, 'random').mockReturnValue(roll);
        const action = decideBotAction(onANine('novice'), 0);
        if (action.type === 'play') chosen.add(action.cardIds[0]);
      }
      expect([...chosen].sort()).toEqual([...LEGAL].sort());
    });

    test('picks up when nothing is legal', () => {
      const g = setupGame({
        players: [player({ hand: [card(4), card(5)], botStyle: 'novice' }), player()],
        pile: [card(13)],
      });
      expect(decideBotAction(g, 0)).toEqual({ type: 'pickup' });
    });

    test('chooses among face-up cards once the hand is gone', () => {
      const g = setupGame({
        players: [
          player({ faceUp: [card(3), card(12)], faceDown: [card(5)], botStyle: 'novice' }),
          player(),
        ],
        pile: [card(9)],
      });
      for (let i = 0; i < 50; i++) {
        expect(decideBotAction(g, 0)).toEqual({ type: 'play', cardIds: ['12♠'] });
      }
    });

    test('flips blind from face-down like any other bot', () => {
      const g = setupGame({
        players: [player({ faceDown: [card(3), card(12)], botStyle: 'novice' }), player()],
        pile: [card(9)],
      });
      expect(decideBotAction(g, 0)).toEqual({ type: 'play', cardIds: ['3♠'] });
    });

    // The Spreading's table: one strategic seat standing in for the human,
    // three novices. Every bot decision must be one the engine accepts, in
    // every phase of the game — an action that left the state untouched
    // would freeze the real game on that bot's turn.
    //
    // Deliberately no "the game finishes" assertion: these are real random
    // deals, and bots can settle into a standoff no human would tolerate.
    // The turn cap bounds the test; nearly every deal ends well inside it.
    test('every decision at a table of pupils is one the engine accepts', () => {
      let finished = 0;
      for (let n = 0; n < 25; n++) {
        let g = createGame([
          { name: 'Teacher', isBot: true },
          { name: 'Pupil 1', isBot: true, botStyle: 'novice' },
          { name: 'Pupil 2', isBot: true, botStyle: 'novice' },
          { name: 'Pupil 3', isBot: true, botStyle: 'novice' },
        ]);
        for (let i = 0; i < g.players.length; i++) g = finishSwap(g, i);

        for (let turn = 0; g.phase === 'playing' && turn < 2000; turn++) {
          const idx = g.currentPlayerIndex;
          const action = decideBotAction(g, idx);
          const next =
            action.type === 'pickup'
              ? pickupPile(g, idx).state
              : playCards(g, idx, action.cardIds).state;
          expect(next).not.toBe(g);
          g = next;
        }
        if (g.phase === 'gameOver') finished++;
      }
      // Sanity check that the loop above really did reach the endgame
      // (face-up and face-down play), not just the opening hands.
      expect(finished).toBeGreaterThan(0);
    });
  });
});

describe('decideBotSwaps', () => {
  const swapPhase = (p: Partial<Player>): GameState => ({
    ...setupGame({ players: [player(p), player()] }),
    phase: 'swap',
    swapsComplete: [false, false],
  });
  const apply = (g: GameState, idx: number) =>
    decideBotSwaps(g, idx).reduce(
      (s, { handCardId, faceUpCardId }) => swapCards(s, idx, handCardId, faceUpCardId),
      g,
    );
  const ids = (cards: Card[]) => cards.map((c) => c.id).sort();

  test('puts its three most useful cards face-up', () => {
    const g = swapPhase({
      faceUp: [card(3), card(5, '♥'), card(9)],
      hand: [card(10), card(14), card(4, '♦')],
    });
    const after = apply(g, 0).players[0];
    expect(ids(after.faceUp)).toEqual(ids([card(10), card(14), card(9)]));
    expect(ids(after.hand)).toEqual(ids([card(3), card(5, '♥'), card(4, '♦')]));
  });

  test('ranks by usefulness: a 2 goes up before a king', () => {
    const g = swapPhase({
      faceUp: [card(13), card(12), card(11)],
      hand: [card(2), card(3), card(4)],
    });
    const up = apply(g, 0).players[0].faceUp.map((c) => c.rank).sort((a, b) => a - b);
    expect(up).toEqual([2, 12, 13]);
  });

  test('does nothing when the face-up cards are already the best', () => {
    const g = swapPhase({
      faceUp: [card(10), card(2), card(14)],
      hand: [card(3), card(4), card(5)],
    });
    expect(decideBotSwaps(g, 0)).toEqual([]);
  });

  test('keeps the swap joker in hand', () => {
    const g = {
      ...swapPhase({
        faceUp: [card(3), card(4), card(5)],
        hand: [
          { id: 'jb', rank: JOKER_RANK, suit: '♠' as Suit, joker: 'swap' as const },
          { id: 'jr', rank: JOKER_RANK, suit: '♥' as Suit, joker: 'reverse' as const },
          card(10),
        ],
      }),
      ruleConfig: { ...DEFAULT_RULES, jokers: true },
    };
    const after = apply(g, 0).players[0];
    expect(after.hand.map((c) => c.id)).toContain('jb');
    expect(after.faceUp.map((c) => c.id)).toEqual(expect.arrayContaining(['jr', '10♠']));
  });

  test('novices keep the cards they were dealt', () => {
    const g = swapPhase({
      botStyle: 'novice',
      faceUp: [card(3), card(4), card(5)],
      hand: [card(10), card(14), card(2)],
    });
    expect(decideBotSwaps(g, 0)).toEqual([]);
  });

  test('on a real deal, no hand card is worth more than the weakest face-up card', () => {
    for (let n = 0; n < 50; n++) {
      let g = createGame(
        Array.from({ length: 4 }, (_, i) => ({ name: `B${i}`, isBot: true })),
        DEFAULT_RULES,
      );
      for (let i = 0; i < 4; i++) g = apply(g, i);
      for (const p of g.players) {
        expect(p.hand).toHaveLength(3);
        expect(p.faceUp).toHaveLength(3);
        const weakestUp = Math.min(...p.faceUp.map((c) => cardWorth(c)));
        for (const c of p.hand) expect(cardWorth(c)).toBeLessThanOrEqual(weakestUp);
      }
      for (let i = 0; i < 4; i++) g = finishSwap(g, i);
      expect(g.phase).toBe('playing');
    }
  });
});
