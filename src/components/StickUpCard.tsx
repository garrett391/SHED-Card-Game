import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../engine/types';
import { PlayingCard } from './PlayingCard';

/**
 * The stick-up at the Outlaw Pass, shown as a wanted-poster panel over the
 * table whenever a 7 robs (or tries to rob) a human, or a human robs: what
 * was taken and given, or why nothing was. Play waits until it's dismissed,
 * so the trade can't slip by in a caption.
 */
export type StickUp = {
  robber: string;
  victim: string;
  /** The robber's line, already filled in, e.g. "This is a hold up!" */
  quote?: string;
} & (
  | { kind: 'trade'; took: Card; gave: Card }
  | { kind: 'nothingBetter'; best: Card; worst: Card }
  | { kind: 'nothingWorth' | 'emptyHand' | 'robberEmpty' }
);

interface Props {
  stickUp: StickUp;
  /** Speak to the single human at the table as "you" when they're involved. */
  robberIsYou: boolean;
  victimIsYou: boolean;
  onClose: () => void;
}

const INK = '#3b2a1a';
const INK_SOFT = '#5c4630';
const PAPER = '#f1e3c2';
const LEATHER = '#7a4a24';
const RUST = '#8a2e1b';
const SAGE = '#2f5d3a';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function StickUpCard({ stickUp: s, robberIsYou, victimIsYou, onClose }: Props) {
  const R = robberIsYou ? 'You' : s.robber;
  const robs = robberIsYou ? 'rob' : 'robs';
  const V = victimIsYou ? 'you' : s.victim;
  const Vs = victimIsYou ? 'your' : `${s.victim}'s`;
  const Rs = robberIsYou ? 'your' : 'their';

  let title = 'No stick-up this time';
  let line: string;
  let body: React.ReactNode = null;
  let note: string | null = null;
  if (s.kind === 'trade') {
    title = 'STICK-UP!';
    line = `${R} played a 7 and ${robs} ${V}.`;
    body = robberIsYou ? (
      <Swap
        left={{ label: 'You take', card: s.took, color: SAGE }}
        right={{ label: 'You give', card: s.gave, color: RUST }}
        between="⇄"
      />
    ) : (
      <Swap
        left={{ label: 'Taken', card: s.took, color: RUST }}
        right={{ label: victimIsYou ? 'You get' : `${s.victim} gets`, card: s.gave, color: SAGE }}
        between="⇄"
      />
    );
  } else if (s.kind === 'nothingBetter') {
    line = `${R} played a 7 and sized up ${Vs} hand.`;
    body = (
      <Swap
        left={{ label: `${cap(Vs)} best`, card: s.best }}
        right={{ label: `${cap(Rs)} worst`, card: s.worst }}
        between="<"
      />
    );
    note = `${cap(Vs)} best card isn't worth more than ${Rs} worst, so nobody trades.`;
  } else if (s.kind === 'nothingWorth') {
    line = `${R} played a 7 and sized up ${Vs} hand. Nothing worth taking.`;
  } else if (s.kind === 'emptyHand') {
    line = `${R} played a 7 and went for ${Vs} hand, but it's empty.`;
  } else {
    line = `${R} played the 7 from the table, with no hand to trade.`;
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel} accessibilityRole="alert">
        <Text style={[styles.title, s.kind !== 'trade' && styles.titleQuiet]}>{title}</Text>
        {s.quote && (
          <Text style={styles.quote}>
            <Text style={styles.quoteName}>{s.robber}: </Text>“{s.quote}”
          </Text>
        )}
        <Text style={styles.line}>{line}</Text>
        {body}
        {note && <Text style={styles.note}>{note}</Text>}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.buttonText}>
            {s.kind !== 'trade' ? 'Ride on' : robberIsYou ? 'Much obliged' : 'Hand it over'}
          </Text>
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
  quote: {
    fontFamily: 'serif',
    fontSize: 17,
    fontStyle: 'italic',
    lineHeight: 22,
    color: INK,
    textAlign: 'center',
  },
  quoteName: { fontStyle: 'normal', fontWeight: '700', color: LEATHER },
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
