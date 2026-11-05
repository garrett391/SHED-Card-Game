/**
 * What the characters at the table say, and when.
 *
 * Pure apart from the dice the character helpers roll: the table screen
 * hands in engine events and gets back the lines to show.
 */
import { cardLabel } from '../engine/cards';
import { GameEvent, GameState, RuleConfig } from '../engine/types';
import {
  characterByName,
  maybeQuip,
  maybeReaction,
  powerReaction,
  robLine,
} from '../campaign/characters';
import { ActionDisplay, captionText, describeAction } from './describeEvents';
import { SeatedStickUp, stickUpFrom } from './stickUp';

export interface BotTurn {
  display: ActionDisplay;
  /** The caption above the pile, with the character's emoji if they have one. */
  caption: string;
  /** The bot's in-character line, shown as table talk once its turn clears. */
  quip?: string;
  /** A stick-up that involves a human, with the robber's line in it. */
  robbery: SeatedStickUp | null;
}

/**
 * Everything the table shows after a bot's turn.
 * `game` is the state after the turn; `cfg` the rules it was played under.
 */
export function describeBotTurn(
  botName: string,
  events: readonly GameEvent[],
  game: GameState | null,
  cfg: RuleConfig,
): BotTurn {
  const display = describeAction(events, cfg, game?.players ?? []);
  const character = characterByName(botName);
  const caption = captionText(character ? `${character.emoji} ${botName}` : botName, display);

  // A stick-up on a human opens the panel, and the robber's line goes in it
  // rather than out as table talk.
  const robbery = stickUpFrom(events, game);
  if (robbery && character && robbery.kind !== 'robberEmpty') {
    const quote = robbery.kind === 'trade'
      ? robLine(character, 'selfRob', cardLabel(robbery.took))
      : robLine(character, 'selfRobPassed');
    if (quote) robbery.quote = quote;
  }
  if (!character || robbery) return { display, caption, robbery };

  // Situational line beats generic: their burn > their pickup > their
  // power card > table talk.
  const played = events.find((e) => e.type === 'cardsPlayed');
  const power = played && played.type === 'cardsPlayed'
    ? powerReaction(played.cards[0].rank, cfg)
    : null;
  let quip: string | null;
  if (events.some((e) => e.type === 'pileBurned')) {
    quip = maybeReaction(character, 'selfBurn');
  } else if (events.some((e) => e.type === 'pileTakenUp')) {
    quip = maybeReaction(character, 'selfPickup');
  } else if (power) {
    quip = maybeReaction(character, power);
  } else {
    quip = maybeQuip(character);
  }
  return { display, caption, quip: quip ?? undefined, robbery };
}

/**
 * A HUMAN picking up or burning the pile invites commentary: a random
 * character still in the game reacts. Bot pickups and burns are excluded,
 * since those characters already speak after their own turn. Burns only
 * draw lines from characters written to react to them; everyone else
 * stays quiet.
 */
export function heckle(
  game: GameState,
  events: readonly GameEvent[],
): { playerId: number; text: string } | null {
  const isHuman = (id: number) => (game.players[id] ? !game.players[id].isBot : false);
  const pickup = events.find((e) => e.type === 'pileTakenUp');
  const played = events.find((e) => e.type === 'cardsPlayed');
  let kind: 'humanPickup' | 'humanBurn' | null = null;
  if (pickup && pickup.type === 'pileTakenUp' && isHuman(pickup.playerId)) {
    kind = 'humanPickup';
  } else if (
    events.some((e) => e.type === 'pileBurned') &&
    played && played.type === 'cardsPlayed' &&
    isHuman(played.playerId)
  ) {
    kind = 'humanBurn';
  }
  if (!kind) return null;
  const hecklers = game.players.filter((p) => {
    if (!p.isBot || p.isFinished) return false;
    const c = characterByName(p.name);
    if (!c) return false;
    return kind === 'humanPickup' || (c.reactions.humanBurn?.length ?? 0) > 0;
  });
  if (hecklers.length === 0) return null;
  const h = hecklers[Math.floor(Math.random() * hecklers.length)];
  const text = maybeReaction(characterByName(h.name)!, kind);
  return text ? { playerId: h.id, text } : null;
}
