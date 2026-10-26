import { RuleConfig } from '../engine/types';
import { DEFAULT_RULES } from '../engine/rules';

/**
 * All rule presets. Each one is a complete, self-contained RuleConfig
 * that can be passed to createGame().
 *
 * Jake's Classic is the default — all others are variants, expressed as a
 * spread of DEFAULT_RULES plus only the fields that differ. This keeps each
 * preset readable as its actual diff from classic, and means adding a new
 * field to RuleConfig requires touching exactly one object (DEFAULT_RULES)
 * instead of every preset.
 */

export const RULE_PRESETS: Record<string, RuleConfig> = {
  'jake-classic': {
    ...DEFAULT_RULES,
    // id/name/description/flavorText already match DEFAULT_RULES; restated
    // here so the canonical preset reads complete at a glance.
    id: 'jake-classic',
    name: "Jake's Classic",
    description: '2 resets, 7 or lower, 8 is invisible, 10 burns.',
    flavorText: 'The rules passed from Jake the Elder to his disciples.',
  },

  // Act II — the disciples carry the PURE teaching to a new town, so the
  // rules are identical to Jake's Classic; only the framing changes (you're
  // the teacher now). Sits between the origin and the first schism.
  'the-spreading': {
    ...DEFAULT_RULES,
    id: 'the-spreading',
    name: 'The Spreading',
    description: 'Classic rules, unchanged. You are the teacher now — show a new town how the game is played.',
    flavorText: 'Jake the Elder instructed his disciples to spread the teachings throughout the land.',
  },

  'justins-schism': {
    ...DEFAULT_RULES,
    id: 'justins-schism',
    name: "Justin's Schism",
    description: "8s can't be played on a 7. The transparent card must obey the lower-than rule like everyone else.",
    flavorText: 'The followers of this sect believe the holy teachings are wrong.',
    hardEights: true,
  },

  'super-tens': {
    ...DEFAULT_RULES,
    id: 'super-tens',
    name: 'Super Tens',
    description: '10s can be played on a 7, overriding the lower-than rule. Nothing stops the burn.',
    flavorText: 'Some men just want to watch the pile burn.',
    burnRankOverridesLowerThan: true,
  },

  'chaos-shed': {
    ...DEFAULT_RULES,
    id: 'chaos-shed',
    name: 'Chaos Shed',
    description: '9s reverse the direction of play. Four of a kind still burns. Keep up.',
    flavorText: 'The Chaos Twins taught this one to backpackers in Bangkok. Nobody sleeps.',
    // Ordered, not wild: a 9 obeys meets-or-beats like any card — it just
    // also flips direction when legally played.
    reverseRank: 9,
    reverseRankWild: false,
  },
};

/** Get a preset by ID, falling back to Jake's Classic. */
export function getPreset(id: string): RuleConfig {
  return RULE_PRESETS[id] ?? RULE_PRESETS['jake-classic'];
}

/**
 * All preset IDs in display order. This is also the campaign ladder: each
 * one is a node on the map, unlocked by beating the one before it, and free
 * play offers a variant once its node is beaten. To add a node, add its
 * preset here plus an entry in MAP_SCENES (mapMeta.ts), VARIANT_OPPONENTS
 * (characters.ts) and, optionally, CINEMATICS (story.ts).
 */
export const PRESET_ORDER: string[] = [
  'jake-classic',
  'the-spreading',
  'justins-schism',
  'super-tens',
  'chaos-shed',
];
