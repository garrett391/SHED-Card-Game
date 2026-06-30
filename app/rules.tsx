import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../src/components/theme';
import { Button } from '../src/components/Button';
import { RULE_PRESETS, PRESET_ORDER, getPreset } from '../src/campaign/presets';
import { variantDiff } from '../src/campaign/ruleSummary';

/**
 * Static reference card for SHED rules. The base rulebook below is Jake's
 * Classic; a variant picker at the top shows an auto-generated "what's
 * different" summary for any other ruleset (derived from its RuleConfig, so it
 * can't drift from the engine). Kept as plain Text components rather than
 * markdown so we don't add a dependency for v1.
 */
export default function RulesScreen() {
  const router = useRouter();
  const [variantId, setVariantId] = useState('jake-classic');
  const [pickerOpen, setPickerOpen] = useState(false);

  const preset = getPreset(variantId);
  const diff = variantDiff(preset);
  const isClassic = variantId === 'jake-classic';

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>SHED</Text>
        <Text style={styles.subtitle}>Original rules as spake by Jake the Elder</Text>

        {/* New here? → interactive tutorial */}
        <Button
          title="New here? Take the tutorial"
          variant="ghost"
          onPress={() => router.push('/tutorial')}
          style={styles.cta}
        />

        {/* Ruleset selector */}
        <Pressable
          style={styles.selector}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Ruleset: ${preset.name}. Tap to change.`}
        >
          <Text style={styles.selectorLabel}>Ruleset</Text>
          <View style={styles.selectorValueWrap}>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {preset.name}
            </Text>
            <Text style={styles.caret}>▾</Text>
          </View>
        </Pressable>

        {/* Variant summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryFlavor}>{preset.flavorText}</Text>
          {isClassic ? (
            <Text style={styles.summaryNote}>
              This is the original ruleset — every rule below applies as written.
            </Text>
          ) : (
            <>
              <Text style={styles.summaryHeading}>What's different</Text>
              {diff.map((line, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
              <Text style={styles.summaryNote}>
                Everything else follows the base rules below.
              </Text>
            </>
          )}
        </View>

        <View style={styles.divider}>
          <Text style={styles.dividerText}>THE FULL RULEBOOK · JAKE'S CLASSIC</Text>
        </View>

        <Section title="Setup">
          <P>
            • Standard 52-card deck, no jokers.{'\n'}
            • Deal one card at a time, clockwise.{'\n'}
            • Each player gets 3 face-down (late game), then 3 face-up on top
            (mid-game), then 3 in hand (early game). Nine total.{'\n'}
            • Before play, you may swap any of your hand cards with your face-up
            cards. Optional but tactical.
          </P>
        </Section>

        <Section title="Goal">
          <P>
            Get rid of all 9 of your cards. First player to clear hand + face-up +
            face-down wins. Any remaining players are SHITHEADS.
          </P>
        </Section>

        <Section title="Who starts">
          <P>
            Whoever has the lowest non-power card plays it first. (Power cards:
            2, 7, 8, 10.) If multiple players tie, the one earliest clockwise of
            the dealer goes first.
          </P>
        </Section>

        <Section title="Turn rules">
          <P>
            • You must "meet or beat" the top card of the pile.{'\n'}
            • You may play multiple cards of the same rank at once.{'\n'}
            • If you can't play, pick up the entire pile and the turn ends.{'\n'}
            • You may always voluntarily pick up the pile — your turn still ends.{'\n'}
            • Maintain at least 3 cards in hand by drawing whenever possible. Once
            the draw pile is empty, this rule no longer applies.
          </P>
        </Section>

        <Section title="High-tier power cards (always playable)">
          <P>
            <Bold>2</Bold> — Resets the pile. The next player can play anything.{'\n'}
            {'\n'}
            <Bold>8</Bold> — Invisible / skip. The next player plays off the card
            beneath the 8, not the 8 itself.
          </P>
        </Section>

        <Section title="Low-tier power cards (situational)">
          <P>
            <Bold>7</Bold> — The next card must be a 7 or lower. (Exception: an 8
            may always be played, and stacking an 8 on a 7 is encouraged — see
            Jake's note.){'\n'}
            {'\n'}
            <Bold>10</Bold> — Burns the entire pile. You take another turn and
            start a new pile. Cannot be played on a 7.{'\n'}
            {'\n'}
            <Bold>Four of a kind</Bold> — Same effect as a 10: burns the pile,
            extra turn. An 8 in between does <Italic>not</Italic> break the
            sequence. Example: three 5s → 8 → 5 still burns.
          </P>
        </Section>

        <Section title="Mid-game (face-up)">
          <P>
            When both your hand and the draw pile are empty, play from your face-up
            cards. Same meet-or-beat rules apply. Can't play one? Pick up the pile
            and use it as your new hand.
          </P>
        </Section>

        <Section title="Late game (face-down)">
          <P>
            Once your face-up cards are gone, flip face-down cards blind, one at a
            time. If the flipped card doesn't beat the top of the pile, you pick
            up the pile (with the flipped card) and must clear that hand before
            flipping again.
          </P>
        </Section>

        <Section title="Long live Jake the Elder">
          <P>
            From Jake the Elder, the herald of SHED:{'\n'}
            {'\n'}
            <Italic>
              "8 is definitely playable on 7. It's invisible. Plus, it lets you
              pass the 7 to the next person, which is potentially a huge tactical
              move."
            </Italic>
            {'\n'}
            {'\n'}
            <Italic>
              "7s and 10s are lower-tier than 8s and 2s. They're situational —
              sometimes good, sometimes bad. 2 and 8 are always playable and
              always good to have."
            </Italic>
          </P>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Ruleset picker popout */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Choose a ruleset</Text>
            <ScrollView bounces={false}>
              {PRESET_ORDER.map((id) => {
                const p = RULE_PRESETS[id];
                const active = id === variantId;
                return (
                  <Pressable
                    key={id}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      setVariantId(id);
                      setPickerOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text
                        style={[styles.optionName, active && styles.optionNameActive]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                      <Text style={styles.optionDesc} numberOfLines={2}>
                        {p.description}
                      </Text>
                    </View>
                    {active && <Text style={styles.optionCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

function Bold({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

function Italic({ children }: { children: React.ReactNode }) {
  return <Text style={styles.italic}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.lg,
    backgroundColor: theme.color.feltBg,
    minHeight: '100%',
  },
  h1: {
    color: theme.color.textOnDark,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: theme.color.accent,
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  cta: {
    marginBottom: 14,
  },

  // Ruleset selector
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectorValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 12,
  },
  selectorValue: {
    color: theme.color.accent,
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  caret: {
    color: theme.color.textMuted,
    fontSize: 13,
    marginLeft: 6,
  },

  // Variant summary
  summaryCard: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.color.accent,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryFlavor: {
    color: theme.color.textMuted,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 19,
  },
  summaryHeading: {
    color: theme.color.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletDot: {
    color: theme.color.accent,
    fontSize: 14,
    lineHeight: 20,
    width: 14,
  },
  bulletText: {
    flex: 1,
    color: theme.color.textOnDark,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryNote: {
    color: theme.color.textMuted,
    fontSize: 12,
    marginTop: 8,
  },

  // Divider before base rules
  divider: {
    marginTop: 22,
    marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingBottom: 6,
  },
  dividerText: {
    color: theme.color.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  section: { marginTop: 16 },
  h2: {
    color: theme.color.accent,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  p: {
    color: theme.color.textOnDark,
    fontSize: 14,
    lineHeight: 22,
  },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic', color: theme.color.textMuted },

  // Picker popout
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: theme.space.lg,
  },
  sheet: {
    maxHeight: '74%',
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.lg,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  sheetTitle: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionActive: {
    backgroundColor: 'rgba(244,196,48,0.10)',
  },
  optionTextWrap: { flex: 1 },
  optionName: {
    color: theme.color.textOnDark,
    fontSize: 15,
    fontWeight: '700',
  },
  optionNameActive: {
    color: theme.color.accent,
  },
  optionDesc: {
    color: theme.color.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  optionCheck: {
    color: theme.color.accent,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
  },
});