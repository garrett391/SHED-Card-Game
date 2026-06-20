import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Player } from '../engine/types';
import { PlayingCard } from './PlayingCard';
import { theme } from './theme';

interface Props {
  player: Player;
  isCurrent: boolean;
}

/** A horizontal strip showing an opponent: name, hand count, face-up cards, face-down count. */
export function OpponentStrip({ player, isCurrent }: Props) {
  return (
    <View style={[styles.row, isCurrent && styles.current]}>
      <View style={styles.nameCol}>
        <Text
          style={[styles.name, isCurrent && styles.currentName]}
          numberOfLines={1}
        >
          {player.name}
          {player.isBot ? ' 🤖' : ''}
        </Text>
        <Text style={styles.meta}>
          {player.hand.length} in hand · {player.faceDown.length} down
        </Text>
        {player.isFinished && <Text style={styles.finished}>OUT</Text>}
      </View>
      <View style={styles.cardsRow}>
        {player.faceUp.map((c) => (
          <PlayingCard key={c.id} card={c} small />
        ))}
        {player.faceUp.length === 0 && player.faceDown.length > 0 && (
          // mid-game: only face-down remains
          player.faceDown.map((c) => (
            <PlayingCard key={c.id} faceDown small />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.feltBgDark,
    marginVertical: 3,
  },
  current: {
    borderWidth: 2,
    borderColor: theme.color.accent,
  },
  nameCol: { flex: 1 },
  name: { color: theme.color.textOnDark, fontWeight: '700', fontSize: 15 },
  currentName: { color: theme.color.accent },
  meta: { color: theme.color.textMuted, fontSize: 11, marginTop: 2 },
  finished: { color: theme.color.accent, fontSize: 11, fontWeight: '700' },
  cardsRow: { flexDirection: 'row' },
});
