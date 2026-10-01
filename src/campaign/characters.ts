/**
 * The campaign cast — one or more named opponents per variant.
 *
 * PORTRAITS: `portrait` is null until PNG art exists. To wire art in, drop a
 * transparent-background PNG (512x512 recommended, consistent style across
 * the cast) into assets/characters/ and set e.g.
 *     portrait: require('../../assets/characters/greg.png'),
 * Everything that renders a character falls back to `emoji` when portrait is
 * null, so art can land one character at a time.
 *
 * QUIPS & REACTIONS: short in-character lines shown as table-talk speech
 * bubbles on the character's strip. `quips` fire after unremarkable turns;
 * `reactions` fire situationally (their pickup, their burn, their power
 * cards, the human's pickup or burn). Keep them one-liners — bubbles clamp
 * to two lines.
 *
 * END LINES: spoken on the campaign results screen, one pool for when the
 * player beats this character and one for when the character wins.
 *
 * PLAY STYLE: `botStyle` sets how the character plays their cards (see
 * BotStyle in engine/types.ts). Leave it off for the default strategic bot.
 * Unlike portraits and quips it does NOT follow the name: setup hands it to
 * the bot only when seeding a campaign table, so a free-play bot renamed
 * "The Farmhand" gets the face and the lines but plays like any other bot.
 */
import { ImageSourcePropType } from 'react-native';
import { BotStyle, Rank, RuleConfig } from '../engine/types';

export type ReactionKind =
  | 'selfPickup'
  | 'selfBurn'
  | 'selfReset'
  | 'selfLowerThan'
  | 'selfTransparent'
  | 'humanPickup'
  | 'humanBurn';

export interface Character {
  id: string;
  /** Display name — used as the bot's player name in games. */
  name: string;
  /** Flavor subtitle, e.g. shown in dialogue or rosters. */
  title: string;
  emoji: string;
  portrait: ImageSourcePropType | null;
  /** How they play. Omitted = strategic. */
  botStyle?: BotStyle;
  /** Generic table talk after their own unremarkable turns. */
  quips: string[];
  /** Situational lines. Empty pools fall back to generic quips, except
   *  humanBurn, which only fires for characters that have lines for it. */
  reactions: Partial<Record<ReactionKind, string[]>>;
  endLines?: { playerWon: string[]; playerLost: string[] };
}

export const CHARACTERS: Record<string, Character> = {
  jake: {
    id: 'jake',
    name: 'Jake the Elder',
    title: 'Keeper of the holy teachings',
    emoji: '🧙',
    portrait: require('../../assets/characters/jake.png'),
    quips: [
      'As it was spake, so it is played.',
      'The pile provides.',
      'Meets or beats. It was always meets or beats.',
      'Shed your low cards while the pile still allows it.',
      'Save your 10 for a pile worth burning.',
      'Never waste a 2 on a 3.',
      'Mind your face-up cards. The whole table can see them.',
      'I count your cards. You should be counting mine.',
      'Hmm. I would not have played that. Continue.',
      'In my day, we played by lantern light.',
      'Every Shithead thinks they are one card from winning.',
      'I have been the Shithead. It builds character.',
    ],
    reactions: {
      selfPickup: [
        'The pile is also a teacher.',
        'The pile humbles us all.',
        'Even the Elder must carry the pile.',
        'Well played. Do not let it go to your head.',
        'I meant to do that. It was a lesson.',
      ],
      selfBurn: [
        'The pile provides. The pile removes.',
        'As foretold.',
        'Burned, and I go again. Remember that.',
        'To ash. My turn again.',
      ],
      selfReset: [
        'A 2. The pile starts over. Play what you like.',
        'Two. Back to the beginning.',
        'The 2 wipes the slate clean.',
      ],
      selfLowerThan: [
        'A 7. Seven or lower, student.',
        'Stay low. Seven or under.',
        'The 7 keeps it low. Have you anything small?',
      ],
      selfTransparent: [
        'An 8. Look through it, and beat what lies beneath.',
        'You see the 8. The pile does not.',
        'The 8 is invisible. Play on what is under it.',
      ],
      humanPickup: [
        'Even I once carried the whole pile.',
        'Heavy, is it not? Carry it anyway.',
        'Pick it up. We have all been there.',
        'You will tell a better story for this.',
      ],
      humanBurn: [
        'Good. You are learning.',
        'Now play again. The burner always does.',
        "The student burns the master's pile. Good.",
      ],
    },
    endLines: {
      playerWon: [
        'Well played. Now go, and teach it exactly as I taught you. Word for word.',
        'The student has beaten the master. Go. Carry Shed to every table in the land.',
      ],
      playerLost: [
        'You are the Shithead. For now. Deal again.',
        'Every master was once a Shithead. Deal again.',
        'No one beats the Elder on their first night. Again.',
      ],
    },
  },
  farmhand: {
    id: 'farmhand',
    name: 'The Farmhand',
    title: 'Your first pupil',
    emoji: '🌾',
    portrait: null,
    botStyle: 'novice',
    quips: [
      'Wait — the 8 goes on ANYTHING?',
      'So the 10 burns the whole pile? The WHOLE pile?',
      'Back home we mostly play snap.',
      'Is it my turn? It feels like my turn.',
      'The noble says this game will never catch on.',
      'Do the cows count as players? Asking for later.',
      'Sevens mean small ones next. Sevens mean small ones next...',
      'Which one was the burny one again?',
      'I sorted my hand by how much I like them.',
      "Don't tell the noble, but I think I'm getting good.",
    ],
    reactions: {
      selfPickup: [
        'The pile is... also mine now?',
        'A lesson, like you said. A big heavy lesson.',
        "I'll treasure every one of them.",
      ],
      selfBurn: ['I did the fire one! Did you see?', 'Just like you taught me!'],
      humanPickup: [
        'Even the teacher carries the pile?',
        'Should... should I not have played that?',
      ],
    },
  },
  noble: {
    id: 'noble',
    name: 'The Noble',
    title: 'Second pupil — insists on going first',
    emoji: '⚜️',
    portrait: null,
    botStyle: 'novice',
    quips: [
      'I was assured peasant games were simple. Explain the 8 again.',
      'In MY house, the highest card goes first.',
      'The farmhand is NOT allowed to win.',
      'I shall learn this game, then commission a better one.',
      'Are the cards aware of who I am?',
    ],
    reactions: {
      selfPickup: [
        'I am CHOOSING to take these.',
        'Consider it a tax on the table.',
        'Outrageous. Whose rule was that?',
      ],
      selfBurn: ['Naturally. Nobility burns brightest.', 'I meant to do that. Obviously.'],
      humanPickup: ['Even teachers pay taxes.', 'How wonderfully common.'],
    },
  },
  barkeep: {
    id: 'barkeep',
    name: 'The Barkeep',
    title: 'Learning between pours',
    emoji: '🍺',
    portrait: null,
    botStyle: 'novice',
    quips: [
      'One hand on the cards, one on the taps.',
      'So a 2 starts us fresh? Like closing time.',
      "If this catches on, I'm charging table fees.",
      'Hold on — someone ordered. Where were we?',
      'The regulars will never believe this game.',
    ],
    reactions: {
      selfPickup: ['Put it on my tab.', "I've spilled worse."],
      selfBurn: ["That round's on the house!", 'Cleanest table in the county.'],
      humanPickup: ['Rough night, teacher?', "I'll pour you one after this."],
    },
  },
  justin: {
    id: 'justin',
    name: 'Justin',
    title: 'First heretic of the Schism',
    emoji: '⛪',
    portrait: require('../../assets/characters/justin.png'),
    quips: [
      'The old rules were too soft.',
      'An 8 is not above the law.',
      'Jake got it wrong. Only cowards would play an 8 on a 7.',
    ],
    reactions: {
      selfPickup: ['Cowards.', 'A flaw in the rules. Not in me.', 'Noted. For the revision.'],
      selfBurn: ['Even heretics get to burn.', 'Purifying.'],
      humanPickup: ['The old rules would have saved you. Mine will not.', 'Harsh? Correct.'],
    },
  },
  greg: {
    id: 'greg',
    name: 'Greg the Computer Lord',
    title: 'Retired programmer. Active cheater.',
    emoji: '🖥️',
    portrait: require('../../assets/characters/greg.png'),
    quips: [
      'That move is legal. Trust me, I used to program.',
      "In MY version of the rules, I'm always right.",
      'I once wrote a compiler. This is nothing.',
      'Is anyone watching my hand? No? Good.',
      "101 - Switching Protocols", 
      "I'm just saying...",
    ],
    reactions: {
      selfPickup: ['You guys are cheating.', 'This deck is rigged. I would know.', 'I demand a recount.', '403 - Forbidden', '404 - Not Found', '406 - Not Acceptable'],
      selfBurn: ['Ziggy zoggy ziggy zoggy oy oy oy!', 'Computer Lord wins again.'],
      humanPickup: ['Awh, poor baby.', "Try drinking Malibu. It'll help you.", 'I could beat you in my sleep.'],
    },
  },
  'chaos-twin-a': {
    id: 'chaos-twin-a',
    name: 'Twin Aek',
    title: 'The first Chaos Twin',
    emoji: '🌀',
    portrait: require('../../assets/characters/chaos-twin-a.png'),
    quips: [
      'My brother deals in reversals.',
      'One day the jokers come back. That day, you run.',
      'Bangkok remembers.',
    ],
    reactions: {
      selfPickup: ['My brother did this.', 'Chaos takes. Chaos gives.'],
      selfBurn: ['Ash. My favorite.', 'The first twin burns brightest.'],
      humanPickup: ['The pile likes you. Keep it.', 'This pleases the twins.'],
    },
  },
  'chaos-twin-b': {
    id: 'chaos-twin-b',
    name: 'Twin Yee',
    title: 'The other Chaos Twin',
    emoji: '🌪️',
    portrait: require('../../assets/characters/chaos-twin-b.png'),
    quips: [
      'My brother lies. I deal in reversals.',
      'Which twin am I? Wrong.',
      'Nobody sleeps.',
    ],
    reactions: {
      selfPickup: ['My brother did this.', 'A reversal of fortune. Ha.'],
      selfBurn: ['Ash. HIS favorite. Mine too.', 'The second twin burns brighter.'],
      humanPickup: ["Heavy, isn't it?", 'This also pleases the twins.'],
    },
  },
  nina: {
    id: 'nina',
    name: 'Nina',
    title: 'Reads the table upside down',
    emoji: '♻️',
    portrait: null,
    quips: [
      'A six is a nine if you commit.',
      'Turn the card around. Now turn yourself around.',
      'Meant to be.',
    ],
    reactions: {
      selfPickup: ['Upside down, this is a win.', 'A setback is a comeback, reversed.'],
      selfBurn: ['Full circle.', 'Six becomes nine becomes ash.'],
      humanPickup: ['Look at it from the other side. Still bad.', 'Turn that frown... never mind.'],
    },
  },
  trevor: {
    id: 'trevor',
    name: 'Trevor from OFCOM',
    title: 'Has never missed a Thursday',
    emoji: '🏢',
    portrait: null,
    quips: [
      'We play at lunch. Every Thursday. No exceptions.',
      'Triple eights. Regulation burn.',
      'I have a laminated copy of the rules.',
    ],
    reactions: {
      selfPickup: ['Filing a formal complaint.', 'This never happens on Thursdays.'],
      selfBurn: ['Regulation burn.', 'By the book. The laminated one.'],
      humanPickup: ['I shall note that in the minutes.', 'Unfortunate. Per section 4.2.'],
    },
  },
  backpacker: {
    id: 'backpacker',
    name: 'The Backpacker',
    title: 'Wrote the Codex on a napkin',
    emoji: '🗺️',
    portrait: null,
    quips: [
      'I learned this in a hostel you will never find.',
      'Every rule at once. Keep up.',
      'The napkin never lies.',
    ],
    reactions: {
      selfPickup: ['The napkin warned of this.', 'Even the Codex has bad days.'],
      selfBurn: ['Page one of the napkin.', 'The hostel taught me that one.'],
      humanPickup: ['The Codex is unkind to tourists.', 'Carry it. Builds character.'],
    },
  },
};

/**
 * Which characters host each variant's table. Order matters: these seed the
 * bot slots on setup when arriving from the campaign map. Most tables are a
 * duel; the exceptions are The Spreading (you teach three pupils at once)
 * and the Chaos Twins (you face them together).
 */
export const VARIANT_OPPONENTS: Record<string, string[]> = {
  'jake-classic': ['jake'],
  'the-spreading': ['farmhand', 'noble', 'barkeep'],
  'justins-schism': ['justin'],
  'super-tens': ['greg'],
  'chaos-shed': ['chaos-twin-a', 'chaos-twin-b'],
  'the-69': ['nina'],
  'ofcom-standard': ['trevor'],
  'backpackers-codex': ['backpacker'],
};

/** Characters for a variant (empty array if none assigned). */
export function opponentsFor(presetId: string): Character[] {
  return (VARIANT_OPPONENTS[presetId] ?? [])
    .map((id) => CHARACTERS[id])
    .filter((c): c is Character => Boolean(c));
}

/** Reverse lookup: match an in-game player name back to a character, for
 *  portraits/quips in the opponent strip and interstitials. */
export function characterByName(name: string): Character | null {
  for (const c of Object.values(CHARACTERS)) {
    if (c.name === name) return c;
  }
  return null;
}

/** A random quip, or null ~half the time so lines don't spam every turn. */
export function maybeQuip(c: Character, chance = 0.45): string | null {
  if (c.quips.length === 0 || Math.random() > chance) return null;
  return c.quips[Math.floor(Math.random() * c.quips.length)];
}

/** Chance a line fires, per situation. Burns are the payoff — nearly always. */
const REACTION_CHANCE: Record<ReactionKind, number> = {
  selfBurn: 0.9,
  selfPickup: 0.90,
  selfReset: 0.7,
  selfLowerThan: 0.7,
  selfTransparent: 0.7,
  humanPickup: 0.6,
  humanBurn: 0.8,
};

/**
 * A situational line for `kind`, or null (per-kind probability). Falls back
 * to the generic quip pool if the character has no lines for that situation.
 */
export function maybeReaction(c: Character, kind: ReactionKind): string | null {
  const pool = c.reactions[kind];
  if (!pool || pool.length === 0) return maybeQuip(c);
  if (Math.random() > REACTION_CHANCE[kind]) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** The reaction for a character playing `rank`, if it's a power card with
 *  its own lines (burns are handled separately via selfBurn). */
export function powerReaction(rank: Rank, cfg: RuleConfig): ReactionKind | null {
  if (rank === cfg.resetRank) return 'selfReset';
  if (rank === cfg.lowerThanRank) return 'selfLowerThan';
  if (rank === cfg.transparentRank) return 'selfTransparent';
  return null;
}

/** A random end-of-game line, or null if the character has none. */
export function endLine(c: Character, playerWon: boolean): string | null {
  const pool = playerWon ? c.endLines?.playerWon : c.endLines?.playerLost;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── The disciples ───────────────────────────────────────────────────────────

/**
 * The three friends Jake taught. In the campaign the human plays as one of
 * them; the choice is stored in campaignStore and used as the player's name.
 * A null portrait renders as the name's initial.
 */
export interface Hero {
  id: string;
  name: string;
  portrait: ImageSourcePropType | null;
}

export const HEROES: Hero[] = [
  { id: 'erich', name: 'Erich', portrait: require('../../assets/characters/erich.png') },
  { id: 'nick', name: 'Nick', portrait: require('../../assets/characters/nick.png') },
  { id: 'garrett', name: 'Garrett', portrait: require('../../assets/characters/garrett.png') },
];

export function heroById(id: string | null): Hero | null {
  return HEROES.find((h) => h.id === id) ?? null;
}

export function heroByName(name: string): Hero | null {
  return HEROES.find((h) => h.name === name) ?? null;
}
