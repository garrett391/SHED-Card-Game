/**
 * Cinematic player — full-screen captioned scenes, tap to advance.
 *
 * Route: /cinematic?preset=<id>. Plays CINEMATICS[preset], marks it seen in
 * campaignStore on finish or skip, then replaces to /setup with the same
 * preset so the game flow continues seamlessly.
 *
 * Replays (the map's "↺ Story" chip) run the same flow: after the story,
 * you land on that node's setup, primed to play — backing out is one tap.
 *
 * Scenes fade in on entry (image + caption together). expo-image renders
 * PNGs and animated GIF/WebP alike, so "simple GIF" scenes need no special
 * handling. Scenes without art render as caption-only title cards.
 */
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { playSfx } from '../src/audio/sfx';
import { CINEMATICS } from '../src/campaign/story';
import { useCampaignStore } from '../src/store/campaignStore';

export default function CinematicScreen() {
  const router = useRouter();
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const scenes = preset ? CINEMATICS[preset] : undefined;

  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  // True while fading OUT (between tap and scene swap) — ignores re-entrant
  // taps so double-taps can't skip scenes mid-transition. Taps during the
  // fade-IN are allowed; the out-animation just starts from current opacity.
  const swapping = useRef(false);

  useEffect(() => {
    swapping.current = false;
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [index, fade]);

  if (!preset || !scenes || scenes.length === 0) {
    // Nothing to play (bad param or no cinematic) — continue the flow.
    return <Redirect href={preset ? { pathname: '/setup', params: { preset } } : '/campaign'} />;
  }

  const finish = () => {
    useCampaignStore.getState().markCinematicSeen(preset); // idempotent
    router.replace({ pathname: '/setup', params: { preset } });
  };

  // Fade the current scene out, THEN act — scene swaps happen at opacity 0,
  // so the eye never sees content pop.
  const fadeOutThen = (action: () => void) => {
    if (swapping.current) return;
    swapping.current = true;
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) action();
        else swapping.current = false;
      },
    );
  };

  const advance = () => {
    if (index >= scenes.length - 1) {
      fadeOutThen(finish);
      return;
    }
    playSfx('pageTurn');
    fadeOutThen(() => setIndex((i) => i + 1));
  };

  // Stories-style back: tapping the left edge (or the ‹ chip) steps to the
  // previous scene through the same fade, so a too-fast tap is one tap to
  // undo. No-op on the first scene.
  const goBack = () => {
    if (index === 0) return;
    playSfx('pageTurn');
    fadeOutThen(() => setIndex((i) => Math.max(0, i - 1)));
  };

  const scene = scenes[index];

  return (
    <Pressable style={styles.container} onPress={advance}>
      <Animated.View style={[styles.sceneWrap, { opacity: fade }]}>
        {scene.image ? (
          <View style={styles.frame}>
            <Image
              source={scene.image}
              style={styles.image}
              contentFit="contain"
              transition={0}
            />
          </View>
        ) : (
          <View style={styles.titleCard} />
        )}
        <Text style={styles.caption}>{scene.caption}</Text>
      </Animated.View>

      {/* Invisible pre-decode of all scenes' images (prevents first-show
          flash: by the time a scene fades in, its bitmap is already decoded). */}
      <View style={styles.preload} pointerEvents="none">
        {scenes.map((sc, i) =>
          sc.image ? <Image key={i} source={sc.image} style={styles.preloadImg} /> : null,
        )}
      </View>

      {/* Left-edge back zone (stories convention): taps in the left quarter
          step back instead of advancing. Sits above the container Pressable,
          below the corner chips. Disabled on the first scene so the whole
          screen advances until there's somewhere to go back to. */}
      {index > 0 && (
        <Pressable
          onPress={goBack}
          style={styles.backZone}
          accessibilityLabel="Previous scene"
          accessibilityRole="button"
        />
      )}

      {/* Progress dots */}
      <View style={styles.dots} pointerEvents="none">
        {scenes.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* ‹ Back mirrors Skip ▸ — only appears once there's a scene behind us,
          making the left-edge tap zone discoverable without cluttering the
          opening frame. */}
      {index > 0 && (
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <Text style={styles.skipText}>‹ Back</Text>
        </Pressable>
      )}

      <Pressable onPress={finish} hitSlop={12} style={styles.skip}>
        <Text style={styles.skipText}>Skip ▸</Text>
      </Pressable>

      <Text style={styles.hint}>tap to continue</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f0d',
    justifyContent: 'center',
  },
  sceneWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 96,
  },
  frame: {
    // Every scene's art lives in this SAME box; differing aspect ratios
    // letterbox inside it instead of resizing the scene. The faint backdrop
    // and border make the letterboxing read as a deliberate frame.
    width: '100%',
    flex: 1,
    maxHeight: '72%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232,227,213,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    padding: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  preload: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  preloadImg: {
    width: 1,
    height: 1,
  },
  titleCard: {
    height: 1, // caption-only scenes: caption centers on the dark felt
  },
  caption: {
    color: '#e8e3d5',
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 22,
    maxWidth: 420,
    // Reserve three lines regardless of caption length: scene-to-scene
    // caption height changes were reflowing (jumping) the image above.
    minHeight: 26 * 3,
  },
  dots: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(232,227,213,0.25)',
  },
  dotActive: {
    backgroundColor: '#f4c430',
  },
  backZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '25%',
  },
  back: {
    position: 'absolute',
    top: 54,
    left: 20,
  },
  skip: {
    position: 'absolute',
    top: 54,
    right: 20,
  },
  skipText: {
    color: 'rgba(232,227,213,0.6)',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  hint: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    color: 'rgba(232,227,213,0.35)',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
