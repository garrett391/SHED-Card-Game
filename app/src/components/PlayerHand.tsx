import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../shared/game-rules/types';
import { PlayingCard } from './PlayingCard';

interface Props {
  cards: Card[];
  mode: 'hand' | 'faceUp' | 'faceDown';
  playableIds?: Set<string>;   // which cards can currently be played
  selectedIds?: Set<string>;   // currently selected card IDs
  onCardPress?: (cardId: string) => void;
  label?: string;
  cardSize?: 'sm' | 'md' | 'lg';
}

export const PlayerHand: React.FC<Props> = ({
  cards,
  mode,
  playableIds = new Set(),
  selectedIds = new Set(),
  onCardPress,
  label,
  cardSize = 'md',
}) => {
  if (cards.length === 0) return null;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cards.map(card => (
          <PlayingCard
            key={card.id}
            card={card}
            faceDown={mode === 'faceDown'}
            selected={selectedIds.has(card.id)}
            playable={mode === 'faceDown' ? true : playableIds.has(card.id)}
            onPress={onCardPress ? () => onCardPress(card.id) : undefined}
            size={cardSize}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    color: '#e8e8e8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
});
