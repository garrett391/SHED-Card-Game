/**
 * Radio store — streams RelaxingJazz.com smooth jazz.
 *
 * Behavior:
 *   - On native (iOS / Android): autoplay works immediately.
 *   - On web: browsers block autoplay before any user gesture.
 *     We attempt autoplay on init, and if it fails, we register
 *     a one-time click/keydown listener so the very first tap
 *     anywhere on the page (e.g. "New game") starts the stream.
 *   - The saxophone toggle on the home header controls play/pause.
 *   - Audio persists across screen navigations (store + Sound live
 *     outside the component tree).
 */

import { create } from 'zustand';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Use HTTPS on web to avoid mixed-content blocking.
// Native gets the lighter 128 kbps stream; web gets 320 over HTTPS.
const STREAM_URL =
  Platform.OS === 'web'
    ? 'https://443-1.autopo.st/171/stream/3/'
    : 'http://stream-02-eu.relaxingjazz.com/stream/1/';

interface RadioStore {
  /** True while the stream is audibly playing. */
  isPlaying: boolean;
  /** True during initial load (before first play attempt resolves). */
  isLoading: boolean;
  /** Initialize audio and attempt autoplay. Call once from _layout. */
  init: () => Promise<void>;
  /** Toggle play / pause. */
  toggle: () => Promise<void>;
}

// Internal state kept outside the store to avoid serialization concerns.
let _sound: Audio.Sound | null = null;
let _initialized = false;
/** Tracks the user's *intent* — true means "I want music on". */
let _wantsToPlay = true;

export const useRadioStore = create<RadioStore>((set, get) => ({
  isPlaying: false,
  isLoading: false,

  init: async () => {
    if (_initialized) return;
    _initialized = true;
    set({ isLoading: true });

    try {
      // Allow playback in silent mode (iOS) and in the background.
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: STREAM_URL },
        { shouldPlay: false },
      );
      _sound = sound;

      // Attempt autoplay.
      try {
        await sound.playAsync();
        set({ isPlaying: true, isLoading: false });
      } catch {
        // Autoplay blocked (expected on web before user gesture).
        set({ isPlaying: false, isLoading: false });

        if (Platform.OS === 'web') {
          const resume = async () => {
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
            if (_sound && _wantsToPlay) {
              try {
                await _sound.playAsync();
                set({ isPlaying: true });
              } catch {
                // Stream may have timed out; silent fail is fine.
              }
            }
          };
          document.addEventListener('click', resume);
          document.addEventListener('keydown', resume);
        }
      }
    } catch {
      // Network error / expo-av not available — degrade silently.
      set({ isLoading: false });
    }
  },

  toggle: async () => {
    if (!_sound) return;
    const { isPlaying } = get();
    try {
      if (isPlaying) {
        await _sound.pauseAsync();
        _wantsToPlay = false;
        set({ isPlaying: false });
      } else {
        await _sound.playAsync();
        _wantsToPlay = true;
        set({ isPlaying: true });
      }
    } catch {
      // If the stream died, try reloading it.
      try {
        await _sound.unloadAsync();
        await _sound.loadAsync({ uri: STREAM_URL });
        await _sound.playAsync();
        _wantsToPlay = true;
        set({ isPlaying: true });
      } catch {
        // Give up silently — it's background music, not critical.
      }
    }
  },
}));
