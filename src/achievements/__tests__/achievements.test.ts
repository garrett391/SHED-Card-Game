import { DEFAULT_RULES } from '../../engine/rules';
import { pickupPile, playCards } from '../../engine/engine';
import { Card, GameState, Player, Rank, RuleConfig, Suit } from '../../engine/types';
import {
  ACHIEVEMENTS,
  gameOverAchievements,
  GameStats,
  newGameStats,
  trackAction,
} from '../achievements';

function card(rank: Rank, suit: Suit = '♠', id = `${rank}${suit}`): Card {
  return { id, rank, suit };
}
function player(o: Partial<Player> = {}): Player {
  return { id: 0, name: 'P', isBot: false, hand: [], faceUp: [], faceDown: [], isFinished: false, ...o };
}
function game(o: { players: Player[]; pile?: Card[]; draw?: Card[]; current?: number; rules?: RuleConfig }): GameState {
  const ruleConfig = o.rules ?? DEFAULT_RULES;
  return {
    players: o.players.map((p, i) => ({ ...p, id: i })),
    deckCount: 1,
    drawPile: o.draw ?? [],
    playPile: o.pile ?? [],
    burnedPile: [],
    currentPlayerIndex: o.current ?? 0,
    direction: 1,
    phase: 'playing',
    swapsComplete: o.players.map(() => true),
    startingPlayerIndex: 0,
    pendingExtraTurn: false,
    log: [],
    winnerId: null,
    shitheadId: null,
    lastManStanding: ruleConfig.lastManStanding,
    ruleConfig,
  };
}
const bot = (o: Partial<Player> = {}) => player({ isBot: true, hand: [card(5, '♣', 'b5')], ...o });

function play(s: GameState, ids: string[], stats: GameStats = newGameStats(s.players.length)) {
  const r = playCards(s, s.currentPlayerIndex, ids);
  return { ...trackAction(s, r.events, r.state, stats), next: r.state };
}

describe('achievements', () => {
  test('every achievement has a unique id and a description', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.description.length).toBeGreaterThan(5);
  });

  test('Uno Reverse: a 7 on a 7', () => {
    const s = game({ players: [player({ hand: [card(7, '♥', 'h7'), card(9)] }), bot()], pile: [card(7)] });
    expect(play(s, ['h7']).earned).toContain('uno-reverse');
  });

  test('Big Bomb and Tactical Nuke: two and three 10s at once', () => {
    const tens = [card(10, '♠', 'a'), card(10, '♥', 'b'), card(10, '♦', 'c')];
    const s2 = game({ players: [player({ hand: [tens[0], tens[1], card(4)] }), bot()], pile: [card(9)] });
    expect(play(s2, ['a', 'b']).earned).toEqual(['big-bomb']);
    const s3 = game({ players: [player({ hand: [...tens, card(4)] }), bot()], pile: [card(9)] });
    expect(play(s3, ['a', 'b', 'c']).earned).toEqual(['tactical-nuke']);
  });

  test('Ultimate Ninja Warrior: the fourth 8 of the game, once', () => {
    const s = game({ players: [player({ hand: [card(8, '♥', 'e1'), card(8, '♦', 'e2'), card(3)] }), bot()], pile: [card(4)] });
    const stats = { ...newGameStats(2), eightsPlayed: [2, 0] };
    const r = play(s, ['e1', 'e2'], stats);
    expect(r.earned).toContain('ninja-warrior');
    expect(r.stats.eightsPlayed[0]).toBe(4);
  });

  test('bots earn nothing', () => {
    const s = game({ players: [bot({ hand: [card(7, '♥', 'h7')] }), player({ hand: [card(4)] })], pile: [card(7)] });
    expect(play(s, ['h7']).earned).toEqual([]);
  });

  test('Bomb Technician: last face-up card is a 10, a 7 forces the pickup', () => {
    const s = game({ players: [player({ faceUp: [card(10, '♥', 't')], faceDown: [card(3)] }), bot()], pile: [card(7)] });
    const r = pickupPile(s, 0);
    expect(trackAction(s, r.events, r.state, newGameStats(2)).earned).toEqual(['bomb-technician']);
  });

  test('pickups are counted and the first pickup remembered', () => {
    const s = game({ players: [player({ hand: [card(3)] }), bot()], pile: [card(9)] });
    const r = pickupPile(s, 0);
    const t = trackAction(s, r.events, r.state, newGameStats(2));
    expect(t.stats.pickups).toEqual([1, 0]);
    expect(t.stats.firstPickupBy).toBe(0);
  });

  test('Lucky SOB: a 10 from the second-to-last face-down card, then the winning flip', () => {
    const s = game({
      players: [player({ faceDown: [card(10, '♥', 'fd10'), card(4, '♥', 'last')] }), bot()],
      pile: [card(13)],
    });
    const first = play(s, ['fd10']);
    expect(first.stats.luckyArmed).toBe(0);
    expect(first.next.currentPlayerIndex).toBe(0); // burn: extra turn
    const second = play(first.next, ['last'], first.stats);
    expect(second.next.winnerId).toBe(0);
    expect(second.earned).toContain('lucky-sob');
  });

  test('Cracking Aces: winning face-down flip on an Ace', () => {
    const s = game({ players: [player({ faceDown: [card(2, '♥', 'two')] }), bot()], pile: [card(14)] });
    expect(play(s, ['two']).earned).toContain('cracking-aces');
  });

  describe('game over', () => {
    const won = () => {
      const s = game({ players: [player(), bot()] });
      return { ...s, phase: 'gameOver' as const, winnerId: 0 };
    };
    const ctx = { streak: 0, campaign: null };

    test('Novice and Master Duelist', () => {
      const stats = { ...newGameStats(2), pickups: [3, 1], firstPickupBy: 0 };
      expect(gameOverAchievements(won(), stats, ctx).earned).toEqual(['novice-duelist', 'master-duelist']);
    });

    test('streaks: third and fifth straight win', () => {
      expect(gameOverAchievements(won(), newGameStats(2), { ...ctx, streak: 2 }).earned).toEqual(['hat-trick']);
      expect(gameOverAchievements(won(), newGameStats(2), { ...ctx, streak: 4 }).earned).toEqual(['hat-trick', 'unshedable']);
    });

    test('a loss earns nothing and reports it', () => {
      const lost = { ...won(), winnerId: 1 };
      expect(gameOverAchievements(lost, newGameStats(2), ctx)).toEqual({ earned: [], humanPlayed: true, humanWon: false });
    });

    test('finishing the campaign: Keeper, and Without a Scratch with no losses', () => {
      const campaign = { presetId: 'b', completed: { a: true as const }, order: ['a', 'b'], losses: 0 };
      expect(gameOverAchievements(won(), newGameStats(2), { streak: 0, campaign }).earned)
        .toEqual(['keeper', 'without-a-scratch']);
      expect(gameOverAchievements(won(), newGameStats(2), { streak: 0, campaign: { ...campaign, losses: 2 } }).earned)
        .toEqual(['keeper']);
    });
  });
});
