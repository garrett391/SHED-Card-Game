import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../src/components/Button';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';
import { PlayerConfig, RuleConfig } from '../src/engine/types';
import { RULE_PRESETS, PRESET_ORDER } from '../src/campaign/presets';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const DEFAULT_NAMES = ['Player 1', 'Jake', 'Erich', 'Bauer', 'Cousin', 'Elder'];

// ─── Mode picker card ───────────────────────────────────────────────────────────

function ModeCard({
  preset,
  selected,
  onPress,
}: {
  preset: RuleConfig;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeCard,
        selected && styles.modeCardSelected,
      ]}
    >
      <View style={styles.modeHeader}>
        <View
          style={[
            styles.modeRadio,
            selected && styles.modeRadioSelected,
          ]}
        >
          {selected && <View style={styles.modeRadioDot} />}
        </View>
        <Text
          style={[
            styles.modeName,
            selected && styles.modeNameSelected,
          ]}
          numberOfLines={1}
        >
          {preset.name}
        </Text>
      </View>
      <Text style={styles.modeDesc}>{preset.description}</Text>
      {selected && (
        <Text style={styles.modeFlavor}>"{preset.flavorText}"</Text>
      )}
    </Pressable>
  );
}

// ─── Setup screen ───────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);

  const [selectedMode, setSelectedMode] = useState<string>('jake-classic');
  const [players, setPlayers] = useState<PlayerConfig[]>([
    { name: 'Player 1', isBot: false },
    { name: 'Bot 1', isBot: true },
    { name: 'Bot 2', isBot: true },
  ]);

  const setName = (idx: number, name: string) =>
    setPlayers((ps) => ps.map((p, i) => (i === idx ? { ...p, name } : p)));

  const toggleBot = (idx: number) =>
    setPlayers((ps) =>
      ps.map((p, i) =>
        i === idx
          ? {
              ...p,
              isBot: !p.isBot,
              name: !p.isBot
                ? `Bot ${ps.filter((q) => q.isBot).length + 1}`
                : DEFAULT_NAMES[idx] ?? `Player ${idx + 1}`,
            }
          : p,
      ),
    );

  const addPlayer = () => {
    if (players.length >= MAX_PLAYERS) return;
    setPlayers([
      ...players,
      { name: `Bot ${players.filter((p) => p.isBot).length + 1}`, isBot: true },
    ]);
  };

  const removePlayer = (idx: number) => {
    if (players.length <= MIN_PLAYERS) return;
    setPlayers(players.filter((_, i) => i !== idx));
  };

  const start = () => {
    const preset = RULE_PRESETS[selectedMode] ?? RULE_PRESETS['jake-classic'];
    startGame(players, preset);
    router.replace('/swap');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* ── Game mode picker ────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Game mode</Text>
      {PRESET_ORDER.map((id) => (
        <ModeCard
          key={id}
          preset={RULE_PRESETS[id]}
          selected={selectedMode === id}
          onPress={() => setSelectedMode(id)}
        />
      ))}

      {/* ── Player config ───────────────────────────────────────────── */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Players</Text>
      <Text style={styles.intro}>
        2–6 players. Tap a row to toggle human / bot.
      </Text>

      {players.map((p, i) => (
        <View key={i} style={styles.row}>
          <Pressable
            style={[styles.botToggle, p.isBot && styles.botToggleActive]}
            onPress={() => toggleBot(i)}
          >
            <Text style={styles.botEmoji}>{p.isBot ? '🤖' : '🧑'}</Text>
            <Text style={styles.botLabel}>{p.isBot ? 'Bot' : 'Human'}</Text>
          </Pressable>
          <TextInput
            value={p.name}
            onChangeText={(t) => setName(i, t)}
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={theme.color.textMuted}
            maxLength={16}
          />
          {players.length > MIN_PLAYERS && (
            <Pressable onPress={() => removePlayer(i)} style={styles.removeBtn}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}

      {players.length < MAX_PLAYERS && (
        <Button title="+ Add player" variant="ghost" onPress={addPlayer} />
      )}

      <View style={styles.footer}>
        <Button title="Deal cards" onPress={start} />
      </View>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: theme.space.lg, paddingBottom: 40 },

  // Section labels
  sectionLabel: {
    color: theme.color.textOnDark,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
    opacity: 0.6,
  },

  // Mode picker
  modeCard: {
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 8,
  },
  modeCardSelected: {
    borderColor: '#d4a843',
    backgroundColor: '#1a3e2e',
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRadioSelected: {
    borderColor: '#d4a843',
  },
  modeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d4a843',
  },
  modeName: {
    color: theme.color.textOnDark,
    fontSize: 15,
    fontWeight: '600',
  },
  modeNameSelected: {
    color: '#f0d78c',
  },
  modeDesc: {
    color: theme.color.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 28,
    lineHeight: 17,
  },
  modeFlavor: {
    color: '#d4a843',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
    marginLeft: 28,
  },

  // Player config
  intro: {
    color: theme.color.textOnDark,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    padding: 8,
  },
  botToggle: {
    width: 70,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    backgroundColor: '#1f4d3d',
  },
  botToggleActive: { backgroundColor: '#2a5a48' },
  botEmoji: { fontSize: 22 },
  botLabel: {
    color: theme.color.textOnDark,
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 16,
    color: theme.color.textOnDark,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.textMuted,
  },
  removeBtn: { padding: 8 },
  removeText: { color: theme.color.danger, fontSize: 18, fontWeight: '700' },
  footer: { marginTop: 24 },
});
