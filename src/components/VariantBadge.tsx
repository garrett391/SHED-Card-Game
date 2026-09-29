import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { RuleConfig } from '../engine/types';

// react-native-web draws a focus ring on Pressables after a click/tap, which
// reads as a stray light-gray border on this badge. Suppress it on web only;
// the control keeps its accessibility role and label. Typed loosely because
// `outlineStyle` is a web-only style key not present in RN's ViewStyle.
const webNoOutline: any =
  Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

/**
 * Small gold badge naming the active ruleset. Rendered on the swap and game
 * screens for every ruleset, Jake's Classic included.
 *
 * Tap the badge to toggle a popover with the variant's description. An ⓘ glyph
 * signals the affordance. The popover is absolutely positioned so it overlays
 * content rather than pushing the layout around. Tap-only by design — no hover,
 * since a tooltip that follows the cursor on desktop reads as distracting.
 */
export function VariantBadge({ config }: { config: RuleConfig }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${config.name} ruleset. ${config.description}`}
        style={[styles.badge, webNoOutline]}
        hitSlop={6}
      >
        <Text style={styles.text}>{config.name}</Text>
        <Text style={styles.info}>ⓘ</Text>
      </Pressable>

      {open && (
        <View style={styles.tooltipLayer} pointerEvents="none">
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{config.description}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 6,
    // Anchor for the absolutely-positioned popover; keep it above siblings.
    position: 'relative',
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    color: '#d4a843',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  info: {
    color: '#d4a843',
    fontSize: 11,
    opacity: 0.7,
  },
  // Full-width layer below the badge so the bubble centers under it
  // regardless of how wide the badge text is.
  tooltipLayer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    alignItems: 'center',
    zIndex: 20,
  },
  tooltip: {
    maxWidth: 340,
    // Lighter than the felt so the card reads as raised without a drop shadow.
    // (A shadow here promotes a compositor layer on web that can leave a faint
    // residual band after the popover unmounts — the border does the job.)
    backgroundColor: '#1c4233',
    borderColor: 'rgba(212,168,67,0.5)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tooltipText: {
    color: '#f5f5f5',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});