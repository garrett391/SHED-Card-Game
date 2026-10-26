/**
 * "Achievement unlocked" banner. Pass the list of ids unlocked so far this
 * game; each new entry slides in from the top, holds, and fades. Several at
 * once (a burn that's also a win) queue up one after another.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ACHIEVEMENT_BY_ID, AchievementId } from '../achievements/achievements';
import { playSfx } from '../audio/sfx';

const HOLD_MS = 2600;

export function AchievementToast({ earned }: { earned: AchievementId[] }) {
  const shown = useRef(earned.length); // ignore ones earned before mount
  const [current, setCurrent] = useState<AchievementId | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (earned.length < shown.current) shown.current = 0; // new game
    if (current || shown.current >= earned.length) return;
    const id = earned[shown.current];
    shown.current += 1;
    setCurrent(id);
    playSfx('shuffle');
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.delay(HOLD_MS),
      Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setCurrent(null));
  }, [earned, current, anim]);

  if (!current) return null;
  const a = ACHIEVEMENT_BY_ID[current];
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
    >
      <Text style={styles.emoji}>{a.emoji}</Text>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.kicker}>ACHIEVEMENT UNLOCKED</Text>
        <Text style={styles.name}>{a.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>{a.description}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f4c430',
    backgroundColor: '#1d1a0c',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 10,
  },
  emoji: { fontSize: 30 },
  kicker: { color: '#f4c430', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  name: { color: '#fafafa', fontSize: 16, fontWeight: '800' },
  desc: { color: '#c8c2a8', fontSize: 12 },
});
