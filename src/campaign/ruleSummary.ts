/**
 * Auto-generated rule summaries.
 *
 * Rather than hand-write a rulebook per variant (which would drift from what the
 * engine actually does), we DERIVE the differences by comparing a preset's
 * RuleConfig against Jake's Classic — the same config the engine runs on. Add a
 * new preset and its rules description updates itself.
 */
import { RuleConfig } from '../engine/types';
import { DEFAULT_RULES } from '../engine/rules';
import { rankLabel } from '../engine/cards';

/**
 * Plain-language list of how `config` differs from Jake's Classic.
 * Empty array means it IS Jake's Classic (no differences).
 *
 * Note: `allowVoluntaryPickup` is intentionally excluded — it's an unwired
 * placeholder in the engine, so surfacing it would describe behaviour that
 * doesn't exist yet.
 */
export function variantDiff(config: RuleConfig): string[] {
  const base = DEFAULT_RULES;
  const out: string[] = [];

  // ── Power-rank reassignments (future-proofing; none differ today) ──────────
  if (config.resetRank !== base.resetRank)
    out.push(`The reset card is now the ${rankLabel(config.resetRank)}.`);
  if (config.lowerThanRank !== base.lowerThanRank)
    out.push(`The "play lower" card is now the ${rankLabel(config.lowerThanRank)}.`);
  if (config.transparentRank !== base.transparentRank)
    out.push(`The invisible card is now the ${rankLabel(config.transparentRank)}.`);
  if (config.burnRank !== base.burnRank)
    out.push(`The burn card is now the ${rankLabel(config.burnRank)}.`);

  // ── Optional reverse rank ──────────────────────────────────────────────────
  if (config.reverseRank !== base.reverseRank) {
    if (config.reverseRank !== null)
      out.push(`Playing a ${rankLabel(config.reverseRank)} reverses the direction of play.`);
    else out.push('The reverse card is disabled.');
  }

  // ── Special combo ──────────────────────────────────────────────────────────
  if (config.sixNineReverse && !base.sixNineReverse)
    out.push('Playing a 9 on a 6 reverses the direction of play.');

  // ── Burn variants ──────────────────────────────────────────────────────────
  if (config.fourOfAKindBurns !== base.fourOfAKindBurns)
    out.push(
      config.fourOfAKindBurns
        ? 'Four of a kind burns the pile.'
        : 'Four of a kind no longer burns the pile.',
    );
  if (config.tripleTransparentBurns && !base.tripleTransparentBurns)
    out.push(
      `Three ${rankLabel(config.transparentRank)}s in a row burn the pile, just like a ${rankLabel(config.burnRank)}.`,
    );

  // ── Play restrictions ──────────────────────────────────────────────────────
  if (config.hardEights && !base.hardEights)
    out.push(
      `Hard ${rankLabel(config.transparentRank)}s: the invisible card can't be played on a ${rankLabel(config.lowerThanRank)} — it must follow the "play lower" rule like any other card.`,
    );
  if (config.burnRankOverridesLowerThan && !base.burnRankOverridesLowerThan)
    out.push(
      `The ${rankLabel(config.burnRank)} can be played on a ${rankLabel(config.lowerThanRank)}, overriding the "play lower" rule.`,
    );
  if (config.burnRankRestricted && !base.burnRankRestricted)
    out.push(
      `The ${rankLabel(config.burnRank)} can't be played on a face card (J, Q, K, A).`,
    );

  // ── Gameplay ───────────────────────────────────────────────────────────────
  if (config.lastManStanding !== base.lastManStanding)
    out.push(
      config.lastManStanding
        ? 'Last one standing: play continues until a single player is left holding cards — and that player loses. (Normally, the first player out wins.)'
        : 'The first player to shed all their cards wins.',
    );

  return out;
}
