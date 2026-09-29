import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from './theme';

interface Props {
  name: string;
  text: string;
  /** Null renders `emoji` in the frame instead. */
  portrait: ImageSourcePropType | null;
  emoji?: string;
  /** Called when the player taps to advance. Omit / set canAdvance false to disable. */
  onAdvance?: () => void;
  canAdvance?: boolean;
  /** Custom controls rendered in place of the "tap to continue" hint (e.g. final buttons). */
  footer?: React.ReactNode;
}

/**
 * A character speaking from the bottom of the screen: a framed pixel portrait
 * beside a parchment "scroll" of text. Tapping the scroll advances the dialogue
 * when `canAdvance` is set. Used by Chris in the tutorial and by campaign hosts
 * on the results screen.
 */
export function CharacterDialogue({
  name,
  text,
  portrait,
  emoji,
  onAdvance,
  canAdvance,
  footer,
}: Props) {
  const body = (
    <View style={styles.row}>
      <View style={styles.portraitFrame}>
        {portrait ? (
          <Image source={portrait} style={styles.portrait} resizeMode="cover" />
        ) : (
          <Text style={styles.emoji}>{emoji}</Text>
        )}
      </View>

      <View style={styles.scroll}>
        {/* rolled top edge */}
        <View style={[styles.roll, styles.rollTop]} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.text}>{text}</Text>

        {footer ? (
          <View style={styles.footer}>{footer}</View>
        ) : canAdvance ? (
          <Text style={styles.continue}>tap to continue ▸</Text>
        ) : null}
        {/* rolled bottom edge */}
        <View style={[styles.roll, styles.rollBottom]} />
      </View>
    </View>
  );

  if (canAdvance && onAdvance) {
    return (
      <Pressable
        onPress={onAdvance}
        accessibilityRole="button"
        accessibilityLabel={`${name} says: ${text}. Tap to continue.`}
      >
        {body}
      </Pressable>
    );
  }
  return <View accessibilityLabel={`${name} says: ${text}`}>{body}</View>;
}

const PARCHMENT = '#e7d7af';
const PARCHMENT_EDGE = '#d8c290';
const INK = '#3a2c14';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  portraitFrame: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.color.accent,
    backgroundColor: theme.color.feltBgDark,
    overflow: 'hidden',
    marginRight: 10,
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 40,
    lineHeight: 80,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: PARCHMENT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PARCHMENT_EDGE,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  // Thin darker bars to suggest a rolled scroll top/bottom.
  roll: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 4,
    backgroundColor: PARCHMENT_EDGE,
    borderRadius: 4,
  },
  rollTop: { top: 3 },
  rollBottom: { bottom: 3 },
  name: {
    color: '#7a5a1e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  text: {
    color: INK,
    fontSize: 14,
    lineHeight: 20,
  },
  continue: {
    color: '#9a7a3a',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 8,
  },
  footer: {
    marginTop: 10,
  },
});
