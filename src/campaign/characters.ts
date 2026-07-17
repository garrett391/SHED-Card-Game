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
 * `reactions` fire situationally (their pickup, their burn, YOUR pickup).
 * Keep them one-liners — bubbles clamp to two lines.
 */
import { ImageSourcePropType } from 'react-native';

export type ReactionKind = 'selfPickup' | 'selfBurn' | 'humanPickup';

export interface Character {
  id: string;
  /** Display name — used as the bot's player name in games. */
  name: string;
  /** Flavor subtitle, e.g. shown in dialogue or rosters. */
  title: string;
  emoji: string;
  portrait: ImageSourcePropType | null;
  /** Generic table talk after their own unremarkable turns. */
  quips: string[];
  /** Situational lines. Empty pools fall back to generic quips. */
  reactions: Partial<Record<ReactionKind, string[]>>;
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
      'Remember, savor your magic cards.',
      "A wise player considers their opponents hand.",
      'Victory follows the patient.',
      'A single card can change a lifetime.',
      'Power is not the card but the timing.',
      'The table remembers what the players forget.',
      'A burned pile is a lesson well learned.',
      'A ten is a clean slate; treat it like a blessing.',
      'Two resets the world; use it like a prayer.',
      'Sevens are fences; know when to jump.',
      'Eights are shadows; sometimes skipping is mercy.',
      'Play for the next turn, not just this one.',
      'A good bluff is a quiet thing.',
      'The smallest card can be the sharpest blade.'
    ],
    reactions: {
      selfPickup: [
      'A lesson. The pile is also a teacher.', 
      'So it must be.',
       "Good, you're learning.", 
       "A wise move.",
      'The pile humbles us all.'
    ],
      selfBurn: [
        'The pile provides. The pile removes.',
        'As foretold.',
        'It is written.',
        'The flames of truth.',
        'The table forgives and forgets.'
      ],
      humanPickup: [
        'Even I once carried the whole pile.',
        'The teachings are hard.',
        'Play your cards wisely.',
        'A heavy hand makes a light teacher.',
        'You will tell a better story for this.'
      ],
    },
  },
  farmhand: {
    id: 'farmhand',
    name: 'The Farmhand',
    title: 'Your first pupil',
    emoji: '🌾',
    portrait: null,
    quips: [
      'Wait — the 8 goes on ANYTHING?',
      'So the 10 burns the whole pile? The WHOLE pile?',
      'Back home we mostly play snap.',
      'Is it my turn? It feels like my turn.',
      'The noble says this game will never catch on.',
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
 * bot slots on setup when arriving from the campaign map. The Chaos Twins
 * are the only two-bot table — you face them together.
 */
export const VARIANT_OPPONENTS: Record<string, string[]> = {
  'jake-classic': ['jake'],
  'the-spreading': ['farmhand'],
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
  humanPickup: 0.6,
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
