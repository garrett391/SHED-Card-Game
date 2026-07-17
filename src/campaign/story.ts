/**
 * Campaign story — between-level cinematics.
 *
 * A cinematic is a sequence of SCENES: full-screen image + caption, advanced
 * by tap (with a Skip button). One plays the FIRST time a node is entered
 * from the campaign map; `seenCinematics` in campaignStore ensures
 * once-only. The lore behind these beats lives in
 * docs/design/campaign-lore.md.
 *
 * ART: `image` accepts anything expo-image renders — PNG, and also animated
 * GIF/WebP (drop a GIF in assets/story/ and require it exactly like a PNG;
 * no code change). Scenes with image: null render as caption-only title
 * cards on the felt, so beats can be written before art exists.
 *
 * All captions are first drafts — edit freely, this is your story.
 */
import { ImageSourcePropType } from 'react-native';

export interface Scene {
  image: ImageSourcePropType | null;
  caption: string;
}

export type Cinematic = Scene[];

/** Keyed by preset id; plays on first entry to that node. */
export const CINEMATICS: Record<string, Cinematic> = {
  // ── The origin — plays before your very first game ─────────────────────
  'jake-classic': [
    {
      image: null,
      caption:
        'Once upon a time, in a distant land, there lived three ordinary friends.',
    },
    {
      image: require('../../assets/story/intro1.png'),
      caption:
        'They enjoyed the simple things in life.\nGames, jokes, and a pint of ale.',
    },
    {
      image: require('../../assets/story/intro2.png'),
      caption:
        'One night, a stranger blew into town\n Nothing would ever be the same.',
    },
    {
      image: require('../../assets/story/intro3.png'),
      caption:
        'Jake the Elder taught them the ancient ways of Shed.',
    },
    {
      image: require('../../assets/story/intro4.png'),
      caption:
        'He showed them the sacred cards.\n2, 7, 8 and 10.',
    },
    {
      image: require('../../assets/story/intro5.png'),
      caption:
        "and instructed them on various techniques.",
    },
    {
      image: require('../../assets/story/intro6.png'),
      caption:
        "After much strife, the game was learned,\nand the students could duel their master...",
    },
  ],

  // ── The spreading — Act II, the disciples become teachers ──────────────
  'the-spreading': [
    {
      image: require('../../assets/story/teaching1.png'),
      caption:
        'After they mastered the craft, Jake the elder instructed them to spread the teachings throughout the land.',
    },
    {
      image: require('../../assets/story/teaching2.png'),
      caption:
        'So they set out beneath the full moon,\ntoward a town that had never known the game.',
    },
    {
      image: require('../../assets/story/teaching3.png'),
      caption:
        'They taught all who would sit.\nFarmhand and noble alike rose from the table changed.',
    },
    {
      image: null,
      caption:
        'For a time, there was harmony at every table...',
    },
  ],

  // ── The first schism ────────────────────────────────────────────────────
  'justins-schism': [
    {
      image: null,
      caption: 'Just as night must fall for a single star to pierce the veil, every golden age is tethered to the gravity of its own dark age...',
    },
    {
      image: null,
      caption: 'Word arrived from the east: a table that no longer played true.',
    },
    {
      image: require('../../assets/story/schism-justin1.png'),
      caption:
        'Justin. First of the dissenters. He believed not even the 8 stood above the law.',
    },
    {
      image: require('../../assets/story/schism-justin2.png'),
      caption:
        'He preached that the old rules were too soft, and that HIS way was the only true path.',
    },
    {
      image: require('../../assets/story/schism-justin3.png'),
      caption: 'The redemption begins at his table, by his design.',
    },
  ],

  // ── The Computer Lord ───────────────────────────────────────────────────
  'super-tens': [
    {
      image: require('../../assets/story/schism-justin-defeated.png'),
      caption:
        'One false teaching had fallen, yet victory brought no peace. Wherever the disciples traveled, they found the teachings bending into stranger shapes.',
    },
    {
      image: require('../../assets/story/greg-computer-lord1.png'),
      caption:
        "Far below Justin's dominion sat another table, where no rule was ever broken—only remembered differently.",
    },
    {
      image: require('../../assets/story/greg-computer-lord2.png'),
      caption:
        'Its master was Greg, the Computer Lord. Once a keeper of ancient machines, they say he could make them obey with nothing but brackets and impeccable memory.',
    },
    {
      image: null,
      caption:
        'Greg never admitted to changing the rules. He simply explained, with perfect confidence, that they had always been this way.',
    },
  ],

  // ── The Chaos Twins ─────────────────────────────────────────────────────
  'chaos-shed': [
    {
      image: require('../../assets/story/chaos-twins-card.png'),
      caption:
        'Of the Chaos Twins, only a card survives. Power 9. Mischief 13. Effect: PRANKOCALYPSE.',
    },
    {
      image: null,
      caption:
        'They deal in Bangkok, where the 9s run backwards and nobody sleeps. You face them together, or not at all.',
    },
  ],

  // ── Later circles — caption-only drafts until art lands ────────────────
  'the-69': [
    {
      image: null,
      caption:
        'Nina reads the table upside down. From where she sits, your descent looks like a climb.',
    },
  ],
  'ofcom-standard': [
    {
      image: null,
      caption:
        'The teachings reached the offices, and the offices did what offices do: laminated them. Trevor has never missed a Thursday.',
    },
  ],
  'backpackers-codex': [
    {
      image: null,
      caption:
        'Every schism, every corruption, every rule at once — scrawled on a napkin in a Chiang Mai hostel. The final trial.',
    },
  ],
};
