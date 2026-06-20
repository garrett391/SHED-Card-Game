import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../../../shared/game-rules/types';

interface Props {
  card: Card;
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

export const PlayingCard: React.FC<Props> = ({
  card,
  faceDown = false,
  selected = false,
  playable = true,
  onPress,
  size = 'md',
}) => {
  const isRed = RED_SUITS.has(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];
  const dim = SIZES[size];

  if (faceDown) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        style={[styles.card, dim, styles.faceDown, selected && styles.selected]}
        activeOpacity={0.7}
      >
        <View style={styles.backPattern}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Text key={i} style={styles.backSymbol}>♦</Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress || !playable}
      activeOpacity={0.7}
      style={[
        styles.card,
        dim,
        selected && styles.selected,
        !playable && styles.disabled,
      ]}
    >
      {/* Top-left rank + suit */}
      <View style={styles.corner}>
        <Text style={[styles.rankText, isRed && styles.red]}>{card.rank}</Text>
        <Text style={[styles.suitSmall, isRed && styles.red]}>{symbol}</Text>
      </View>

      {/* Centre suit */}
      <Text style={[styles.suitCenter, isRed && styles.red]}>{symbol}</Text>

      {/* Bottom-right (rotated) */}
      <View style={[styles.corner, styles.bottomRight]}>
        <Text style={[styles.rankText, styles.flipped, isRed && styles.red]}>{card.rank}</Text>
        <Text style={[styles.suitSmall, styles.flipped, isRed && styles.red]}>{symbol}</Text>
      </View>
    </TouchableOpacity>
  );
};

const SIZES = {
  sm: { width: 50, height: 72 },
  md: { width: 65, height: 92 },
  lg: { width: 80, height: 112 },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ccc',
    justifyContent: 'space-between',
    padding: 4,
    margin: 3,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  faceDown: {
    backgroundColor: '#1a3a6b',
    borderColor: '#0d2044',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selected: {
    borderColor: '#f5c518',
    borderWidth: 3,
    transform: [{ translateY: -8 }],
  },
  disabled: {
    opacity: 0.35,
  },
  corner: {
    alignItems: 'center',
  },
  bottomRight: {
    alignSelf: 'flex-end',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    lineHeight: 16,
  },
  suitSmall: {
    fontSize: 11,
    color: '#111',
    lineHeight: 13,
  },
  suitCenter: {
    fontSize: 28,
    textAlign: 'center',
    color: '#111',
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
  },
  red: {
    color: '#cc2200',
  },
  flipped: {
    transform: [{ rotate: '180deg' }],
  },
  backPattern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    padding: 4,
  },
  backSymbol: {
    color: '#2a5cb8',
    fontSize: 12,
  },
});
