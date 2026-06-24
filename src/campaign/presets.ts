import { RuleConfig } from '../engine/types';

/**
 * All rule presets. Each one is a complete, self-contained RuleConfig
 * that can be passed to createGame().
 *
 * Jake's Classic is the default — all others are variants.
 */

export const RULE_PRESETS: Record<string, RuleConfig> = {
  'jake-classic': {
    id: 'jake-classic',
    name: "Jake's Classic",
    description: '2 resets, 7 or lower, 8 is invisible, 10 burns.',
    flavorText: 'The rules passed from Jake the Elder to his disciples.',
    resetRank: 2,
    lowerThanRank: 7,
    transparentRank: 8,
    burnRank: 10,
    reverseRank: null,
    fourOfAKindBurns: true,
    tripleTransparentBurns: false,
    hardEights: false,
    burnRankRestricted: false,
    burnRankOverridesLowerThan: false,
    sixNineReverse: false,
    allowVoluntaryPickup: false,
    lastManStanding: false,
  },

  'justins-schism': {
    id: 'justins-schism',
    name: "Justin's Schism",
    description: "8s can't be played on a 7. The transparent card must obey the lower-than rule like everyone else.",
    flavorText: 'The followers of this sect believe the holy teachings are wrong.',
    resetRank: 2,
    lowerThanRank: 7,
    transparentRank: 8,
    burnRank: 10,
    reverseRank: null,
    fourOfAKindBurns: true,
    tripleTransparentBurns: false,
    hardEights: true,
    burnRankRestricted: false,
    burnRankOverridesLowerThan: false,
    sixNineReverse: false,
    allowVoluntaryPickup: false,
    lastManStanding: false,
  },

  'super-tens': {
    id: 'super-tens',
    name: 'Super Tens',
    description: '10s can be played on a 7, overriding the lower-than rule. Nothing stops the burn.',
    flavorText: 'Some men just want to watch the pile burn.',
    resetRank: 2,
    lowerThanRank: 7,
    transparentRank: 8,
    burnRank: 10,
    reverseRank: null,
    fourOfAKindBurns: true,
    tripleTransparentBurns: false,
    hardEights: false,
    burnRankRestricted: false,
    burnRankOverridesLowerThan: true,
    sixNineReverse: false,
    allowVoluntaryPickup: false,
    lastManStanding: false,
  },

  'chaos-shed': {
    id: 'chaos-shed',
    name: 'Chaos Shed',
    description: '9s reverse the direction of play. Four of a kind still burns. Keep up.',
    flavorText: 'The Chaos Twins taught this one to backpackers in Bangkok. Nobody sleeps.',
    resetRank: 2,
    lowerThanRank: 7,
    transparentRank: 8,
    burnRank: 10,
    reverseRank: 9,
    fourOfAKindBurns: true,
    tripleTransparentBurns: false,
    hardEights: false,
    burnRankRestricted: false,
    burnRankOverridesLowerThan: false,
    sixNineReverse: false,
    allowVoluntaryPickup: false,
    lastManStanding: false,
  },

  'the-69': {
    id: 'the-69',
    name: 'The 69',
    description: 'Playing a 9 on a 6 reverses direction. A subtle trap for the unwary.',
    flavorText: 'Some combinations are just meant to be.',
    resetRank: 2,
    lowerThanRank: 7,
    transparentRank: 8,
    burnRank: 10,
    reverseRank: null,
    fourOfAKindBurns: true,
    tripleTransparentBurns: false,
    hardEights: false,
    burnRankRestricted: false,
    burnRankOverridesLowerThan: false,
    sixNineReverse: true,
    allowVoluntaryPickup: false,
    lastManStanding: false,
  },

  'ofcom-standard': {
    id: 'ofcom-standard',
    name: 'The OFCOM Standard',
    description: 'Three consecutive 8s burn the pile, just like a 10.',
    flavorText: 'The unofficial world record holders. They never miss a Thursday.',
    resetRank: 2,
    lowerThanRank: 7,
    transparentRank: 8,
    burnRank: 10,
    reverseRank: null,
    fourOfAKindBurns: true,
    tripleTransparentBurns: true,
    hardEights: false,
    burnRankRestricted: false,
    burnRankOverridesLowerThan: false,
    sixNineReverse: false,
    allowVoluntaryPickup: false,
    lastManStanding: false,
  },

  'backpackers-codex': {
    id: 'backpackers-codex',
    name: "The Backpacker's Codex",
    description: 'Every variant at once. 9s reverse, hard 8s, triple 8s burn, 10s restricted on face cards. Last one standing loses.',
    flavorText: "Written on the back of a hostel napkin in Chiang Mai. If you can win this, you've mastered Shed.",
    resetRank: 2,
    lowerThanRank: 7,
    transparentRank: 8,
    burnRank: 10,
    reverseRank: 9,
    fourOfAKindBurns: true,
    tripleTransparentBurns: true,
    hardEights: true,
    burnRankRestricted: true,
    burnRankOverridesLowerThan: false,
    sixNineReverse: false,
    allowVoluntaryPickup: false,
    lastManStanding: true,
  },
};

/** Get a preset by ID, falling back to Jake's Classic. */
export function getPreset(id: string): RuleConfig {
  return RULE_PRESETS[id] ?? RULE_PRESETS['jake-classic'];
}

/** All preset IDs in display order. */
export const PRESET_ORDER: string[] = [
  'jake-classic',
  'justins-schism',
  'super-tens',
  'chaos-shed',
  'the-69',
  'ofcom-standard',
  'backpackers-codex',
];
