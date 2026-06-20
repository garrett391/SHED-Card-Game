import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../src/components/theme';

/**
 * Static reference card for SHED rules. Kept as plain Text components
 * rather than markdown so we don't add a dependency for v1.
 */
export default function RulesScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>SHED</Text>
      <Text style={styles.subtitle}>Original rules as spake by Jake</Text>

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
          face-down wins. The last player still holding cards is the SHITHEAD.
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

      <Section title="Long live Elder Jake">
        <P>
          From Cousin Jake, the official creator of SHED (01/05/2025):{'\n'}
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
});
