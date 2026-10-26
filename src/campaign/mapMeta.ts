/**
 * Campaign map scene metadata — one entry per preset in PRESET_ORDER.
 *
 * This is presentation-only: the emoji/color/tagline give each node a visual
 * identity until real art exists. When illustrated node art lands, add an
 * `image` field here and the map screen swaps emoji for images — nothing
 * else needs to change.
 *
 * Taglines are shown only once a node is UNLOCKED; locked nodes show an
 * unlock hint instead (rule discovery is part of the campaign's reveal —
 * same choice as the setup screen).
 */

export interface MapScene {
  emoji: string;
  /** Node accent when unlocked. Locked nodes ignore this and render dark. */
  color: string;
  /** One-line scene-setter under the node name. */
  tagline: string;
}

export const MAP_SCENES: Record<string, MapScene> = {
  'jake-classic': {
    emoji: '🃏',
    color: '#f4c430', // table gold — where it all began
    tagline: 'The table where it all began.',
  },
  'the-spreading': {
    emoji: '🌕',
    color: '#8fa9c9', // moonlit road — the disciples set out
    tagline: 'Carry the teachings to a town that has never known the game.',
  },
  'justins-schism': {
    emoji: '⛪',
    color: '#8e6fc0',
    tagline: 'The heretics play by harder rules.',
  },
  'super-tens': {
    emoji: '🔥',
    color: '#e2712e',
    tagline: 'Nothing stops the burn.',
  },
  'chaos-shed': {
    emoji: '🎪',
    color: '#8e44ad',
    tagline: 'Two jokers, two twins, no sense at all.',
  },
  'second-schism': {
    emoji: '🕯️',
    color: '#a83246',
    tagline: 'Justin is back, and his law is harder.',
  },
  'the-council': {
    emoji: '⚖️',
    color: '#5b6fa8',
    tagline: 'Every schism, one table.',
  },
};

/** Fallback for presets without an entry (future-proofing). */
export const DEFAULT_SCENE: MapScene = {
  emoji: '🂠',
  color: '#f4c430',
  tagline: '',
};