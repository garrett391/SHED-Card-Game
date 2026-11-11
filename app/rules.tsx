import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../src/components/theme';
import { Check } from 'lucide-react-native';
import { Button } from '../src/components/Button';
import { PlayingCard } from '../src/components/PlayingCard';
import { Card } from '../src/engine/types';
import { RULE_PRESETS, PRESET_ORDER, getPreset } from '../src/campaign/presets';
import { variantDiff } from '../src/campaign/ruleSummary';

/** Three 5s, an 8, then a 5: the 8 doesn't break four of a kind. */
const FOUR_OF_A_KIND: Card[] = [
  { id: 'f1', rank: 5, suit: '♠' },
  { id: 'f2', rank: 5, suit: '♥' },
  { id: 'f3', rank: 5, suit: '♣' },
  { id: 'f4', rank: 8, suit: '♦' },
  { id: 'f5', rank: 5, suit: '♦' },
];

/**
 * The rulesets worth looking up: Jake's Classic and every table that
 * changes something. A table that plays by the classic rules (The
 * Spreading) would only repeat it.
 */
const RULESETS = PRESET_ORDER.filter(
  (id, i) => i === 0 || variantDiff(RULE_PRESETS[id]).length > 0,
);

const FACE_UP: Card[] = [
  { id: 'u1', rank: 14, suit: '♠' },
  { id: 'u2', rank: 2, suit: '♥' },
  { id: 'u3', rank: 10, suit: '♣' },
];

/**
 * The rulebook. A variant picker at the top shows an auto-generated "what's
 * different" summary for any ruleset (derived from its RuleConfig, so it
 * can't drift from the engine); the rulebook under it is Jake's Classic,
 * laid out as panels with the cards drawn where they help: the four power
 * cards, four of a kind, the deal.
 */
export default function RulesScreen() {
  const router = useRouter();
  const [variantId, setVariantId] = useState('jake-classic');
  const [pickerOpen, setPickerOpen] = useState(false);

  const preset = getPreset(variantId);
  const diff = variantDiff(preset);
  // Zero diffs means Jake's Classic itself: show the "original ruleset"
  // note rather than an empty "What's different" list.
  const isClassic = diff.length === 0;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>

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

        <Section title="The goal">
          <P>
            Get rid of all nine of your cards. First to clear hand, face-up and
            face-down wins. Everyone left holding cards is a SHITHEAD.
          </P>
        </Section>

        <Section title="The power cards">
          <PowerCard
            card={{ id: 'r2', rank: 2, suit: '♠' }}
            name="Reset"
            tier="Always playable"
            text="Resets the pile. The next player can play anything."
          />
          <PowerCard
            card={{ id: 'r8', rank: 8, suit: '♥' }}
            name="Invisible"
            tier="Always playable"
            text="The next player plays off the card beneath the 8, not the 8 itself."
          />
          <PowerCard
            card={{ id: 'r7', rank: 7, suit: '♣' }}
            name="Go low"
            tier="Situational"
            text="The next card must be a 7 or lower. An 8 may still be played on it, and that passes the 7 along."
          />
          <PowerCard
            card={{ id: 'r10', rank: 10, suit: '♦' }}
            name="Burn"
            tier="Situational"
            text="Burns the whole pile. You take another turn and start a new pile. Cannot be played on a 7."
            last
          />
        </Section>

        <Section title="Four of a kind">
          <View style={styles.fan}>
            {FOUR_OF_A_KIND.map((card, i) => (
              <View key={card.id} style={i > 0 && styles.fanNext}>
                <PlayingCard card={card} small disabled dimmed={card.rank === 8} />
              </View>
            ))}
          </View>
          <P>
            Four of the same rank on the pile burns it, the same as a 10: the
            pile is gone and you go again. An 8 in between does{' '}
            <Italic>not</Italic> break the run: three 5s, an 8, then a 5 still
            burns.
          </P>
        </Section>

        <Section title="The deal">
          <View style={styles.dealRow}>
            <Deal label="Face-down" note="late game">
              {[0, 1, 2].map((i) => <PlayingCard key={i} faceDown small disabled />)}
            </Deal>
            <Deal label="Face-up" note="mid-game">
              {FACE_UP.map((c) => <PlayingCard key={c.id} card={c} small disabled />)}
            </Deal>
          </View>
          <Bullets
            items={[
              'Standard 52-card deck, no jokers. Deal one card at a time, clockwise.',
              'Each player gets three face-down, three face-up on top of them, then three in hand. Nine in all.',
              'Before play, you may swap any of your hand cards with your face-up cards. Optional but tactical.',
            ]}
          />
        </Section>

        <Section title="Who starts">
          <P>
            Whoever has the lowest non-power card plays it first. If players
            tie, the one earliest clockwise of the dealer goes first.
          </P>
        </Section>

        <Section title="On your turn">
          <Bullets
            items={[
              'Meet or beat the top card of the pile.',
              'You may play several cards of the same rank at once.',
              "If you can't play, pick up the entire pile and your turn ends.",
              'You may always choose to pick up the pile. Your turn still ends.',
              'Draw back up to three cards in hand while the draw pile lasts.',
            ]}
          />
        </Section>

        <Section title="Three stages">
          <Stage n="1" name="Hand">
            Play from your hand, drawing back up to three, until the draw pile
            and your hand are both empty.
          </Stage>
          <Stage n="2" name="Face-up">
            Play your face-up cards by the same meet-or-beat rules. Can't play
            one? Pick up the pile and use it as your new hand.
          </Stage>
          <Stage n="3" name="Face-down" last>
            Flip your face-down cards blind, one at a time. If the flip doesn't
            beat the pile, you pick up the pile with it, and must clear that
            hand before flipping again.
          </Stage>
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
              {RULESETS.map((id) => {
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
                    {active && <Check size={18} color={theme.color.accent} strokeWidth={3} />}
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

/** One of the four power cards: the card itself, its name and what it does. */
function PowerCard({
  card,
  name,
  tier,
  text,
  last,
}: {
  card: Card;
  name: string;
  tier: 'Always playable' | 'Situational';
  text: string;
  last?: boolean;
}) {
  const always = tier === 'Always playable';
  return (
    <View style={[styles.power, !last && styles.rowLine]}>
      <PlayingCard card={card} disabled />
      <View style={styles.powerText}>
        <View style={styles.powerHead}>
          <Text style={styles.powerName}>{name}</Text>
          <Text style={[styles.tier, always && styles.tierAlways]}>{tier}</Text>
        </View>
        <Text style={styles.p}>{text}</Text>
      </View>
    </View>
  );
}

function Deal({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <View style={styles.deal}>
      <View style={styles.dealCards}>{children}</View>
      <Text style={styles.dealLabel}>{label}</Text>
      <Text style={styles.dealNote}>{note}</Text>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.bullets}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Stage({
  n,
  name,
  last,
  children,
}: {
  n: string;
  name: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.stage, !last && styles.rowLine]}>
      <View style={styles.stageNumber}>
        <Text style={styles.stageNumberText}>{n}</Text>
      </View>
      <View style={styles.powerText}>
        <Text style={styles.powerName}>{name}</Text>
        <Text style={styles.p}>{children}</Text>
      </View>
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
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
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.35)',
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

  section: {
    marginTop: 12,
    backgroundColor: theme.color.feltBgDark,
    borderRadius: 14,
    padding: 14,
  },
  h2: {
    color: theme.color.accent,
    fontFamily: theme.font.western,
    fontSize: 18,
    marginBottom: 8,
  },
  p: {
    color: theme.color.textOnDark,
    fontSize: 14,
    lineHeight: 21,
  },
  italic: { fontStyle: 'italic' },
  rowLine: { borderBottomWidth: 1, borderBottomColor: '#1d4a3b' },

  // Power cards and stages: something on the left, words on the right.
  power: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  powerText: { flex: 1, gap: 3 },
  powerHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  powerName: { color: theme.color.textOnDark, fontSize: 16, fontWeight: '800' },
  tier: {
    color: '#c9d2ce',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    borderWidth: 1,
    borderColor: '#4d6d61',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  tierAlways: { color: theme.color.accent, borderColor: 'rgba(244,196,48,0.55)' },
  stage: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  stageNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNumberText: { color: '#1a1a1a', fontSize: 14, fontWeight: '900' },

  fan: { flexDirection: 'row', justifyContent: 'center', marginBottom: 10 },
  fanNext: { marginLeft: -10 },
  dealRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  deal: { alignItems: 'center', gap: 2 },
  dealCards: { flexDirection: 'row', marginBottom: 4 },
  dealLabel: { color: theme.color.textOnDark, fontSize: 13, fontWeight: '700' },
  dealNote: { color: theme.color.textMuted, fontSize: 12 },
  bullets: { gap: 2 },

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
});