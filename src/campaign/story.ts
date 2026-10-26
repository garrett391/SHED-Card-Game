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
        'Erich, Nick and Garrett.\nThey loved games, jokes, and a pint of ale.',
    },
    {
      image: require('../../assets/story/intro2.png'),
      caption:
        'One night, a stranger burst in.\nNothing would ever be the same.',
    },
    {
      image: require('../../assets/story/intro3.png'),
      caption:
        'He called himself Jake the Elder.\nIn the old wood, he taught them\nthe ancient ways of Shed.',
    },
    {
      image: require('../../assets/story/intro4.png'),
      caption:
        'First, the one law: meets or beats.\nThen he revealed the four sacred cards.',
    },
    {
      // The art shows only the 2, 7 and 10; the missing 8 is the joke.
      image: require('../../assets/story/intro5.png'),
      caption:
        'The 2 resets. The 7 keeps it low.\nThe 10 burns it all.\nAnd the 8? The 8 you never see.',
    },
    {
      image: require('../../assets/story/its_all_up_here.png'),
      caption:
        'Jake wrote none of it down.\nThe rules lived only in the telling.',
    },
    {
      image: require('../../assets/story/the_duel.png'),
      caption:
        'Night after night, they lost and learned,\nuntil each could face the master alone.',
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
      image: null,
      caption:
        'The disciples heard the next table before they saw it: laughter, and the sound of cards hitting the floor.',
    },
    {
      image: require('../../assets/story/chaos-twins-card.png'),
      caption:
        'Gio and Tati, the Chaos Twins. They never broke the old rules. They just added two cards nobody could predict.',
    },
    {
      image: null,
      caption:
        'The red joker turns the table around. The black joker steals your hand and gives you theirs. You face them together, or not at all.',
    },
  ],
};
