import { create } from 'zustand';
import { GameState } from '../engine/types';
import * as engine from '../engine/engine';
import { LESSONS, Lesson, allowedCardIds } from '../campaign/tutorial';

/**
 * Drives the tutorial. Each lesson moves through stages:
 *   intro  → Chris speaks (tap to advance through lines)
 *   play   → player performs the gated action (no tap-to-advance)
 *   success→ Chris speaks (tap to advance), then on to the next lesson
 *
 * The actual card moves run through the real engine, so behaviour matches a
 * normal game exactly. `allow`-gating means the player can only do the intended
 * thing, so a lesson's goal is essentially a safety net + a hook for the
 * success message.
 */

type Stage = 'intro' | 'play' | 'success';

interface TutorialStore {
  lessonIndex: number;
  stage: Stage;
  lineIndex: number;
  game: GameState;
  selectedCardIds: string[];

  start: () => void;
  /** Advance dialogue (intro/success). No-op during play, or at the final screen. */
  tapContinue: () => void;
  toggleSelect: (id: string) => void;
  confirmPlay: () => void;
  pickup: () => void;
}

function lesson(i: number): Lesson {
  return LESSONS[Math.min(i, LESSONS.length - 1)];
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  lessonIndex: 0,
  stage: 'intro',
  lineIndex: 0,
  game: LESSONS[0].setup(),
  selectedCardIds: [],

  start: () =>
    set({
      lessonIndex: 0,
      stage: 'intro',
      lineIndex: 0,
      game: LESSONS[0].setup(),
      selectedCardIds: [],
    }),

  tapContinue: () => {
    const { lessonIndex, stage, lineIndex } = get();
    const l = lesson(lessonIndex);

    // The final lesson ends on its last intro line — the screen shows buttons,
    // not a Continue affordance, so we never advance past it.
    if (l.final && stage === 'intro' && lineIndex >= l.intro.length - 1) return;

    if (stage === 'intro') {
      if (lineIndex < l.intro.length - 1) {
        set({ lineIndex: lineIndex + 1 });
      } else if (l.task) {
        set({ stage: 'play', lineIndex: 0 });
      } else {
        enterSuccessOrNext(l, set, get);
      }
      return;
    }

    if (stage === 'success') {
      if (lineIndex < l.success.length - 1) {
        set({ lineIndex: lineIndex + 1 });
      } else {
        gotoNextLesson(set, get);
      }
    }
  },

  toggleSelect: (id) => {
    const { game, selectedCardIds, lessonIndex, stage } = get();
    if (stage !== 'play') return;
    const allowed = allowedCardIds(game, lesson(lessonIndex));
    if (!allowed.has(id)) return;

    if (selectedCardIds.includes(id)) {
      set({ selectedCardIds: selectedCardIds.filter((x) => x !== id) });
      return;
    }
    // Enforce single-rank selection (mixing ranks is never a legal play).
    const player = game.players[0];
    const pool = [...player.hand, ...player.faceUp, ...player.faceDown];
    const rankOf = (cid: string) => pool.find((c) => c.id === cid)?.rank;
    if (selectedCardIds.length > 0 && rankOf(selectedCardIds[0]) !== rankOf(id)) {
      set({ selectedCardIds: [id] });
      return;
    }
    set({ selectedCardIds: [...selectedCardIds, id] });
  },

  confirmPlay: () => {
    const { game, selectedCardIds, lessonIndex } = get();
    const l = lesson(lessonIndex);
    if (!l.task || l.task.action !== 'play' || selectedCardIds.length === 0) return;
    const res = engine.playCards(game, 0, selectedCardIds);
    if (l.task.goal(game, res)) {
      set({ game: res.state, selectedCardIds: [] });
      enterSuccessOrNext(l, set, get);
    } else {
      // Shouldn't happen given allow-gating; reset the board so the player retries.
      set({ game: l.setup(), selectedCardIds: [] });
    }
  },

  pickup: () => {
    const { game, lessonIndex } = get();
    const l = lesson(lessonIndex);
    if (!l.task || l.task.action !== 'pickup') return;
    const res = engine.pickupPile(game, 0);
    if (l.task.goal(game, res)) {
      set({ game: res.state, selectedCardIds: [] });
      enterSuccessOrNext(l, set, get);
    }
  },
}));

// ─── Stage transitions (module helpers so multiple actions can reuse them) ────

type SetFn = (partial: Partial<TutorialStore>) => void;
type GetFn = () => TutorialStore;

function enterSuccessOrNext(l: Lesson, set: SetFn, get: GetFn) {
  if (l.success.length > 0) {
    set({ stage: 'success', lineIndex: 0 });
  } else {
    gotoNextLesson(set, get);
  }
}

function gotoNextLesson(set: SetFn, get: GetFn) {
  const { lessonIndex } = get();
  const next = lessonIndex + 1;
  if (next < LESSONS.length) {
    set({
      lessonIndex: next,
      stage: 'intro',
      lineIndex: 0,
      selectedCardIds: [],
      game: LESSONS[next].setup(),
    });
  }
  // No next lesson: the final lesson has no success lines, so we never reach
  // here from it — the screen owns the "play a real game" exit.
}
