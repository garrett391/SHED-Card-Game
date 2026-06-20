import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GameState } from '../engine/types';
import { getEffectiveTopCard } from '../engine/rules';
import { PlayingCard } from './PlayingCard';
import { theme } from './theme';
import { rankLabel } from '../engine/cards';

interface Props {
  game: GameState;
}

export function Center({ game }: Props) {
  const topRaw = game.playPile[0];
  const topEffective = getEffectiveTopCard(game.playPile);
  const eightOverride =
    topRaw && topRaw.rank === 8 && topEffective && topEffective.rank !== 8;

  return (
    <View style={styles.row}>
      <View style={styles.column}>
        <Text style={styles.label}>Draw</Text>
        <View style={styles.stack}>
          {game.drawPile.length > 0 ? (
            <PlayingCard faceDown />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>—</Text>
            </View>
          )}
        </View>
        <Text style={styles.count}>{game.drawPile.length} left</Text>
      </View>

      <View style={styles.column}>
        <Text style={styles.label}>Pile</Text>
        <View style={styles.stack}>
          {topRaw ? (
            <PlayingCard card={topRaw} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>empty</Text>
            </View>
          )}
        </View>
        <Text style={styles.count}>{game.playPile.length} cards</Text>
        {eightOverride && (
          <Text style={styles.eight}>
            8 invisible → counts as {rankLabel(topEffective!.rank)}
          </Text>
        )}
      </View>

      <View style={styles.column}>
        <Text style={styles.label}>Burned</Text>
        <View style={styles.stack}>
          <View style={styles.burned}>
            <Text style={styles.burnedText}>🔥</Text>
          </View>
        </View>
        <Text style={styles.count}>{game.burnedPile.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  column: { alignItems: 'center', marginHorizontal: 12 },
  label: { color: theme.color.textMuted, fontSize: 12, marginBottom: 4 },
  stack: { height: theme.card.height, justifyContent: 'center' },
  count: { color: theme.color.textOnDark, fontSize: 11, marginTop: 4 },
  placeholder: {
    width: theme.card.width,
    height: theme.card.height,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  placeholderText: { color: theme.color.textMuted },
  burned: {
    width: theme.card.width,
    height: theme.card.height,
    borderRadius: theme.radius.md,
    backgroundColor: '#3a1a10',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  burnedText: { fontSize: 28 },
  eight: {
    color: theme.color.accent,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});
