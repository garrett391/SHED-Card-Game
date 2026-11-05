import { DEFAULT_RULES } from '../../engine/rules';
import { Card, GameEvent, GameState, Player, Rank, Suit } from '../../engine/types';
import { captionText, describeAction, flipOutcome, summarizeRecent } from '../describeEvents';
import { isSoleHuman, stickUpFrom } from '../stickUp';
import { describeBotTurn, heckle } from '../tableTalk';

function card(rank: Rank, suit: Suit = '♠'): Card {
  return { id: `${rank}${suit}`, rank, suit };
}
function player(id: number, name: string, isBot: boolean): Player {
  return { id, name, isBot, hand: [], faceUp: [], faceDown: [], isFinished: false };
}
function table(players: Player[]): GameState {
  return {
    players,
    deckCount: 1,
    drawPile: [],
    playPile: [],
    burnedPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    phase: 'playing',
    swapsComplete: players.map(() => true),
    startingPlayerIndex: 0,
    pendingExtraTurn: false,
    log: [],
    winnerId: null,
    shitheadId: null,
    lastManStanding: DEFAULT_RULES.lastManStanding,
    ruleConfig: DEFAULT_RULES,
  };
}

const you = player(0, 'Player 1', false);
const jake = player(1, 'Jake the Elder', true);
const bot = player(2, 'Bot', true);
const game = table([you, jake, bot]);

afterEach(() => jest.restoreAllMocks());

describe('describeAction', () => {
  test('a single card, then its effects in order', () => {
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 1, cards: [card(10)], source: 'hand' },
      { type: 'pileBurned', reason: 'burnRank' },
      { type: 'playerFinished', playerId: 1 },
    ];
    const d = describeAction(events, DEFAULT_RULES, game.players);
    expect(d.headline).toBe('played 10♠');
    expect(d.detail).toBe('🔥 Burns the pile!\n🏆 Out of the game!');
    expect(captionText('Jake', d)).toBe('Jake played 10♠ · 🔥 Burns the pile! · 🏆 Out of the game!');
  });

  test('a swap joker that puts the other player out says who', () => {
    const joker: Card = { id: 'js', rank: 15 as Rank, suit: '♠', joker: 'swap' };
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 1, cards: [joker], source: 'hand' },
      { type: 'handsSwapped', playerId: 1, targetId: 2 },
      { type: 'playerFinished', playerId: 2 },
    ];
    expect(describeAction(events, DEFAULT_RULES, game.players).detail).toBe(
      '🔀 Swaps hands with Bot!\n🏆 Bot is out!',
    );
  });

  test('a set counts its cards', () => {
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 2, cards: [card(13), card(13, '♥')], source: 'hand' },
    ];
    const d = describeAction(events, DEFAULT_RULES, game.players);
    expect(d.headline).toBe('played 2× K');
    expect(d.detail).toBeUndefined();
  });

  test('a failed flip names the card and the pickup', () => {
    const events: GameEvent[] = [
      { type: 'faceDownFlipFailed', playerId: 0, card: card(4) },
      { type: 'pileTakenUp', playerId: 0, cardCount: 6 },
    ];
    const d = describeAction(events, DEFAULT_RULES, game.players);
    expect(d.headline).toBe('flipped 4♠');
    expect(d.detail).toBe('No good — picks up 6 cards');
  });

  test('a stick-up names the victim', () => {
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 1, cards: [card(7)], source: 'hand' },
      { type: 'cardStolen', playerId: 1, targetId: 0, took: card(14), gave: card(3) },
    ];
    expect(describeAction(events, DEFAULT_RULES, game.players).detail).toBe(
      "🤠 Stick-up! Takes Player 1's A♠, leaves a 3♠",
    );
  });
});

describe('summarizeRecent', () => {
  test('the biggest moment wins over the play itself', () => {
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 0, cards: [card(10)], source: 'hand' },
      { type: 'pileBurned', reason: 'burnRank' },
    ];
    expect(summarizeRecent(events, game.players, DEFAULT_RULES)).toBe('🔥 10 burns the pile');
  });

  test('a plain play', () => {
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 2, cards: [card(5), card(5, '♦')], source: 'hand' },
    ];
    expect(summarizeRecent(events, game.players, DEFAULT_RULES)).toBe('Bot played 2× 5');
  });
});

describe('flipOutcome', () => {
  test('a flip that plays, one that fails, and no flip at all', () => {
    expect(flipOutcome([{ type: 'cardsPlayed', playerId: 0, cards: [card(9)], source: 'faceDown' }]))
      .toEqual({ card: card(9), success: true });
    expect(flipOutcome([{ type: 'faceDownFlipFailed', playerId: 0, card: card(3) }]))
      .toEqual({ card: card(3), success: false });
    expect(flipOutcome([{ type: 'cardsPlayed', playerId: 0, cards: [card(9)], source: 'hand' }]))
      .toBeNull();
  });
});

describe('stick-ups', () => {
  const robbery: GameEvent = {
    type: 'cardStolen', playerId: 1, targetId: 0, took: card(14), gave: card(3),
  };

  test('a bot robbing the human opens the panel', () => {
    expect(stickUpFrom([robbery], game)).toMatchObject({
      kind: 'trade', robber: 'Jake the Elder', victim: 'Player 1', robberId: 1, victimId: 0,
    });
  });

  test('bots robbing each other stay off screen', () => {
    expect(stickUpFrom([{ ...robbery, targetId: 2 }], game)).toBeNull();
  });

  test('"you" only when there is one human', () => {
    expect(isSoleHuman(game, 0)).toBe(true);
    expect(isSoleHuman(game, 1)).toBe(false);
    expect(isSoleHuman(table([you, { ...jake, isBot: false }]), 0)).toBe(false);
  });
});

describe('table talk', () => {
  test('a robbing host speaks in the panel, not as table talk', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 1, cards: [card(7)], source: 'hand' },
      { type: 'cardStolen', playerId: 1, targetId: 0, took: card(14), gave: card(3) },
    ];
    const turn = describeBotTurn('Jake the Elder', events, game, DEFAULT_RULES);
    expect(turn.robbery).not.toBeNull();
    expect(turn.quip).toBeUndefined();
    expect(turn.caption).toContain('Jake the Elder played 7♠');
  });

  test('a host burning the pile reacts to it', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 1, cards: [card(10)], source: 'hand' },
      { type: 'pileBurned', reason: 'burnRank' },
    ];
    expect(describeBotTurn('Jake the Elder', events, game, DEFAULT_RULES).quip).toEqual(
      expect.any(String),
    );
  });

  test('a plain bot has nothing to say', () => {
    const events: GameEvent[] = [
      { type: 'cardsPlayed', playerId: 2, cards: [card(5)], source: 'hand' },
    ];
    const turn = describeBotTurn('Bot', events, game, DEFAULT_RULES);
    expect(turn.quip).toBeUndefined();
    expect(turn.caption).toBe('Bot played 5♠');
  });

  test("a human's pickup draws a heckle from a host, never a plain bot", () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const line = heckle(game, [{ type: 'pileTakenUp', playerId: 0, cardCount: 4 }]);
    expect(line).toEqual({ playerId: 1, text: expect.any(String) });
  });

  test("a bot's own pickup draws no heckle", () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(heckle(game, [{ type: 'pileTakenUp', playerId: 1, cardCount: 4 }])).toBeNull();
  });
});
