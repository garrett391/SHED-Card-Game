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
import { PlayerConfig } from '../src/engine/types';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const DEFAULT_NAMES = ['You', 'Jake', 'Erich', 'Bauer', 'Cousin', 'Elder'];

export default function SetupScreen() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);

  const [players, setPlayers] = useState<PlayerConfig[]>([
    { name: 'You', isBot: false },
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
    startGame(players);
    router.replace('/swap');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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

const styles = StyleSheet.create({
  container: { padding: theme.space.lg, paddingBottom: 40 },
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
