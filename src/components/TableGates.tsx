import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircleCheck, CircleX } from 'lucide-react-native';
import { Card, Player } from '../engine/types';
import { Button } from './Button';
import { PlayingCard } from './PlayingCard';
import { theme } from './theme';

/**
 * Full-screen moments that take over the table: passing the device,
 * choosing whose hand the black joker takes, and the face-down flip.
 */

function Gate({ children }: { children: ReactNode }) {
  return (
    <View style={styles.container}>
      <View style={styles.gate}>{children}</View>
    </View>
  );
}

/** Pass-and-play: hide the hand until the next human taps "I'm ready". */
export function PassDeviceGate({
  name,
  lastAction,
  onReady,
}: {
  name: string;
  /** What just happened, so the next player isn't lost. */
  lastAction?: string;
  onReady: () => void;
}) {
  return (
    <Gate>
      <Text style={styles.passLabel}>Pass the device to</Text>
      <Text style={styles.passName}>{name}</Text>
      {lastAction !== undefined && <Text style={styles.lastAction}>{lastAction}</Text>}
      <Button title="I'm ready" onPress={onReady} />
    </Gate>
  );
}

/** The black joker: pick whose hand to swap with. */
export function SwapTargetPicker({
  targets,
  onPick,
  onCancel,
}: {
  targets: readonly Player[];
  onPick: (playerId: number) => void;
  onCancel: () => void;
}) {
  return (
    <Gate>
      <Text style={styles.passLabel}>The black joker</Text>
      <Text style={styles.passName}>Swap hands with…</Text>
      <View style={styles.targets}>
        {targets.map((p) => (
          <Button
            key={p.id}
            title={`${p.name} · ${p.hand.length} card${p.hand.length === 1 ? '' : 's'}`}
            onPress={() => onPick(p.id)}
          />
        ))}
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Gate>
  );
}

/** A face-down flip: show the card and whether it played, until Continue. */
export function FlipResultGate({
  playerName,
  card,
  success,
  onContinue,
}: {
  playerName: string;
  card: Card;
  success: boolean;
  onContinue: () => void;
}) {
  const color = success ? theme.color.success : theme.color.danger;
  return (
    <Gate>
      <Text style={styles.passLabel}>{playerName} flipped…</Text>
      <View style={styles.flipCardWrap}>
        <PlayingCard card={card} />
      </View>
      <View style={styles.flipVerdictRow}>
        {success ? (
          <CircleCheck size={22} color={color} strokeWidth={2.5} />
        ) : (
          <CircleX size={22} color={color} strokeWidth={2.5} />
        )}
        <Text style={[styles.flipVerdict, { color }]}>
          {success ? 'It plays!' : 'No good — you pick up the pile'}
        </Text>
      </View>
      <View style={{ marginTop: 24 }}>
        <Button title="Continue" onPress={onContinue} />
      </View>
    </Gate>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.md,
    backgroundColor: theme.color.feltBg,
    minHeight: '100%',
    paddingBottom: 40,
  },
  gate: {
    flex: 1,
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  passLabel: { color: theme.color.textMuted, fontSize: 16 },
  passName: {
    color: theme.color.accent,
    fontSize: 48,
    fontWeight: '900',
    marginVertical: 12,
    textAlign: 'center',
  },
  lastAction: {
    color: theme.color.textOnDark,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  targets: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  flipCardWrap: {
    marginVertical: 20,
    alignItems: 'center',
  },
  flipVerdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  flipVerdict: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
});
