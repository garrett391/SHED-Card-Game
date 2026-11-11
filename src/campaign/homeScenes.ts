/**
 * Home screen scenes: the table you're sat at on the main menu.
 *
 * Each scene belongs to a campaign table and is a first-person splash (same
 * seat, same hands, a different place) plus the few colours the menu takes
 * from it. Home follows the campaign by default, showing the place the
 * heroes stand; beating a table unlocks its scene, and Settings can pin any
 * unlocked one (profileStore.homeScene).
 *
 * Adding a scene: drop a 768x1376 splash in assets/images and add an entry
 * here under its table's preset id. Tables without one borrow the nearest
 * earlier scene, so art can arrive a table at a time.
 */
import { ImageSourcePropType } from 'react-native';
import { PRESET_ORDER } from './presets';

export interface HomeScene {
  /** The campaign table it belongs to (a preset id). */
  id: string;
  /** Shown in Settings. */
  name: string;
  image: ImageSourcePropType;
  /** The dark the art fades into behind the menu. */
  base: string;
  /** Title glow, the Campaign button and icons. */
  accent: string;
  /** Secondary buttons and tiles, drawn over the art. */
  panel: string;
  /** Their outline. */
  line: string;
}

export const HOME_SCENES: HomeScene[] = [
  {
    id: 'jake-classic',
    name: "Jake's old wood",
    image: require('../../assets/images/forest/splash-moonlit-wood.png'),
    base: '#081019',
    accent: '#f0b455',
    panel: 'rgba(14,28,40,0.9)',
    line: '#3d5a6e',
  },
  {
    id: 'the-spreading',
    name: 'The village tavern',
    image: require('../../assets/images/medieval/splash-medieval.png'),
    base: '#140d08',
    accent: '#e9b949',
    panel: 'rgba(40,25,12,0.9)',
    line: '#6b4d2a',
  },
  {
    id: 'justins-schism',
    name: "The heretics' cathedral",
    image: require('../../assets/images/cathedral/splash-cathedral.png'),
    base: '#0b0d0a',
    accent: '#9be37a',
    panel: 'rgba(20,27,18,0.9)',
    line: '#3f5a38',
  },
  {
    id: 'super-tens',
    name: "Greg's machine hall",
    image: require('../../assets/images/machine-hall/splash-machine-hall.png'),
    base: '#06141a',
    accent: '#5fe0d2',
    panel: 'rgba(8,30,36,0.9)',
    line: '#2c6a6c',
  },
  {
    id: 'the-pass',
    name: 'The saloon',
    image: require('../../assets/images/wild-west/splash-wild-west.png'),
    base: '#120b06',
    accent: '#eda03c',
    panel: 'rgba(38,22,10,0.9)',
    line: '#6e4a26',
  },
  {
    id: 'chaos-shed',
    name: "The twins' big top",
    image: require('../../assets/images/big-top/splash-big-top.png'),
    base: '#160b0c',
    accent: '#f0c04a',
    panel: 'rgba(44,18,22,0.9)',
    line: '#7a3a3a',
  },
  {
    id: 'second-schism',
    name: "Justin's cell",
    image: require('../../assets/images/cell/splash-cell.png'),
    base: '#0a0d12',
    accent: '#f0b25a',
    panel: 'rgba(16,22,30,0.9)',
    line: '#3a4a5c',
  },
  {
    id: 'the-council',
    name: 'The Council table',
    image: require('../../assets/images/council/splash-council.png'),
    base: '#0a1020',
    accent: '#b7d0f7',
    panel: 'rgba(14,22,42,0.9)',
    line: '#3d4f7c',
  },
];

/** What profileStore.homeScene holds when no scene is pinned. */
export const FOLLOW_CAMPAIGN = 'follow';

const sceneById = (id: string) => HOME_SCENES.find((s) => s.id === id);

/** Where the heroes stand: the first table not yet beaten, or the last one. */
export function campaignPlace(completed: Record<string, true>): string {
  return PRESET_ORDER.find((id) => !completed[id]) ?? PRESET_ORDER[PRESET_ORDER.length - 1];
}

/** Scenes that can be pinned: the first one, and any whose table is beaten. */
export function unlockedScenes(completed: Record<string, true>): HomeScene[] {
  return HOME_SCENES.filter((s) => s.id === PRESET_ORDER[0] || completed[s.id]);
}

/**
 * The scene Home shows. A pinned scene wins while it's still unlocked
 * (campaign progress can be reset); otherwise the scene of the table the
 * heroes stand at, or the nearest earlier table that has one.
 */
export function homeScene(completed: Record<string, true>, pinned: string | null): HomeScene {
  if (pinned && pinned !== FOLLOW_CAMPAIGN) {
    const scene = unlockedScenes(completed).find((s) => s.id === pinned);
    if (scene) return scene;
  }
  const at = PRESET_ORDER.indexOf(campaignPlace(completed));
  for (let i = at; i >= 0; i--) {
    const scene = sceneById(PRESET_ORDER[i]);
    if (scene) return scene;
  }
  return HOME_SCENES[0];
}
