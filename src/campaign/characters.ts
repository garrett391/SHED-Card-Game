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
 * player beats this character and one for when the character wins. A
 * character who hosts more than one table (Justin, Greg) can give a table
 * its own pools in `tableEndLines`, keyed by preset id; `endLines` covers
 * every other table. At a shared table one host with lines, picked at
 * random, speaks.
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
  | 'humanBurn'
  // The stick-up (bandits): spoken inside the stick-up panel, not as table
  // talk. `{card}` in a selfRob line is the card they took.
  | 'selfRob'
  | 'selfRobPassed';

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
  /** The preset whose rules they play by at a seat-rules table (the
   *  Council): their own schism. */
  homeTable?: string;
  /** Generic table talk after their own unremarkable turns. */
  quips: string[];
  /** Situational lines. Empty pools fall back to generic quips, except
   *  humanBurn, which only fires for characters that have lines for it. */
  reactions: Partial<Record<ReactionKind, string[]>>;
  endLines?: EndLines;
  /** Per-table end lines, keyed by preset id. Win over `endLines`. */
  tableEndLines?: Record<string, EndLines>;
}

export interface EndLines {
  playerWon: string[];
  playerLost: string[];
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
    endLines: {
      playerWon: [
        "You won, and I think I understood about half of why. That's twice what I understood yesterday!",
        "Wait till the cows hear about this. Teach me the burny one again tomorrow?",
      ],
      playerLost: [
        "I WON? Is that allowed? You're a very good teacher. Or I'm a natural. Probably both.",
        "Don't feel bad. I had the cows to practise on.",
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
    endLines: {
      playerWon: [
        "Beaten by the teacher. Acceptable. The farmhand did not win, which is what matters.",
        "I shall commission a portrait of this game. You may stand somewhere in the background.",
      ],
      playerLost: [
        "Victory suits me. I expected nothing less of a game played on my good table.",
        "A noble lesson for the teacher. You may keep the pile, as a gift.",
      ],
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
    endLines: {
      playerWon: [
        "Good game. First round's on the house, second round you teach the regulars.",
        "Every table in here will be playing this by closing time. Mark my words.",
      ],
      playerLost: [
        "Beat the teacher on my first night! Drinks for everyone. Not you.",
        "Don't take it hard. Nobody wins against the house.",
      ],
    },
  },
  acolyte: {
    id: 'acolyte',
    name: 'The Acolyte',
    title: "Justin's newest follower",
    emoji: '🕯️',
    portrait: null,
    quips: [
      'Brother Justin says the 8 must kneel.',
      'I used to play the soft way. I am ashamed.',
      'Every card under the law. Every card.',
    ],
    reactions: {
      selfPickup: ['A test of faith.', 'I deserved that.'],
      selfBurn: ['For the new law!'],
      humanPickup: ['The law is the law.', 'Repent, and pick up.'],
    },
    endLines: {
      playerWon: [
        "Brother Justin will know what to do. He always knows.",
        "Maybe the soft way wasn't... no. No. I won't think it.",
      ],
      playerLost: [
        "The law provides. I will light a candle for your soft rules.",
        "You see? Without 8s, there is nowhere to hide.",
      ],
    },
  },
  zealot: {
    id: 'zealot',
    name: 'The Zealot',
    title: "Justin's most devoted follower",
    emoji: '🔥',
    portrait: null,
    quips: [
      'Soft rules make soft players.',
      'Every 8 we found, we burned.',
      'Justin wrote it. I believe it.',
    ],
    reactions: {
      selfPickup: ['The law tests the faithful.', 'Hmph.'],
      selfBurn: ['Burn the heresy!', 'Cleansed.'],
      humanPickup: ['Heretic.', 'Your soft rules cannot save you here.'],
    },
    endLines: {
      playerWon: [
        "Burn the cards, burn the chapel. The law outlives us both.",
        "This changes nothing. We will find more 8s, and we will burn them too.",
      ],
      playerLost: [
        "The heresy is ash. Go home and tell Jake.",
        "No 8s, no mercy. Next time, bring better faith.",
      ],
    },
  },
  justin: {
    id: 'justin',
    name: 'Justin',
    title: 'First heretic of the Schism',
    emoji: '⛪',
    // His first schism: the Second Schism removes 8s from the deck, which
    // one seat can't do at a shared table.
    homeTable: 'justins-schism',
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
    tableEndLines: {
      'justins-schism': {
        playerWon: [
          'This proves nothing. The old rules are still too soft, and I will be back to say so.',
          'A soft win, for soft rules. Enjoy it. Heresies do not stay buried.',
        ],
        playerLost: [
          'You felt that, did you not? The 8 kneels now. Tell Jake.',
          'Under my law, nothing escapes a 7. Not even you.',
        ],
      },
      'second-schism': {
        playerWon: [
          'Twice. Twice you have beaten me, and still the 8 is wrong.',
          'Burn my chapel, then. Someone has already written the next chapter.',
        ],
        playerLost: [
          'No 8s. No argument. No mercy. That is the true teaching.',
          'You came back to a chapel without 8s, and you lost in it. Fitting.',
        ],
      },
      'the-council': {
        playerWon: [
          'Fine. You have beaten all of us at once. But we were not the ones who set the empty chair.',
          'Every schism at one table, and every schism falls. Then whose rules are left?',
        ],
        playerLost: [
          'The Council has spoken. Every table, every rule, and none of them Jake\'s.',
          'Four schisms against one teaching. You were never going to win.',
        ],
      },
    },
  },
  greg: {
    id: 'greg',
    name: 'Greg the Computer Lord',
    title: 'Retired programmer. Active cheater.',
    emoji: '🖥️',
    homeTable: 'super-tens',
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
    endLines: {
      playerWon: [
        "Rollback. Rollback! Who pushed this to production?",
        "500 - Internal Server Error. That one is on me. Do not tell anyone.",
      ],
      playerLost: [
        "Computer Lord wins again. The code was always on my side.",
        "Ziggy zoggy! Have you tried turning your strategy off and on again?",
      ],
    },
    tableEndLines: {
      'the-council': {
        playerWon: [
          'Merge conflict. Four rulebooks, one table, and you broke all of them.',
        ],
        playerLost: [
          'See? Once everyone runs my patch, the bugs are all yours.',
        ],
      },
    },
  },
  'bandit-chief': {
    id: 'bandit-chief',
    name: 'The Bandit Chief',
    title: 'Holds the pass. Sells the rules.',
    emoji: '🤠',
    portrait: null,
    homeTable: 'bandit',
    quips: [
      'Rulebooks! Fresh copies! Every rule you need and a few you don\'t.',
      'Nobody plays the old way out here. Nobody buys the old way, either.',
      'Read the fine print, friend. Somebody wrote it very carefully.',
    ],
    reactions: {
      selfPickup: ['Put it on my tab.', 'Well. That was not in the book.'],
      selfBurn: ['Burn the evidence!'],
      selfLowerThan: ['Stick \'em up.', 'Seven says hand it over.'],
      selfRob: [
        'This is a hold up!',
        'Now just pass over that {card} and no one gets hurt.',
        'Stick \'em up. The {card}, nice and slow.',
      ],
      selfRobPassed: [
        'I couldn\'t possibly steal from the needy.',
        'You should be the one robbing!',
      ],
      humanPickup: ['Pleasure doing business.', 'Pay the toll, partner.'],
    },
    endLines: {
      playerWon: [
        "Fine. The pass is yours. But every rule you'll meet past here, someone sold first.",
        "Take the road, partner. Keep the book, too. You'll be needing the fine print.",
      ],
      playerLost: [
        "Pleasure doing business. Same toll tomorrow.",
        "Come back when you can afford the whole rulebook.",
      ],
    },
  },
  'bandit-lookout': {
    id: 'bandit-lookout',
    name: 'The Lookout',
    title: 'Saw you coming a mile off',
    emoji: '🌵',
    portrait: null,
    homeTable: 'bandit',
    quips: [
      'Saw your dust three valleys back.',
      'Boss says the book is always right.',
      'Nice King you got there. Shame if it wandered off.',
    ],
    reactions: {
      selfPickup: ['Ugh. Sand in my cards.', 'That\'s fine. That\'s fine.'],
      selfBurn: ['Whoo! Fireworks!'],
      selfLowerThan: ['Toll\'s due.', 'Yoink.'],
      selfRob: [
        'GIMME WHAT YOU GOT!',
        'Yoink. Thanks for the {card}.',
      ],
      selfRobPassed: [
        'Get along, lil brokie.',
        'You should be the one robbing!',
      ],
      humanPickup: ['Long way home with all those.', 'Should\'ve paid the toll.'],
    },
    endLines: {
      playerWon: [
        "Boss said you'd never get through. Boss says a lot of things.",
        "Go on, then. Past the pass it's all sand and laughter. Hate the laughter.",
      ],
      playerLost: [
        "Told you I saw you coming. Saw you losing, too.",
        "Nice King you had there. Had.",
      ],
    },
  },
  gio: {
    id: 'gio',
    name: 'Gio',
    title: 'The laughing half of the Chaos Twins',
    emoji: '🤡',
    homeTable: 'chaos-shed',
    portrait: require('../../assets/characters/gio.png'),
    quips: [
      'Ha! Ha ha. Sorry. I just pictured your face two turns from now.',
      'Rules are jokes nobody laughs at anymore. I laugh at all of them.',
      'Every card is wild if you squint hard enough!',
      "Don't look at the pile. The pile is looking at you.",
      'Tati, tell them the joke. No, the OTHER joke.',
    ],
    reactions: {
      selfPickup: ['Oh, I WANTED those. Every last one.', 'Delicious. More! MORE!'],
      selfBurn: ['Fire! Everybody loves a little fire!', 'Poof! Gone! Just like your plan.'],
      selfReset: ['Back to the start! My favorite part of any story.'],
      humanPickup: ['Hold them close. They are all you have now.', 'Ohhh, that is a HEAVY one. Hahaha!'],
      humanBurn: ['Burn it! Burn it ALL! ...Wait, that was ours.'],
    },
    endLines: {
      playerWon: [
        'You beat us? HA! That is the funniest thing that has happened all night!',
        'Fine. Go. But the deck remembers, and the deck has a sense of humor.',
      ],
      playerLost: [
        'Again! Again! Deal it again and let us see you squirm!',
        'Do not cry. Laugh. It hurts less. Hahaha!',
      ],
    },
  },
  tati: {
    id: 'tati',
    name: 'Tati',
    title: 'The giggling half of the Chaos Twins',
    emoji: '🎭',
    homeTable: 'chaos-shed',
    portrait: require('../../assets/characters/tati.png'),
    quips: [
      'Shh. Do you hear that? The deck is giggling.',
      'Order is just chaos that has not heard the punchline yet.',
      'Pick a card. Any card. No, not that one. Hehehe.',
      'Have you read the book? Everyone has read the book.',
      'I swapped hands with my reflection once. She cheats.',
      'Gio, they think there are rules. Isn\'t that ADORABLE?',
    ],
    reactions: {
      selfPickup: ['My pile! My lovely, terrible pile!', 'Gio! They took my dignity! Get it back!'],
      selfBurn: ['Kaboom. Say it with me. KA-BOOM.', 'Burn it all and dance in the ash!'],
      selfTransparent: ['Now you see it. Now you never did.'],
      humanPickup: ['Aww, it is yours now. Name it. Feed it.', 'Hehehe. Hahaha. HAHAHAHA!'],
    },
    endLines: {
      playerWon: [
        'You won. Now everything is backwards. Isn\'t it wonderful?',
        'We let you win. Or did we? We did not. Or did we?',
      ],
      playerLost: [
        'Shuffle up! Nobody leaves the party until it stops being fun!',
        'Oh, do not look so serious. It is only your whole journey.',
      ],
    },
  },
};

/**
 * Which characters host each variant's table. Order matters: these seed the
 * bot slots on setup when arriving from the campaign map. Most tables are a
 * duel; the exceptions are The Spreading (you teach three pupils at once),
 * the Outlaw Pass (two bandits),
 * the Chaos Twins (you face them together), the Second Schism (Justin
 * brings followers) and the Council (every dissenter at once).
 */
export const VARIANT_OPPONENTS: Record<string, string[]> = {
  'jake-classic': ['jake'],
  'the-spreading': ['farmhand', 'noble', 'barkeep'],
  'justins-schism': ['justin'],
  'super-tens': ['greg'],
  'the-pass': ['bandit-chief', 'bandit-lookout'],
  'chaos-shed': ['gio', 'tati'],
  'second-schism': ['justin', 'acolyte', 'zealot'],
  'the-council': ['justin', 'greg', 'gio', 'tati'],
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

/** A random quip, or null about two times in three so lines don't spam every turn. */
export function maybeQuip(c: Character, chance = 0.35): string | null {
  if (c.quips.length === 0 || Math.random() > chance) return null;
  return c.quips[Math.floor(Math.random() * c.quips.length)];
}

/** Chance a line fires, per situation. Burns are the payoff — nearly always. */
const REACTION_CHANCE: Record<ReactionKind, number> = {
  selfBurn: 0.8,
  selfPickup: 0.75,
  selfReset: 0.55,
  selfLowerThan: 0.55,
  selfTransparent: 0.55,
  humanPickup: 0.5,
  humanBurn: 0.7,
  selfRob: 0.85,
  selfRobPassed: 0.85,
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

/** A bandit's line for the stick-up panel, or null. Unlike maybeReaction
 *  there's no fallback to generic quips: the panel stays quiet instead. */
export function robLine(c: Character, kind: 'selfRob' | 'selfRobPassed', card?: string): string | null {
  const pool = c.reactions[kind];
  if (!pool || pool.length === 0 || Math.random() > REACTION_CHANCE[kind]) return null;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return card ? line.replace('{card}', card) : line.replace(' {card}', '').replace('{card}', 'that');
}

/** The reaction for a character playing `rank`, if it's a power card with
 *  its own lines (burns are handled separately via selfBurn). */
export function powerReaction(rank: Rank, cfg: RuleConfig): ReactionKind | null {
  if (rank === cfg.resetRank) return 'selfReset';
  if (rank === cfg.lowerThanRank) return 'selfLowerThan';
  if (rank === cfg.transparentRank) return 'selfTransparent';
  return null;
}

/** The end lines a character speaks at a table: that table's own, else
 *  their general lines. */
export function endLinesFor(c: Character, presetId?: string): EndLines | undefined {
  return (presetId && c.tableEndLines?.[presetId]) || c.endLines;
}

/** A random end-of-game line, or null if the character has none. */
export function endLine(c: Character, playerWon: boolean, presetId?: string): string | null {
  const lines = endLinesFor(c, presetId);
  const pool = playerWon ? lines?.playerWon : lines?.playerLost;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
