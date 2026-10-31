import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import { PlayingCard } from './PlayingCard';

/**
 * The bandits' stick-up, shown as a wanted-poster panel over the table
 * whenever a bandit's 7 targets a human: what was taken and given, or why
 * nothing was. Play waits until it's dismissed, so the trade can't slip by
 * in a caption.
 */
export type StickUp =
  | { kind: 'trade'; robber: string; victim: string; took: Card; gave: Card }
  | { kind: 'nothingBetter'; robber: string; victim: string; best: Card; worst: Card }
  | { kind: 'emptyHand' | 'robberEmpty'; robber: string; victim: string };

interface Props {
  stickUp: StickUp;
  /** The victim is the only human at the table: speak to them as "you". */
  victimIsYou: boolean;
  onClose: () => void;
}

const INK = '#3b2a1a';
const INK_SOFT = '#5c4630';
const PAPER = '#f1e3c2';
const LEATHER = '#7a4a24';
const RUST = '#8a2e1b';
const SAGE = '#2f5d3a';

export function StickUpCard({ stickUp: s, victimIsYou, onClose }: Props) {
  const you = victimIsYou ? 'you' : s.victim;
  const your = victimIsYou ? 'your' : `${s.victim}'s`;
  const Your = victimIsYou ? 'Your' : `${s.victim}'s`;

  let title: string;
  let line: string;
  let body: React.ReactNode = null;
  let note: string | null = null;
  if (s.kind === 'trade') {
    title = 'STICK-UP!';
    line = `${s.robber} played a 7 and robs ${you}.`;
    body = (
      <Swap
        left={{ label: 'Taken', card: s.took, color: RUST }}
        right={{ label: victimIsYou ? 'You get' : `${s.victim} gets`, card: s.gave, color: SAGE }}
        between="⇄"
      />
    );
  } else if (s.kind === 'nothingBetter') {
    title = 'No stick-up this time';
    line = `${s.robber} played a 7 and sized up ${your} hand.`;
    body = (
      <Swap
        left={{ label: `${Your} best`, card: s.best }}
        right={{ label: 'Their worst', card: s.worst }}
        between="<"
      />
    );
    note = `${Your} best card isn't worth more than their worst, so ${you} ${victimIsYou ? 'keep' : 'keeps'} ${victimIsYou ? 'your' : 'their'} cards.`;
  } else if (s.kind === 'emptyHand') {
    title = 'No stick-up this time';
    line = `${s.robber} played a 7 and went for ${your} hand, but it's empty.`;
  } else {
    title = 'No stick-up this time';
    line = `${s.robber} played a 7 from the table, with no hand to trade.`;
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel} accessibilityRole="alert">
        <Text style={[styles.title, s.kind !== 'trade' && styles.titleQuiet]}>{title}</Text>
        <Text style={styles.line}>{line}</Text>
        {body}
        {note && <Text style={styles.note}>{note}</Text>}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.buttonText}>{s.kind === 'trade' ? 'Hand it over' : 'Ride on'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Swap({
  left,
  right,
  between,
}: {
  left: { label: string; card: Card; color?: string };
  right: { label: string; card: Card; color?: string };
  between: string;
}) {
  return (
    <View style={styles.swap}>
      <Slot {...left} />
      <Text style={styles.between}>{between}</Text>
      <Slot {...right} />
    </View>
  );
}

function Slot({ label, card, color }: { label: string; card: Card; color?: string }) {
  return (
    <View style={styles.slot}>
      <Text style={[styles.slotLabel, color ? { color } : null]}>{label}</Text>
      <View style={[styles.cardFrame, color ? { borderColor: color } : null]}>
        <PlayingCard card={card} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 24,
  },
  panel: {
    backgroundColor: PAPER,
    borderColor: LEATHER,
    borderWidth: 3,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  title: {
    fontFamily: 'serif',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: RUST,
    textAlign: 'center',
  },
  titleQuiet: { fontSize: 26, color: LEATHER },
  line: { fontSize: 15, lineHeight: 20, color: INK, textAlign: 'center' },
  swap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14 },
  slot: { alignItems: 'center', gap: 8 },
  slotLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: INK_SOFT,
  },
  cardFrame: { borderWidth: 3, borderColor: 'transparent', borderRadius: 12, padding: 1 },
  between: { fontSize: 26, fontWeight: '700', color: LEATHER, paddingBottom: 34 },
  note: { fontSize: 14, lineHeight: 19, color: INK, textAlign: 'center' },
  button: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 10,
    backgroundColor: LEATHER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: PAPER, fontSize: 16, fontWeight: '700' },
});
