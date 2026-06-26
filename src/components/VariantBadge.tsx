import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RuleConfig } from '../engine/types';

/**
 * Small gold badge naming the active ruleset. Rendered on the swap and game
 * screens. Hidden for Jake's Classic (the default) so the badge only appears
 * when a variant is actually in play.
 */
export function VariantBadge({ config }: { config: RuleConfig }) {
  if (config.id === 'jake-classic') return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{config.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  text: {
    color: '#d4a843',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
