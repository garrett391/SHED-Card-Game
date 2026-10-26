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

/** The campaign's current ending: plays after the last node is beaten and
 *  hands back to the map instead of a table. Not a preset id. When Chris's
 *  table exists, this becomes the lead-in to his node. */
export const ENDING_ID = 'ending';

/** Keyed by preset id (plays whenever that node is entered from the map),
 *  plus ENDING_ID. */
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
      image: require('../../assets/story/intro-multiples.jpg'),
      caption:
        'Cards of the same rank may be played together. Lay down all four, and the pile burns.',
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
        'Once they had mastered the game, Jake sent them out to carry the teachings to every corner of the land.',
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
      image: require('../../assets/story/intro6.png'),
      caption:
        'For a time, there was harmony at every table…',
    },
  ],

  // ── The first schism ────────────────────────────────────────────────────
  'justins-schism': [
    {
      image: require('../../assets/story/schism-shadow.jpg'),
      caption:
        'But every golden age casts a shadow. Not everyone who learned the game was content to play it as Jake had taught.',
    },
    {
      image: null,
      caption: 'Word arrived from a distant land: a table that no longer played true.',
    },
    {
      image: require('../../assets/story/schism-justin1.png'),
      caption:
        'Justin. First of the dissenters. He believed not even the 8 stood above the law.',
    },
    {
      image: require('../../assets/story/schism-justin2.png'),
      caption:
        "He preached that Jake's rules were too soft, and that his way was the only true path.",
    },
    {
      image: require('../../assets/story/schism-justin3.png'),
      caption:
        'To end the schism, the disciples would have to beat him at his own table, by his own rules.',
    },
  ],

  // ── The Computer Lord ───────────────────────────────────────────────────
  'super-tens': [
    {
      image: require('../../assets/story/schism-justin-defeated.png'),
      caption: "Justin's schism had fallen, but there was no peace.",
    },
    {
      image: require('../../assets/story/wildfire.jpg'),
      caption:
        'Word of the game had spread like wildfire, faster than the disciples could follow. Wherever it landed, the rules came back bent into stranger shapes.',
    },
    {
      image: require('../../assets/story/greg-journey1.jpg'),
      caption:
        "Beyond Justin's lands, the road changed under their feet. The grass grew in straight lines. The trees began to hum.",
    },
    {
      image: require('../../assets/story/greg-journey2.jpg'),
      caption:
        'Robot peasants worked fields of copper and wire. None had met Jake, yet all of them knew the rules, as their ruler had taught them.',
    },
    {
      image: require('../../assets/story/greg-computer-lord1.png'),
      caption:
        'At the heart of this strange land sat a table where no rule was ever broken, only remembered differently.',
    },
    {
      image: require('../../assets/story/greg-computer-lord2.png'),
      caption:
        'Its master: Greg, the Computer Lord, keeper of ancient machines. They obeyed him through brackets and an impeccable memory.',
    },
    {
      image: null,
      caption:
        'Greg never admitted to changing the rules. He simply explained, with perfect confidence, that 10s had always burned through 7s.',
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

  // ── The schism returns ──────────────────────────────────────────────────
  'second-schism': [
    {
      image: null,
      caption: 'Peace never lasts long. Justin had not given up. He had only gone quiet.',
    },
    {
      image: require('../../assets/story/schism-justin2.png'),
      caption: 'Now he preached a harder law: not even the 10 may burn a face card.',
    },
    {
      image: require('../../assets/story/schism-justin3.png'),
      caption: 'His 8s still bow to the 7. And this time, he does not sit alone.',
    },
  ],

  // ── The semi-finale: every dissenter at one table ───────────────────────
  'the-council': [
    {
      image: null,
      caption: 'One by one, the dissenters had fallen. Then word came that they had stopped fighting each other.',
    },
    {
      image: null,
      caption: 'Justin, Greg, Gio and Tati: every schism, gathered at a single table.',
    },
    {
      image: null,
      caption: "Each would play by their own rules, on their own turn. The disciples would play by Jake's.",
    },
    {
      image: null,
      caption: 'Win, and the teachings hold. Lose, and every table goes back to arguing.',
    },
  ],

  // ── The ending (for now): the fog lifts a little ───────────────────────
  [ENDING_ID]: [
    {
      image: null,
      caption:
        'The Council broke apart, each dissenter back to their own table. For the first time in a long while, every table played true.',
    },
    {
      image: require('../../assets/story/ending-north.png'),
      caption:
        'Then the fog at the edge of the world began to thin, and a tower no map had ever shown rose out of it.',
    },
    {
      image: require('../../assets/story/ending-tower.png'),
      caption:
        'In its highest window, a single light. Someone up there was writing.',
    },
    {
      image: null,
      caption:
        'And with every stroke of the quill, the rules somewhere changed a little more.',
    },
    {
      image: null,
      caption: 'To be continued…',
    },
  ],
};
