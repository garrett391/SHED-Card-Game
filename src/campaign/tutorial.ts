/**
 * Jake's Classic tutorial — content + scripted-board helpers.
 *
 * Design: the tutorial is an ordered list of self-contained LESSONS. Each lesson
 * builds a small, rigged GameState, Chris explains it, and the player performs
 * ONE gated action that runs through the *real* engine (so what they learn
 * transfers exactly to a normal game). This is deliberately a set of focused
 * drills rather than one long rigged game — each mechanic is taught in isolation
 * with no confounding state, which is both clearer pedagogy and far more robust.
 *
 * Everything here is pure data + pure helpers; the orchestration (advancing
 * lines, running moves, checking goals) lives in tutorialStore.ts.
 */
import { Card, GameState, PlayResult, PlaySource, Rank, Suit } from '../engine/types';
import { DEFAULT_RULES } from '../engine/rules';
import * as engine from '../engine/engine';

// ─── Card / board construction ──────────────────────────────────────────────

let _seq = 0;
/** Mint a card with a guaranteed-unique id (tutorial boards may repeat ranks). */
function c(rank: Rank, suit: Suit = '♠'): Card {
  return { id: `tut-${rank}${suit}-${_seq++}`, rank, suit };
}

interface BoardOpts {
  hand?: Card[];
  faceUp?: Card[];
  faceDown?: Card[];
  pile?: Card[]; // index 0 = top of pile
  draw?: Card[];
}

/** Build a single-player ("You") game already in the playing phase. */
function makeBoard(o: BoardOpts): GameState {
  return {
    players: [
      {
        id: 0,
        name: 'You',
        isBot: false,
        hand: o.hand ?? [],
        faceUp: o.faceUp ?? [],
        faceDown: o.faceDown ?? [],
        isFinished: false,
      },
    ],
    deckCount: 1,
    drawPile: o.draw ?? [],
    playPile: o.pile ?? [],
    burnedPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    phase: 'playing',
    swapsComplete: [true],
    startingPlayerIndex: 0,
    pendingExtraTurn: false,
    log: [],
    ruleConfig: DEFAULT_RULES,
    lastManStanding: DEFAULT_RULES.lastManStanding,
    winnerId: null,
    shitheadId: null,
  };
}

// ─── Lesson model ────────────────────────────────────────────────────────────

export interface LessonTask {
  /** Persistent prompt shown by Chris while the player acts. */
  instruction: string;
  action: 'play' | 'pickup';
  /** Restrict tappable cards to these ranks (from the active source). Undefined = any legal card. */
  allowRanks?: Rank[];
  /** Minimum cards that must be selected before "Play" enables (e.g. 4 for four-of-a-kind). */
  minCards?: number;
  /** Lesson is complete when this returns true for the move just made. */
  goal: (prev: GameState, res: PlayResult) => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  /** Lines Chris speaks before the player acts; advanced one tap at a time. */
  intro: string[];
  setup: () => GameState;
  task?: LessonTask;
  /** Lines Chris speaks after the goal is met. */
  success: string[];
  /** Final celebratory lesson — screen shows "play a real game" instead of Continue. */
  final?: boolean;
}

// ─── Goal helpers ─────────────────────────────────────────────────────────────

const played = (res: PlayResult) => res.events.some((e) => e.type === 'cardsPlayed');
const playedRank = (res: PlayResult, rank: Rank) =>
  res.events.some((e) => e.type === 'cardsPlayed' && e.cards[0]?.rank === rank);
const playedFrom = (res: PlayResult, source: PlaySource) =>
  res.events.some((e) => e.type === 'cardsPlayed' && e.source === source);
const burned = (res: PlayResult) => res.events.some((e) => e.type === 'pileBurned');
const tookPile = (res: PlayResult) => res.events.some((e) => e.type === 'pileTakenUp');

// ─── The lessons ──────────────────────────────────────────────────────────────

export const LESSONS: Lesson[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    intro: [
      "Ah — a new face at the table! I'm Chris, keeper of the rules of Shed. Let me show you the ropes.",
      'The aim is simple: be the first to get rid of all your cards. Any soul still clutching their cards is a Shithead.',
      'You play from three stacks in order — your hand first, then your three face-up cards, and finally your face-down cards, flipped blind. Empty all three and you are out.',
    ],
    setup: () =>
      makeBoard({
        hand: [c(4, '♣'), c(9, '♥'), c(13, '♦')],
        faceUp: [c(6, '♠'), c(8, '♥'), c(12, '♣')],
        faceDown: [c(2, '♠'), c(5, '♦'), c(10, '♣')],
      }),
    success: [],
  },

  {
    id: 'basic-play',
    title: 'Playing a card',
    intro: [
      'Let us play a card. The pile shows a 5.',
      'On your turn you must play a card of equal or higher rank — or pick up the pile. Pick a card 5 or higher and play it.',
    ],
    setup: () =>
      makeBoard({
        pile: [c(5, '♦')],
        hand: [c(3, '♠'), c(6, '♥'), c(9, '♣')],
        draw: [c(11, '♦'), c(7, '♠')],
      }),
    task: {
      instruction: 'Tap a card you can play (5 or higher), then press Play.',
      action: 'play',
      goal: (_p, r) => played(r),
    },
    success: [
      'Well played. Notice your hand filled back to three from the draw pile — you always top up to three while cards remain there.',
      'The 3 was greyed out: too low to beat a 5. When nothing beats the pile, you pick it up instead. Let us try that.',
    ],
  },

  {
    id: 'pickup',
    title: 'Picking up',
    intro: [
      'Sometimes you simply cannot play. The pile shows a 9, and your hand is all low cards.',
      'No card beats it — so you must take the whole pile into your hand. Tap the pile to pick it up.',
    ],
    setup: () =>
      makeBoard({
        pile: [c(9, '♠'), c(4, '♥'), c(6, '♣')],
        hand: [c(3, '♦'), c(4, '♣'), c(5, '♥')],
      }),
    task: {
      instruction: 'You cannot beat the 9 — tap the pile to pick it up.',
      action: 'pickup',
      goal: (_p, r) => tookPile(r),
    },
    success: [
      'Bad luck — but that is the game. Those cards are in your hand now. Avoid picking up when you can; a fat hand is hard to shed.',
    ],
  },

  {
    id: 'two-reset',
    title: 'The 2 — reset',
    intro: [
      'Now the power cards: four ranks with special magic. First, the 2.',
      'A 2 may be played on ANYTHING, and it resets the pile. After a 2, the next player may play whatever they like.',
      'The pile shows a King — normally you would need a King or Ace. But you hold a 2. Play it.',
    ],
    setup: () =>
      makeBoard({
        pile: [c(13, '♣')],
        hand: [c(2, '♥'), c(5, '♠'), c(9, '♦')],
      }),
    task: {
      instruction: 'Play the 2 to reset the pile.',
      action: 'play',
      allowRanks: [2],
      goal: (_p, r) => playedRank(r, 2),
    },
    success: [
      'The pile is reset to a 2 — the lowest card. Anything goes on top now. The humble 2 is your escape hatch when the pile climbs too high.',
    ],
  },

  {
    id: 'ten-burn',
    title: 'The 10 — burn',
    intro: [
      'The 10 is the great equaliser. Play it on anything and the entire pile BURNS — gone, out of the game.',
      'Better still: after a burn the pile is empty and it is still your turn. Play your 10 and watch it burn.',
    ],
    setup: () =>
      makeBoard({
        pile: [c(6, '♠'), c(6, '♥')],
        hand: [c(10, '♣'), c(4, '♦'), c(9, '♠')],
      }),
    task: {
      instruction: 'Play the 10 to burn the pile.',
      action: 'play',
      allowRanks: [10],
      goal: (_p, r) => burned(r),
    },
    success: [
      'Whoosh — into the fire. The pile is gone and you play again. Save a 10 for the moment the pile turns dangerous.',
    ],
  },

  {
    id: 'eight-invisible',
    title: 'The 8 — invisible',
    intro: [
      'The 8 is the trickster — it is invisible. Play it on anything, and the pile still counts as whatever lies beneath.',
      'The pile shows a 9. Play your 8 on top.',
    ],
    setup: () =>
      makeBoard({
        pile: [c(9, '♦')],
        hand: [c(8, '♠'), c(4, '♥'), c(6, '♣')],
      }),
    task: {
      instruction: 'Play the 8 — it is always allowed.',
      action: 'play',
      allowRanks: [8],
      goal: (_p, r) => playedRank(r, 8),
    },
    success: [
      'See the note on the pile? Your 8 sits on top, but the pile still counts as a 9 — the next card must beat the 9, not the 8.',
      'Sneaky. An 8 lets you slip past a turn without changing what the pile demands.',
    ],
  },

  {
    id: 'seven-lower',
    title: 'The 7 — play lower',
    intro: [
      'The last power card: the 7. It turns the tables — after a 7, the next player must play a 7 or LOWER.',
      'The pile shows a 5. Play your 7.',
    ],
    setup: () =>
      makeBoard({
        pile: [c(5, '♣')],
        hand: [c(7, '♥'), c(3, '♠'), c(9, '♦')],
      }),
    task: {
      instruction: 'Play the 7 to force the next player low.',
      action: 'play',
      allowRanks: [7],
      goal: (_p, r) => playedRank(r, 7),
    },
    success: [
      'Now the pile demands a 7 or lower — though a 2, 8 or 10 still ignores the rule. A fine way to trap a player holding only high cards.',
    ],
  },

  {
    id: 'multiples',
    title: 'Multiples & four of a kind',
    intro: [
      'You may play several cards of the SAME rank at once. And four of a kind — in one go or stacked up over turns — burns the pile, just like a 10.',
      'You hold four 9s and the pile shows a 6. Select all four, then play them together.',
    ],
    setup: () =>
      makeBoard({
        pile: [c(6, '♠')],
        hand: [c(9, '♥'), c(9, '♦'), c(9, '♣'), c(9, '♠')],
      }),
    task: {
      instruction: 'Select all four 9s, then press Play.',
      action: 'play',
      allowRanks: [9],
      minCards: 4,
      goal: (_p, r) => burned(r),
    },
    success: [
      'Four of a kind — burned, and you play again. Watch for chances to dump a pair or trips in one turn; it empties your hand fast.',
    ],
  },

  {
    id: 'face-up-down',
    title: 'Face-up & face-down',
    intro: [
      'When your hand runs empty, you play from your three face-up cards. You can see them, so plan ahead.',
      'Your hand is empty and the pile shows a 4. Play one of your face-up cards.',
    ],
    setup: () =>
      makeBoard({
        hand: [],
        faceUp: [c(6, '♠'), c(9, '♥'), c(11, '♦')],
        faceDown: [c(3, '♣'), c(7, '♠'), c(10, '♦')],
        pile: [c(4, '♣')],
      }),
    task: {
      instruction: 'Tap a face-up card you can play, then press Play.',
      action: 'play',
      goal: (_p, r) => playedFrom(r, 'faceUp'),
    },
    success: [
      'Last come your face-down cards — flipped blind, one at a time. You will not know what you turn over; if it cannot beat the pile, you pick up. Pure luck at the very end!',
    ],
  },

  {
    id: 'graduation',
    title: 'Graduation',
    intro: [
      'That is everything: play equal-or-higher, wield your 2, 7, 8 and 10, and shed all three stacks before anyone else.',
      'You are ready, friend. Long live Jake the Elder — now go and win.',
    ],
    setup: () => makeBoard({}),
    success: [],
    final: true,
  },
];

// ─── Interaction helpers (used by the store + screen) ────────────────────────

/** Which card ids may the player tap right now, given the active source + lesson gating. */
export function allowedCardIds(state: GameState, lesson: Lesson): Set<string> {
  if (!lesson.task || lesson.task.action !== 'play') return new Set();
  const legal = engine.getPlayableCardIds(state, 0);
  if (!lesson.task.allowRanks) return new Set(legal);

  const player = state.players[0];
  const source = engine.getPlaySource(player);
  const arr =
    source === 'hand' ? player.hand : source === 'faceUp' ? player.faceUp : player.faceDown;
  const rankById = new Map(arr.map((card) => [card.id, card.rank] as const));
  const ranks = lesson.task.allowRanks;
  return new Set(legal.filter((id) => ranks.includes(rankById.get(id)!)));
}

/** True once enough valid cards are selected to enable the Play button. */
export function canPlaySelection(selected: string[], lesson: Lesson): boolean {
  const min = lesson.task?.minCards ?? 1;
  return selected.length >= min;
}
