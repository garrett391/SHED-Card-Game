/**
 * Words for what just happened at the table, built from engine events.
 *
 * Pure: no React, no store. The table screen uses these for the action
 * caption above the pile, the line under the turn banner, and the
 * pass-the-device gate.
 */
import { cardLabel, rankLabel } from '../engine/cards';
import { Card, GameEvent, Player, RuleConfig } from '../engine/types';

/** One play, ready to show: "played K♠" plus any effect. */
export interface ActionDisplay {
  emoji: string;     // leading emoji
  headline: string;  // e.g. "played K♠"
  detail?: string;   // e.g. "🔥 Burns the pile!"; several effects are joined by \n
  card?: Card;       // the card played or flipped, if any
}

/** Describe one player's action from the events it produced. */
export function describeAction(
  events: readonly GameEvent[],
  cfg: RuleConfig,
  players: readonly Player[],
): ActionDisplay {
  const nameOf = (id: number) => players[id]?.name ?? 'someone';

  const pickup = events.find((e) => e.type === 'pileTakenUp');
  if (pickup && pickup.type === 'pileTakenUp') {
    const flipFail = events.find((e) => e.type === 'faceDownFlipFailed');
    if (flipFail && flipFail.type === 'faceDownFlipFailed') {
      return {
        emoji: '🙈',
        headline: `flipped ${cardLabel(flipFail.card)}`,
        detail: `No good — picks up ${pickup.cardCount} cards`,
        card: flipFail.card,
      };
    }
    return {
      emoji: '📥',
      headline: `picked up the pile`,
      detail: `${pickup.cardCount} cards`,
    };
  }

  const played = events.find((e) => e.type === 'cardsPlayed');
  if (played && played.type === 'cardsPlayed') {
    const n = played.cards.length;
    const headline = n === 1
      ? `played ${played.cards[0].joker ? 'the ' : ''}${cardLabel(played.cards[0])}`
      : `played ${n}× ${rankLabel(played.cards[0].rank)}`;

    const effects: string[] = [];
    const burn = events.find((e) => e.type === 'pileBurned');
    if (burn && burn.type === 'pileBurned') {
      effects.push(burn.reason === 'burnRank'
        ? '🔥 Burns the pile!'
        : burn.reason === 'tripleTransparent'
        ? `🔥 Triple ${rankLabel(cfg.transparentRank)}s — burns the pile!`
        : '🔥 Four-of-a-kind — burns the pile!');
    }
    if (events.some((e) => e.type === 'directionReversed')) {
      effects.push('🔄 Direction reversed!');
    }
    const robbed = events.find((e) => e.type === 'cardStolen');
    if (robbed && robbed.type === 'cardStolen') {
      effects.push(
        `🤠 Stick-up! Takes ${nameOf(robbed.targetId)}'s ${cardLabel(robbed.took)}, leaves a ${cardLabel(robbed.gave)}`,
      );
    }
    const passed = events.find((e) => e.type === 'stickUpPassed');
    if (passed && passed.type === 'stickUpPassed') {
      effects.push(passed.reason === 'emptyHand'
        ? `🤠 Goes for ${nameOf(passed.targetId)}'s hand… but it's empty`
        : passed.reason === 'robberEmpty'
        ? '🤠 No hand to trade from. No stick-up'
        : `🤠 Sizes up ${nameOf(passed.targetId)}'s hand… nothing worth taking`);
    }
    const swapped = events.find((e) => e.type === 'handsSwapped');
    if (swapped && swapped.type === 'handsSwapped') {
      effects.push(`🔀 Swaps hands with ${nameOf(swapped.targetId)}!`);
    }
    for (const e of events) {
      if (e.type !== 'playerFinished') continue;
      effects.push(e.playerId === played.playerId
        ? '🏆 Out of the game!'
        : `🏆 ${nameOf(e.playerId)} is out!`);
    }

    return {
      emoji: '🃏',
      headline,
      detail: effects.length > 0 ? effects.join('\n') : undefined,
      card: played.cards[0],
    };
  }

  return { emoji: '🤖', headline: 'took their turn' };
}

/** The caption line: "Name played X" plus any effects, on one line. */
export function captionText(name: string, display: Pick<ActionDisplay, 'headline' | 'detail'>): string {
  const effect = display.detail ? ' · ' + display.detail.replace(/\n/g, ' · ') : '';
  return `${name} ${display.headline}${effect}`;
}

/** The most important thing in a batch of events, as one line. */
export function summarizeRecent(
  events: readonly GameEvent[],
  players: readonly Player[],
  cfg: RuleConfig,
): string {
  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? 'Someone';

  // Walk most-impactful → least.
  for (const e of events) {
    if (e.type === 'pileBurned') {
      return e.reason === 'burnRank'
        ? `🔥 ${rankLabel(cfg.burnRank)} burns the pile`
        : e.reason === 'tripleTransparent'
        ? `🔥 Triple ${rankLabel(cfg.transparentRank)}s burn the pile`
        : '🔥 Four-of-a-kind burns the pile';
    }
    if (e.type === 'stickUpPassed') {
      return e.reason === 'emptyHand'
        ? `🤠 ${nameOf(e.playerId)} found ${nameOf(e.targetId)}'s hand empty`
        : e.reason === 'robberEmpty'
        ? `🤠 ${nameOf(e.playerId)} had no hand to trade from`
        : `🤠 ${nameOf(e.playerId)} found nothing worth taking from ${nameOf(e.targetId)}`;
    }
    if (e.type === 'cardStolen') {
      return `🤠 ${nameOf(e.playerId)} took ${nameOf(e.targetId)}'s ${cardLabel(e.took)} for a ${cardLabel(e.gave)}`;
    }
    if (e.type === 'handsSwapped') {
      return `🔀 ${nameOf(e.playerId)} swapped hands with ${nameOf(e.targetId)}`;
    }
    if (e.type === 'directionReversed') {
      return '🔄 Direction reversed!';
    }
    if (e.type === 'faceDownFlipFailed') {
      return `Face-down flip failed — pile picked up.`;
    }
    if (e.type === 'pileTakenUp') {
      return `${nameOf(e.playerId)} picked up the pile (${e.cardCount} cards)`;
    }
    if (e.type === 'playerFinished') {
      return `🏆 ${nameOf(e.playerId)} finished!`;
    }
  }
  for (const e of events) {
    if (e.type === 'cardsPlayed') {
      const n = e.cards.length;
      const label = e.cards[0].joker && n === 1 ? cardLabel(e.cards[0]) : rankLabel(e.cards[0].rank);
      return `${nameOf(e.playerId)} ${n === 1 ? `played ${label}` : `played ${n}× ${label}`}`;
    }
  }
  return '';
}

/** What a face-down flip turned up, if the events include one. */
export function flipOutcome(events: readonly GameEvent[]): { card: Card; success: boolean } | null {
  const failed = events.find((e) => e.type === 'faceDownFlipFailed');
  if (failed && failed.type === 'faceDownFlipFailed') return { card: failed.card, success: false };
  const played = events.find((e) => e.type === 'cardsPlayed' && e.source === 'faceDown');
  if (played && played.type === 'cardsPlayed') return { card: played.cards[0], success: true };
  return null;
}
