/**
 * Sound effects — short one-shot UI/game sounds.
 *
 * Design notes:
 *   - Built on expo-audio (the SDK 54 replacement for the deprecated expo-av
 *     that radioStore still uses; the radio can migrate later).
 *   - Each logical sound is a POOL of interchangeable variants from the same
 *     recording session (Kenney "Casino Audio", CC0). Repeated sounds (pile
 *     pickup, page turns) pick a random variant so rapid repeats don't sound
 *     machine-gun identical. Pools with one entry just always play it.
 *   - All players are created up front (preloadSfx) so the first tap doesn't
 *     pay a load-latency cost — a late sound feels worse than no sound.
 *   - Fire-and-forget: playSfx never throws and never blocks the UI. Audio is
 *     garnish; a failed sound should never break a turn.
 *
 * Assets are .m4a (AAC): Metro doesn't bundle .ogg by default and iOS/Safari
 * can't decode Ogg Vorbis at all. See assets/audio/README.md for the ffmpeg
 * conversion commands and licensing.
 */
import { AudioPlayer, createAudioPlayer } from 'expo-audio';

// ─── Sound pools ────────────────────────────────────────────────────────────
// require() calls must be static string literals for Metro to bundle them.

const POOLS = {
  /** Tutorial dialogue advance — soft slides + pack-open sounds read as
   *  page turns. Large pool since this fires on every line of dialogue. */
  pageTurn: [
    require('../../assets/audio/card-slide-1.m4a'),
    require('../../assets/audio/card-slide-2.m4a'),
    require('../../assets/audio/card-slide-3.m4a'),
    require('../../assets/audio/card-slide-4.m4a'),
    require('../../assets/audio/card-slide-5.m4a'),
    require('../../assets/audio/card-slide-6.m4a'),
    require('../../assets/audio/card-slide-7.m4a'),
    require('../../assets/audio/card-slide-8.m4a'),
    require('../../assets/audio/cards-pack-open-1.m4a'),
    require('../../assets/audio/cards-pack-open-2.m4a'),
  ],
  /** Game start / deal. Was a single long shuffle sample — swapped for the
   *  shorter card-fan sounds so it doesn't drag out the start-game tap. */
  shuffle: [
    require('../../assets/audio/card-fan-1.m4a'),
    require('../../assets/audio/card-fan-2.m4a'),
  ],
  /** Playing card(s) onto the pile — the most frequent sound in the game,
   *  so it gets the largest variant pool and the lowest volume. */
  cardPlace: [
    require('../../assets/audio/card-place-1.m4a'),
    require('../../assets/audio/card-place-2.m4a'),
    require('../../assets/audio/card-place-3.m4a'),
    require('../../assets/audio/card-place-4.m4a'),
  ],
  /** Picking up the play pile — a stack shoved across felt. */
  cardPickup: [
    require('../../assets/audio/card-shove-1.m4a'),
    require('../../assets/audio/card-shove-2.m4a'),
    require('../../assets/audio/card-shove-3.m4a'),
    require('../../assets/audio/card-shove-4.m4a'),
  ],
} as const;

export type SfxName = keyof typeof POOLS;

/** Per-sound volume, relative to the radio. Tune to taste: the pickup is a
 *  frequent incidental sound so it sits lower; the shuffle is a once-per-game
 *  moment so it can be more present. */
const VOLUME: Record<SfxName, number> = {
  pageTurn: 0.5,
  shuffle: 0.8,
  cardPlace: 0.45,
  cardPickup: 0.6,
};

// ─── Player pool (module-level, mirrors radioStore's pattern) ───────────────

const players: Partial<Record<SfxName, AudioPlayer[]>> = {};
let muted = false;
let preloaded = false;

/**
 * Create all players. Call once at app start (RootLayout). Safe to call
 * again — subsequent calls are no-ops.
 *
 * Note: we deliberately do NOT call setAudioModeAsync here. The radio
 * (radioStore, expo-av) already configures the global audio session —
 * playsInSilentModeIOS + staysActiveInBackground — and both libraries drive
 * the same underlying iOS AVAudioSession, so a second, different mode set
 * here would fight it. SFX simply plays within whatever session the radio
 * established; the net effect is consistent behavior (both radio and SFX
 * audible with the silent switch on).
 */
export function preloadSfx(): void {
  if (preloaded) return;
  preloaded = true;

  for (const name of Object.keys(POOLS) as SfxName[]) {
    players[name] = POOLS[name].map((source) => {
      const p = createAudioPlayer(source);
      p.volume = VOLUME[name];
      return p;
    });
  }
}

/**
 * Play a sound (random variant from its pool). Fire-and-forget: safe to call
 * rapidly, safe to call before preload (it will lazily preload), never throws.
 */
export function playSfx(name: SfxName): void {
  if (muted) return;
  if (!preloaded) preloadSfx();
  const pool = players[name];
  if (!pool || pool.length === 0) return;

  const player = pool[Math.floor(Math.random() * pool.length)];
  try {
    // seekTo(0) rewinds if this variant is mid-play or already finished, so
    // back-to-back triggers restart cleanly instead of silently no-opping.
    void player.seekTo(0);
    player.play();
  } catch {
    /* non-fatal — audio must never break gameplay */
  }
}

/** Global SFX mute, independent of the radio. */
export function setSfxMuted(m: boolean): void {
  muted = m;
}

export function isSfxMuted(): boolean {
  return muted;
}