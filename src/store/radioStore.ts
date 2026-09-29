/**
 * Radio store — multi-station internet radio.
 *
 * Behavior:
 *   - Audio starts PAUSED — the user must click play to hear anything.
 *     This avoids jarring autoplay when someone's volume is up.
 *   - The saxophone toggle in the header controls play/pause on every screen.
 *   - The station name + ▾ opens a picker; tapping a station switches to it
 *     and starts playing (see `setStation`).
 *   - Audio persists across screen navigations (store + Sound live
 *     outside the component tree).
 *
 * HTTPS everywhere:
 *   iOS ATS and Android 9+ block cleartext (http://) by default, so every
 *   station leads with HTTPS. On web, HTML5 <audio> (which expo-av uses
 *   under the hood) doesn't need CORS headers for simple playback — it works
 *   like <img>. So all stations are offered on all platforms. If a stream
 *   genuinely fails to load the store surfaces `loadError` so the picker can
 *   show feedback rather than silent failure.
 *
 * ⚠️  Streams rot. Internet radio URLs go dead without notice. The picker
 *     makes switching painless, and `loadSound` walks a fallback list, but
 *     expect to prune/replace entries here over time.
 *
 * ⚠️  SomaFM note: their TOS says streams are "for individual, personal use
 *     only — not for use in video games, streams, etc."
 *     SomaFM stations are commented out — uncomment if you're comfortable
 *     with the licensing for your use case.
 */

import { create } from 'zustand';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Station catalogue
// ---------------------------------------------------------------------------

export interface Station {
  id: string;
  name: string;
  emoji: string;
  /** URLs to try, ordered best → fallback. All HTTPS. */
  urls: string[];
}

export const STATIONS: Station[] = [
  {
    // RelaxingJazz.com
    id: 'relaxing-jazz-hd',
    name: 'Relaxing Jazz HD',
    emoji: '🎷',
    urls: [
      'https://443-1.autopo.st/171/stream/3/',               // HTTPS proxy, 320 kbps
    ],
  },
  {
    // Jazz Radio (infomaniak.ch) — Classic jazz.
    id: 'jazz-radio-classic',
    name: 'Classic Jazz',
    emoji: '🎹',
    urls: ['https://jazz-wr01.ice.infomaniak.ch/jazz-wr01-128.mp3'],
  },
  {
    // Jazz Radio — Cocktail / Happy Hour channel.
    id: 'jazz-radio-cocktail',
    name: 'Cocktail Jazz',
    emoji: '🍸',
    urls: ['https://jazz-wr14.ice.infomaniak.ch/jazz-wr14-128.mp3'],
  },
  {
    // Radio Paradise "Mellow Mix" — rock-solid, eclectic, perfect background.
    id: 'radio-paradise-mellow',
    name: 'RP Mellow Mix',
    emoji: '🌙',
    urls: ['https://stream.radioparadise.com/mellow-128'],
  },
  {
    // France Musique — La Jazz. Public broadcaster, very reliable.
    id: 'france-musique-jazz',
    name: 'France Musique Jazz',
    emoji: '🇫🇷',
    urls: ['https://icecast.radiofrance.fr/francemusiquelajazz-hifi.aac'],
  },
  {
    // Classic piano and acoustic bass — gives that smoky, high-stakes backroom vibe.
    id: 'radio-swiss-jazz',
    name: 'Classic Lounge',
    emoji: '🃏',
    urls: ['https://stream.srg-ssr.ch/m/rsj/mp3_128'],
  },
  {
    // Jazz Radio — Lounge channel.
    id: 'jazz-radio-lounge',
    name: 'Lounge',
    emoji: '🛋️',
    urls: ['https://jazzlounge.ice.infomaniak.ch/jazzlounge-high.mp3'],
  },

  // ── SomaFM — check TOS before shipping publicly ─────────────────────────
  // {
  //   id: 'groove-salad',
  //   name: 'Groove Salad',
  //   emoji: '🥗',
  //   urls: ['https://ice.somafm.com/groovesalad'],
  // },
  // {
  //   id: 'vaporwaves',
  //   name: 'Vaporwaves',
  //   emoji: '🌊',
  //   urls: ['https://ice.somafm.com/vaporwaves'],
  // },
];

// ---------------------------------------------------------------------------
// Internal state (outside the store to avoid Zustand serialization issues)
// ---------------------------------------------------------------------------

let _sound: Audio.Sound | null = null;
let _initialized = false;
/**
 * Tracks the user's *intent* — true means "I want music on".
 * The playback-status listener reads it to decide whether to
 * auto-recover a dropped live stream (see attachRecovery / recoverStream).
 */
let _wantsToPlay = false;
/** Guard so overlapping status callbacks can't kick off parallel reloads. */
let _recovering = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try each URL in order; return the first Sound that loads, or null.
 *
 * Enforces the HTTPS-on-native invariant in code:
 * iOS ATS and Android 9+ block cleartext, so a stray http:// URL would fail
 * with an opaque native error partway through the fallback walk. We skip those
 * up front on native with a clear log line. (Web is left to the browser, which
 * applies its own mixed-content policy.)
 */
async function loadSound(urls: string[]): Promise<Audio.Sound | null> {
  const isNative = Platform.OS !== 'web';
  for (const uri of urls) {
    if (isNative && !uri.startsWith('https://')) {
      console.warn(`[radio] skipping non-HTTPS stream on ${Platform.OS}: ${uri}`);
      continue;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
      );
      return sound;
    } catch {
      // This URL failed — try the next one.
    }
  }
  return null;
}

/**
 * Attach a playback-status listener that (a) keeps the store's isPlaying honest
 * and (b) auto-recovers a dropped live stream. Live radio never ends normally,
 * so an unloaded+error status while the user still wants sound means the stream
 * rotted mid-play. Re-attach this every time a new Sound is assigned to _sound.
 */
function attachRecovery(
  sound: Audio.Sound,
  set: (partial: Partial<RadioStore>) => void,
  get: () => RadioStore,
) {
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded) {
      // Correct false→true drift (e.g. after a buffering stall) without
      // churning state on every progress tick.
      if (status.isPlaying && !get().isPlaying) set({ isPlaying: true });
      return;
    }
    // Unloaded with an error while the user wanted sound → the stream dropped.
    if (status.error && _wantsToPlay && !_recovering) {
      void recoverStream(set, get);
    }
  });
}

/**
 * One guarded reload+resume of the current station. A single attempt per drop
 * avoids retry storms on a permanently dead URL: on failure we surface an error
 * and clear intent, so we won't loop until the user acts again. On success,
 * normal listening resumes and a *future* drop triggers a fresh single attempt.
 */
async function recoverStream(
  set: (partial: Partial<RadioStore>) => void,
  get: () => RadioStore,
) {
  if (_recovering) return;
  _recovering = true;
  const { stationIndex } = get();
  set({ isLoading: true });
  try {
    try { await _sound?.unloadAsync(); } catch { /* already gone */ }
    _sound = await loadSound(STATIONS[stationIndex].urls);
    if (_sound && _wantsToPlay) {
      attachRecovery(_sound, set, get);
      await _sound.playAsync();
      set({ isPlaying: true, isLoading: false, loadError: null });
    } else {
      _wantsToPlay = false;
      set({ isPlaying: false, isLoading: false, loadError: 'Stream dropped' });
    }
  } catch {
    _wantsToPlay = false;
    set({ isPlaying: false, isLoading: false, loadError: 'Stream dropped' });
  } finally {
    _recovering = false;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface RadioStore {
  isPlaying: boolean;
  isLoading: boolean;
  stationIndex: number;
  /** Non-null when the most recent setStation/toggle load attempt failed. */
  loadError: string | null;
  init: () => Promise<void>;
  toggle: () => Promise<void>;
  /** Switch to a specific station by index and start playing it. */
  setStation: (index: number) => Promise<void>;
}

export const useRadioStore = create<RadioStore>((set, get) => ({
  isPlaying: false,
  isLoading: false,
  stationIndex: 0,
  loadError: null,

  init: async () => {
    if (_initialized) return;
    _initialized = true;
    set({ isLoading: true });

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      _sound = await loadSound(STATIONS[0].urls);
      if (!_sound) {
        set({ isLoading: false });
        return;
      }
      attachRecovery(_sound, set, get);

      // Don't autoplay — wait for the user to click play.
      set({ isPlaying: false, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  toggle: async () => {
    if (!_sound) return;
    const { isPlaying, stationIndex } = get();
    try {
      if (isPlaying) {
        await _sound.pauseAsync();
        _wantsToPlay = false;
        set({ isPlaying: false });
      } else {
        await _sound.playAsync();
        _wantsToPlay = true;
        set({ isPlaying: true, loadError: null });
      }
    } catch {
      // If the stream died, try reloading the current station.
      try {
        set({ isLoading: true });
        await _sound.unloadAsync();
        _sound = await loadSound(STATIONS[stationIndex].urls);
        if (_sound) {
          attachRecovery(_sound, set, get);
          await _sound.playAsync();
          _wantsToPlay = true;
          set({ isPlaying: true, isLoading: false, loadError: null });
        } else {
          set({ isLoading: false, loadError: 'Stream unavailable' });
        }
      } catch {
        set({ isLoading: false });
      }
    }
  },

  setStation: async (index: number) => {
    const { stationIndex } = get();

    // Re-tapping the station that's already loaded: just (re)start it.
    if (index === stationIndex && _sound) {
      try {
        await _sound.playAsync();
        _wantsToPlay = true;
        set({ isPlaying: true, loadError: null });
      } catch {
        // fall through to a full reload below
      }
      if (get().isPlaying) return;
    }

    set({ isLoading: true, stationIndex: index, loadError: null });

    // Tear down whatever's currently loaded.
    try {
      await _sound?.stopAsync();
      await _sound?.unloadAsync();
    } catch {
      /* ignore */
    }
    _sound = null;

    // Load + play the chosen station.
    try {
      _sound = await loadSound(STATIONS[index].urls);
      if (_sound) {
        attachRecovery(_sound, set, get);
        await _sound.playAsync();
        _wantsToPlay = true;
        set({ isPlaying: true, isLoading: false });
      } else {
        set({
          isPlaying: false,
          isLoading: false,
          loadError: `Couldn't connect to ${STATIONS[index].name}`,
        });
      }
    } catch {
      set({
        isLoading: false,
        isPlaying: false,
        loadError: `Couldn't connect to ${STATIONS[index].name}`,
      });
    }
  },
}));