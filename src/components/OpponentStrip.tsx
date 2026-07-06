import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { Player } from '../engine/types';
import { characterByName } from '../campaign/characters';
import { PlayingCard } from './PlayingCard';
import { theme } from './theme';

interface Props {
  player: Player;
  isCurrent: boolean;
  /** Ephemeral table-talk line. New `nonce` restarts the animation. */
  bubble?: { text: string; nonce: number } | null;
}

/** A horizontal strip showing a player: name, hand count, face-up cards, face-down count. */
export function OpponentStrip({ player, isCurrent, bubble }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Speech bubble: fade/slide in, hold, fade out. Runs per nonce so the same
  // character can speak twice in a row and still animate.
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!bubble) {
      bubbleAnim.setValue(0);
      return;
    }
    bubbleAnim.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(bubbleAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(bubbleAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]);
    seq.start();
    return () => seq.stop();
  }, [bubble?.nonce, bubbleAnim]);
  // Campaign characters get an avatar (PNG portrait once art exists, emoji
  // until then). Generic bots keep the plain 🤖 name suffix.
  const character = player.isBot ? characterByName(player.name) : null;

  useEffect(() => {
    if (isCurrent) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isCurrent, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.row,
        isCurrent && styles.current,
        isCurrent && { borderColor: pulseAnim.interpolate({
          inputRange: [0.4, 1],
          outputRange: ['rgba(244,196,48,0.35)', 'rgba(244,196,48,1)'],
        }) },
      ]}
    >
      {/* Turn indicator */}
      <View style={[styles.chip, isCurrent && styles.chipActive]}>
        <Text style={styles.chipText}>{isCurrent ? '🔴' : '⚪'}</Text>
      </View>
      {bubble && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              opacity: bubbleAnim,
              transform: [
                {
                  translateY: bubbleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.bubbleText} numberOfLines={2}>
            {bubble.text}
          </Text>
          <View style={styles.bubbleTail} />
        </Animated.View>
      )}
      {character && (
        <View style={styles.avatar}>
          {character.portrait ? (
            <Image source={character.portrait} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarEmoji}>{character.emoji}</Text>
          )}
        </View>
      )}
      <View style={styles.nameCol}>
        <Text
          style={[styles.name, isCurrent && styles.currentName]}
          numberOfLines={1}
        >
          {player.name}
          {player.isBot && !character ? ' 🤖' : ''}
        </Text>
        <Text style={styles.meta}>
          {player.hand.length} in hand · {player.faceDown.length} down
        </Text>
        {player.isFinished && <Text style={styles.finished}>OUT ✓</Text>}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    top: -30,
    left: 42,
    maxWidth: 240,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontStyle: 'italic',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    left: 10,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fafafa',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    overflow: 'hidden',
  },
  avatarImg: { width: 30, height: 30 },
  avatarEmoji: { fontSize: 17 },
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
    backgroundColor: '#12352a',
  },
  chip: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipActive: {},
  chipText: { fontSize: 12 },
  nameCol: { flex: 1 },
  name: { color: theme.color.textOnDark, fontWeight: '700', fontSize: 15 },
  currentName: { color: theme.color.accent },
  meta: { color: theme.color.textMuted, fontSize: 11, marginTop: 2 },
  finished: { color: theme.color.accent, fontSize: 11, fontWeight: '700' },
  cardsRow: { flexDirection: 'row' },
});
