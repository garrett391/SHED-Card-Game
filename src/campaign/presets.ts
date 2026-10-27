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
    description: 'Two jokers join the deck. The red joker reverses the direction of play; the black joker swaps your hand with another player\'s.',
    flavorText: 'Gio and Tati say the rules are the setup. They are the punchline.',
    jokers: true,
  },

  // Justin returns: the schism comes back harder (see campaign-lore.md).
  'second-schism': {
    ...DEFAULT_RULES,
    id: 'second-schism',
    name: 'The Second Schism',
    description: 'Justin has burned every 8. The deck is dealt without them, so nothing escapes a 7. He brings two followers.',
    flavorText: 'No 8s, no argument.',
    removedRanks: [8],
  },

  // The semi-finale: every dissenter at one table, each by their own rules.
  'the-council': {
    ...DEFAULT_RULES,
    id: 'the-council',
    name: 'The Council of Schisms',
    description: "Justin, Greg, Gio and Tati at one table. Each plays by their own rules on their turn; you play by Jake's.",
    flavorText: 'Every schism, one table.',
    jokers: true,
    seatRules: true,
    seatRulesSummary:
      "Every dissenter plays by the rules of their own table on their turn: Justin's hard 8s, Greg's 10s that burn through 7s, the twins' jokers. You play by Jake's Classic.",
  },

  // The bandits' canyon. The table plays Jake's rules; the bandits bring
  // their own seat rules ('bandit' below), so only they rob.
  'the-pass': {
    ...DEFAULT_RULES,
    id: 'the-pass',
    name: 'The Outlaw Pass',
    description: 'Bandits hold the canyon. Whenever one plays a 7, they swap their worst card for your best (2s, 7s, 8s and 10s count as the best).',
    flavorText: 'Your money or your King.',
    seatRules: true,
    seatRulesSummary:
      "Stick-up: whenever a bandit plays a 7, they swap their worst card for your best. Power cards (2, 7, 8, 10) count as the best, then the highest ranks. Bandits never rob each other. You play by Jake's Classic.",
  },

  // Seat rules for the bandits. Not a campaign node: absent from
  // PRESET_ORDER, so it never appears on the map or in free play.
  bandit: {
    ...DEFAULT_RULES,
    id: 'bandit',
    name: 'Stick-up',
    description: "A 7 robs the next player: the bandit's worst card for their best.",
    flavorText: 'Hand it over.',
    stickUp: true,
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
  'the-pass',
  'chaos-shed',
  'second-schism',
  'the-council',
];
