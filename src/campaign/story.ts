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
        'Every golden age casts a shadow. Not everyone who learned the game was content to play it as Jake had taught.',
    },
    {
      image: require('../../assets/story/schism-theses.jpg'),
      caption: 'Word arrived from a distant land: a table that no longer played true.',
    },
    {
      image: require('../../assets/story/schism-justin1.jpg'),
      caption:
        'The blasphemer was Justin, first of the dissenters. He taught that an 8 could never be played on a 7: not even the 8 stood above the law.',
    },
    {
      image: require('../../assets/story/schism-justin2.png'),
      caption:
        "He preached that Jake's rules were too soft, and that his way was the only true path.",
    },
    {
      image: require('../../assets/story/schism-approach.jpg'),
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
        'At the heart of this strange land sat a table where the rules were whatever its master said they were.',
    },
    {
      image: require('../../assets/story/greg-computer-lord2.png'),
      caption:
        'Its master: Greg, the Computer Lord, keeper of ancient machines. He wrote rules the way he wrote code, and his machines ran them without question.',
    },
    {
      image: require('../../assets/story/greg-rules.jpg'),
      caption:
        "Greg didn't bother arguing with Jake's rules. He simply wrote his own, and in Greg's rules, 10s burn through 7s.",
    },
    {
      image: require('../../assets/story/greg-challenge.jpg'),
      caption:
        'There was only one way to shut his rules down: beat the Computer Lord at his own table, by his own code.',
    },
  ],

  // ── The Outlaw Pass ─────────────────────────────────────────────────────
  'the-pass': [
    {
      image: require('../../assets/story/pass-greg-fallen.jpg'),
      caption: "Greg's machines fell silent, every screen frozen mid-thought. His rules ran no more.",
    },
    {
      image: require('../../assets/story/pass-to-desert.jpg'),
      caption: 'Past the last of the circuitry, the land dried out. Cables turned to roots, and the roots turned to sand.',
    },
    {
      image: require('../../assets/story/pass-ambush.jpg'),
      caption: 'For days, the only road ran toward the red rocks, and into a narrow canyon pass. Halfway through, bandits sprang from the rocks. Nobody crossed without paying the toll.',
    },
    {
      image: require('../../assets/story/pass-rulebooks.jpg'),
      caption: 'Their wagon was piled high with rulebooks, copied by hand and sold in every town. Each was sealed with a golden quill.',
    },
    {
      image: require('../../assets/story/pass-stickup.jpg'),
      caption: 'Out here, a 7 is a stick-up: whenever a bandit plays one, they take your best card and leave you their worst.',
    },
  ],

  // ── The Chaos Twins ─────────────────────────────────────────────────────
  'chaos-shed': [
    {
      image: require('../../assets/story/pass-defeated.jpg'),
      caption:
        "The bandits lost their game, and their nerve. The disciples held up one of the rulebooks. 'Who is writing these?'",
    },
    {
      image: require('../../assets/story/pass-answer.jpg'),
      caption:
        "The Chief only shrugged. 'We just copy them. The originals come from somewhere out past the dunes, from someone who signs with a quill.' He pointed into the desert.",
    },
    {
      image: require('../../assets/story/twins-desert.jpg'),
      caption:
        'Beyond the pass, the desert opened wide. The disciples heard the next table before they saw it: laughter, and the sound of cards hitting the sand.',
    },
    {
      image: require('../../assets/story/twins-intro.jpg'),
      caption:
        'The laughter belonged to Gio and Tati, the Chaos Twins. They never broke the old rules. They just added two cards nobody could predict.',
    },
    {
      image: require('../../assets/story/twins-jokers.jpg'),
      caption:
        'The red joker turns the table around. The black joker steals your hand and gives you theirs. You face them together, or not at all.',
    },
    {
      image: require('../../assets/story/twins-scribe.jpg'),
      caption: "Tati giggled as she dealt. 'The Scribe says there are no rules. Only drafts.'",
    },
  ],

  // ── The schism returns ──────────────────────────────────────────────────
  'second-schism': [
    {
      image: require('../../assets/story/twins-defeated.jpg'),
      caption:
        "The twins lost, and laughed anyway. When the disciples pressed them about the Scribe, Tati only winked. 'You'll meet. Everyone does, eventually.'",
    },
    {
      image: require('../../assets/story/second-schism1.jpg'),
      caption:
        'The disciples thought they had brought peace, but peace never lasts long. Far behind them, Justin had not given up. He had only gone quiet.',
    },
    {
      image: require('../../assets/story/second-schism-visitor.jpg'),
      caption:
        'One night, he had a visitor. By morning, the cell was empty.',
    },
    {
      image: require('../../assets/story/second-schism2.jpg'),
      caption: 'Free again, Justin preached to a bigger, angrier congregation: the 8 itself was the heresy. As long as one existed, someone would play it on a 7.',
    },
    {
      image: require('../../assets/story/schism-justin3.png'),
      caption: 'So his followers burned every deck that still played the old way, and every 8 they could find, once and for all.',
    },
    {
      image: require('../../assets/story/second-schism-approach.jpg'),
      caption:
        "Word reached the disciples deep in the desert: Justin's followers had seized the great cathedral, and smoke rose from its steps day and night. They turned back.",
    },
    {
      image: require('../../assets/story/second-schism4.jpg'),
      caption: 'At his new table there are no 8s at all. And this time, he does not sit alone.',
    },
  ],

  // ── The semi-finale: every dissenter at one table ───────────────────────
  'the-council': [
    {
      image: require('../../assets/story/council-justin-fallen.jpg'),
      caption:
        "Justin's second schism fell harder than his first. Among the ashes of his cathedral, the disciples found the letter.",
    },
    {
      image: require('../../assets/story/council-summons.jpg'),
      caption:
        "It wasn't a pardon. It was a summons, calling every dissenter to a single table. The disciples had seen that seal before, on the floor of Greg's hall.",
    },
    {
      image: require('../../assets/story/council-table.jpg'),
      caption:
        'Justin, Greg, Gio and Tati sat waiting. At the head of the table stood an empty chair, a quill and inkwell waiting before it.',
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
