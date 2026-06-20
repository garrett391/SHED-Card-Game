import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../shared/game-rules/types';
import { getEffectiveTopCard } from '../../../shared/game-rules/engine';
import { PlayingCard } from './PlayingCard';

interface Props {
  playPile: Card[];
  drawPileCount: number;
}

export const GamePile: React.FC<Props> = ({ playPile, drawPileCount }) => {
  const topCard = playPile[playPile.length - 1] ?? null;
  const effectiveTop = getEffectiveTopCard(playPile);
  const showEightNote = topCard?.rank === '8' && effectiveTop !== null;

  return (
    <View style={styles.container}>
      {/* Draw pile */}
      <View style={styles.pileSection}>
        <Text style={styles.pileLabel}>Draw</Text>
        <View style={[styles.drawPile, drawPileCount === 0 && styles.emptyPile]}>
          <Text style={styles.drawCount}>{drawPileCount}</Text>
        </View>
      </View>

      {/* Play pile */}
      <View style={styles.pileSection}>
        <Text style={styles.pileLabel}>
          Pile ({playPile.length})
        </Text>
        {topCard ? (
          <View style={styles.topCardWrapper}>
            <PlayingCard card={topCard} size="lg" />
            {showEightNote && (
              <Text style={styles.eightNote}>
                Effective: {effectiveTop?.rank}
              </Text>
            )}
          </View>
        ) : (
          <View style={[styles.drawPile, styles.emptyPile]}>
            <Text style={styles.drawCount}>—</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingVertical: 12,
  },
  pileSection: {
    alignItems: 'center',
    gap: 6,
  },
  pileLabel: {
    color: '#c8e6c9',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  drawPile: {
    width: 80,
    height: 112,
    borderRadius: 8,
    backgroundColor: '#1a3a6b',
    borderWidth: 2,
    borderColor: '#2a5cb8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPile: {
    backgroundColor: '#1e3a1e',
    borderColor: '#2d5a2d',
    borderStyle: 'dashed',
  },
  drawCount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  topCardWrapper: {
    alignItems: 'center',
  },
  eightNote: {
    color: '#ffe082',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
