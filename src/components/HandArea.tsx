import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPlaySource } from '../engine/engine';
import { Card, Player } from '../engine/types';
import { PlayingCard } from './PlayingCard';
import { theme } from './theme';

const byRank = (cards: readonly Card[]) => [...cards].sort((a, b) => a.rank - b.rank);

/**
 * The bottom of the table on a human's turn: whichever cards they play
 * from now. Hand and face-up cards are tapped to select (unplayable ones
 * dimmed); face-down cards are flipped blind with one tap.
 */
export function HandArea({
  player,
  playableIds,
  selectedIds,
  onToggle,
  onFlip,
}: {
  player: Player;
  playableIds: readonly string[];
  selectedIds: readonly string[];
  onToggle: (cardId: string) => void;
  onFlip: (cardId: string) => void;
}) {
  const source = getPlaySource(player);
  // Lowest to highest, so the hand reads in order.
  const sortedHand = useMemo(() => byRank(player.hand), [player.hand]);

  if (source === 'hand' || source === 'faceUp') {
    const cards = source === 'hand' ? sortedHand : player.faceUp;
    return (
      <>
        <Text style={styles.sectionLabel}>
          {source === 'hand' ? `${player.name}'s hand` : 'Mid-game (face-up)'}
        </Text>
        <View style={styles.cardRow}>
          {cards.map((c) => (
            <PlayingCard
              key={c.id}
              card={c}
              selected={selectedIds.includes(c.id)}
              dimmed={!playableIds.includes(c.id)}
              onPress={() => onToggle(c.id)}
            />
          ))}
        </View>
      </>
    );
  }
  if (source === 'faceDown') {
    return (
      <>
        <Text style={styles.sectionLabel}>Late game — blind flip. Pick one.</Text>
        <View style={styles.cardRow}>
          {player.faceDown.map((c) => (
            <PlayingCard key={c.id} faceDown onPress={() => onFlip(c.id)} />
          ))}
        </View>
      </>
    );
  }
  return <Text style={styles.dim}>No cards left</Text>;
}

/**
 * While someone else plays, the lone human keeps their cards in view,
 * dimmed and untappable, so they can plan ahead.
 */
export function WatchingHand({ player, currentName }: { player: Player; currentName: string }) {
  const src = getPlaySource(player);
  if (src === null) {
    return <Text style={styles.dim}>You're out. Watching {currentName}…</Text>;
  }
  const cards =
    src === 'hand' ? byRank(player.hand)
    : src === 'faceUp' ? player.faceUp
    : player.faceDown;
  const label =
    src === 'hand' ? `${player.name}'s hand`
    : src === 'faceUp' ? 'Mid-game (face-up)'
    : 'Late game (face-down)';
  return (
    <>
      <Text style={styles.sectionLabel}>
        {label} <Text style={styles.watchingNote}>· {currentName}'s turn</Text>
      </Text>
      <View style={styles.cardRow}>
        {cards.map((c) => (
          <PlayingCard key={c.id} card={c} faceDown={src === 'faceDown'} dimmed disabled />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: theme.color.textOnDark,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  watchingNote: {
    color: theme.color.textMuted,
    fontWeight: '400',
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 16, // room for selected lift
  },
  dim: { color: theme.color.textMuted, fontStyle: 'italic' },
});
