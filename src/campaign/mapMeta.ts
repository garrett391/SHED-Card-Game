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
    emoji: '🌀',
    color: '#3aa0c9',
    tagline: 'The Twins deal in Bangkok. Nobody sleeps.',
  },
  'the-69': {
    emoji: '♻️',
    color: '#4caf7d',
    tagline: 'Some combinations are just meant to be.',
  },
  'ofcom-standard': {
    emoji: '🏢',
    color: '#7f8c9b',
    tagline: 'They never miss a Thursday.',
  },
  'backpackers-codex': {
    emoji: '🗺️',
    color: '#c0392b',
    tagline: 'Everything at once. Written on a napkin in Chiang Mai.',
  },
};

/** Fallback for presets without an entry (future-proofing). */
export const DEFAULT_SCENE: MapScene = {
  emoji: '🂠',
  color: '#f4c430',
  tagline: '',
};