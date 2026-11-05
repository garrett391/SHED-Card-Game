import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export interface Caption {
  emoji: string;
  text: string;
  /** Restarts the fade for back-to-back plays with identical text. */
  nonce: number;
}

/**
 * The "who just played what" line above the pile. Text only, never a card,
 * so it can't be mistaken for a second pile. The zone keeps its height when
 * empty so the table doesn't jump as captions come and go.
 *
 * Each caption fades in, holds and fades out, keyed on its nonce (mirrors
 * the table-talk bubble timing). `highlighted` while a bot's play or the
 * winning play is on show.
 */
export function ActionCaption({
  caption,
  highlighted,
}: {
  caption: Caption | null;
  highlighted: boolean;
}) {
  return (
    <View style={styles.zone}>
      {caption && <FadingCaption caption={caption} highlighted={highlighted} />}
    </View>
  );
}

function FadingCaption({ caption, highlighted }: { caption: Caption; highlighted: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    seq.start();
    return () => seq.stop();
  }, [caption.nonce, anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.caption,
        highlighted && styles.captionActive,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.captionText} numberOfLines={2}>
        {caption.emoji} {caption.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zone: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  caption: {
    maxWidth: '92%',
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  captionActive: {
    borderColor: theme.color.accent,
  },
  captionText: {
    color: theme.color.textOnDark,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
