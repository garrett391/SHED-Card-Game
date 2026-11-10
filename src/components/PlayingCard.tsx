import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import { isRedSuit, rankLabel } from '../engine/cards';
import { theme } from './theme';
import { RotateCcw, Shuffle } from 'lucide-react-native';

/** Shorter than the system default, so holding a card feels deliberate
 *  without feeling slow. */
const LONG_PRESS_MS = 300;

interface Props {
  card?: Card;            // omit when faceDown=true with no known card
  faceDown?: boolean;
  selected?: boolean;
  small?: boolean;
  dimmed?: boolean;       // unplayable visual cue
  onPress?: () => void;
  /** Press and hold (the hand uses it to select a whole set). */
  onLongPress?: () => void;
  disabled?: boolean;
}

export function PlayingCard({
  card,
  faceDown,
  selected,
  small,
  dimmed,
  onPress,
  onLongPress,
  disabled,
}: Props) {
  const size = small ? styles.small : styles.normal;
  const baseStyle = [
    styles.card,
    size,
    selected && styles.selected,
    dimmed && styles.dimmed,
  ];

  if (faceDown || !card) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={LONG_PRESS_MS}
        disabled={disabled}
        style={[...baseStyle, styles.back]}
      >
        <View style={styles.backPattern} />
      </Pressable>
    );
  }

  const red = isRedSuit(card.suit);
  if (card.joker) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={LONG_PRESS_MS}
        disabled={disabled}
        style={baseStyle}
        accessibilityLabel={card.joker === 'reverse' ? 'Reverse joker' : 'Swap joker'}
      >
        <Text style={[styles.jokerWord, red && styles.red, small && styles.jokerWordSmall]}>
          JOKER
        </Text>
        <View style={styles.jokerIcon}>
          {card.joker === 'reverse' ? (
            <RotateCcw size={small ? 14 : 22} color={red ? theme.color.red : theme.color.text} strokeWidth={2.5} />
          ) : (
            <Shuffle size={small ? 14 : 22} color={red ? theme.color.red : theme.color.text} strokeWidth={2.5} />
          )}
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      disabled={disabled}
      style={baseStyle}
    >
      <Text
        style={[styles.rank, red && styles.red, small && styles.smallText]}
      >
        {rankLabel(card.rank)}
      </Text>
      <Text
        style={[styles.suit, red && styles.red, small && styles.smallSuit]}
      >
        {card.suit}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.cardBg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    // On the web a long press would otherwise start selecting the card's text.
    userSelect: 'none',
  },
  normal: { width: theme.card.width, height: theme.card.height },
  small: { width: theme.card.widthSmall, height: theme.card.heightSmall },
  selected: {
    transform: [{ translateY: -14 }],
    borderColor: theme.color.accent,
    borderWidth: 3,
  },
  dimmed: { opacity: 0.45 },
  rank: { fontSize: 22, fontWeight: '700', color: theme.color.text },
  suit: { fontSize: 18, color: theme.color.text, marginTop: -2 },
  smallText: { fontSize: 16 },
  smallSuit: { fontSize: 14 },
  red: { color: theme.color.red },
  jokerWord: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: theme.color.text },
  jokerWordSmall: { fontSize: 7, letterSpacing: 0.5 },
  jokerIcon: { marginTop: 4 },
  back: { backgroundColor: theme.color.cardBack, borderColor: '#000' },
  backPattern: {
    width: '70%',
    height: '70%',
    backgroundColor: theme.color.cardBackPattern,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#000',
  },
});
