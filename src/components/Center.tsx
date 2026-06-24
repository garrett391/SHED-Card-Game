import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { GameState } from '../engine/types';
import { getEffectiveTopCard } from '../engine/rules';
import { PlayingCard } from './PlayingCard';
import { theme } from './theme';
import { rankLabel } from '../engine/cards';

interface Props {
  game: GameState;
  /** Called when the human taps the pile to pick it up. */
  onPickup?: () => void;
  /** True when it's the human player's turn. */
  isHumanTurn?: boolean;
  /** True when the human has no playable move and MUST pick up. */
  mustPickup?: boolean;
}

export function Center({ game, onPickup, isHumanTurn, mustPickup }: Props) {
  const topRaw = game.playPile[0];
  const topEffective = getEffectiveTopCard(game.playPile, game.ruleConfig);
  const transparentRank = game.ruleConfig.transparentRank;
  const eightOverride =
    topRaw && topRaw.rank === transparentRank && topEffective && topEffective.rank !== transparentRank;

  // Pulsing glow animation for the pile when the player must pick up
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mustPickup && game.playPile.length > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [mustPickup, game.playPile.length, pulseAnim]);

  const pileTappable = isHumanTurn && game.playPile.length > 0 && onPickup;

  // Animated border color: pulses from muted to bright gold
  const animatedBorderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(244,196,48,0.25)', 'rgba(244,196,48,1)'],
  });

  // Animated shadow/glow opacity
  const animatedShadowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const renderPileColumn = () => {
    const pileContent = (
      <>
        <View style={styles.stack} pointerEvents={pileTappable ? 'none' : 'auto'}>
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
            {rankLabel(transparentRank)} invisible → counts as {rankLabel(topEffective!.rank)}
          </Text>
        )}
      </>
    );

    if (pileTappable) {
      return (
        <Pressable
          onPress={onPickup}
          style={({ pressed }) => [
            styles.column,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel="Pick up pile"
          accessibilityRole="button"
        >
          <Text style={[styles.label, mustPickup && styles.labelHighlight]}>
            Pile
          </Text>
          {mustPickup && game.playPile.length > 0 ? (
            <Animated.View
              style={[
                styles.pileGlow,
                {
                  borderColor: animatedBorderColor,
                  shadowOpacity: animatedShadowOpacity,
                },
              ]}
            >
              {pileContent}
            </Animated.View>
          ) : (
            <View style={styles.pileTappable}>
              {pileContent}
            </View>
          )}
          <Text style={[styles.pickupHint, mustPickup && styles.pickupHintForced]}>
            {mustPickup ? 'Tap to pick up' : 'Tap to pick up'}
          </Text>
        </Pressable>
      );
    }

    return (
      <View style={styles.column}>
        <Text style={styles.label}>Pile</Text>
        {pileContent}
      </View>
    );
  };

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

      {renderPileColumn()}

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
  labelHighlight: { color: theme.color.accent, fontWeight: '700' },
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
  // Pulsing glow wrapper when the player MUST pick up
  pileGlow: {
    borderWidth: 3,
    borderRadius: theme.radius.md + 4,
    padding: 4,
    alignItems: 'center',
    // Shadow for the glow effect (iOS)
    shadowColor: theme.color.accent,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  // Subtle tappable state when pickup is optional
  pileTappable: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.md + 4,
    borderStyle: 'dashed',
    padding: 4,
    alignItems: 'center',
  },
  // "Tap to pick up" hint text
  pickupHint: {
    color: theme.color.textMuted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  pickupHintForced: {
    color: theme.color.accent,
    fontWeight: '700',
    fontSize: 11,
  },
});
