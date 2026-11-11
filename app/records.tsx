/**
 * Records: how the games on this device have gone. Totals up top, a
 * leaderboard by player name (friends at the table and the hosts alike),
 * then the most recent games. Filled in as games finish; see
 * src/records/records.ts for what counts.
 */
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bot, Trophy } from 'lucide-react-native';
import { theme } from '../src/components/theme';
import { characterByName } from '../src/campaign/characters';
import { useRecordStore } from '../src/store/recordStore';
import { useAutoClear } from '../src/table/useAutoClear';
import {
  GameRecord,
  leaderboard,
  resultLine,
  Tally,
  tallyKey,
  winRate,
} from '../src/records/records';

const GOLD = theme.color.accent;
const LOSS = '#e2603f'; // as on the game over screen
const PANEL = theme.color.feltBgDark;
const LINE = '#2b5a49';

export default function RecordsScreen() {
  const records = useRecordStore((s) => s.records);
  const clear = useRecordStore((s) => s.clear);
  // Clearing takes a second tap; the first one arms it for a few seconds.
  const [armed, setArmed] = useState(false);
  useAutoClear(armed, () => setArmed(false), 4000);

  if (records.games === 0) {
    return (
      <View style={[styles.container, styles.empty]}>
        <Text style={styles.emptyTitle}>Nothing on record yet.</Text>
        <Text style={styles.emptyText}>
          Finish a game and it's written down here: who won, who you've beaten most, and how
          your last games went.
        </Text>
      </View>
    );
  }

  const board = leaderboard(records);
  const tiles = [
    { value: String(records.games), label: records.games === 1 ? 'game' : 'games' },
    { value: `${winRate(records)}%`, label: 'won' },
    { value: String(records.bestStreak), label: 'best streak' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.heading}>Leaderboard</Text>
      <View style={styles.panel}>
        {board.map((t, i) => (
          <BoardRow key={tallyKey(t)} place={i + 1} tally={t} last={i === board.length - 1} />
        ))}
      </View>

      <Text style={styles.heading}>
        {records.recent.length < records.games
          ? `Last ${records.recent.length} games`
          : 'Games'}
      </Text>
      <View style={styles.games}>
        {records.recent.map((r, i) => (
          <GameRow key={`${r.at}-${i}`} record={r} />
        ))}
      </View>

      <Pressable
        onPress={() => {
          if (armed) {
            clear();
            setArmed(false);
          } else {
            setArmed(true);
          }
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.clear, armed && styles.clearArmed, pressed && { opacity: 0.75 }]}
      >
        <Text style={[styles.clearText, armed && { color: LOSS }]}>
          {armed ? 'Tap again to clear everything' : 'Clear records'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function BoardRow({ place, tally, last }: { place: number; tally: Tally; last: boolean }) {
  const character = tally.isBot ? characterByName(tally.name) : null;
  const leader = place === 1 && tally.wins > 0;
  return (
    <View
      style={[styles.boardRow, !last && styles.boardRowLine]}
      accessibilityLabel={`${place}. ${tally.name}: ${tally.wins} wins in ${tally.games} games`}
    >
      <Text style={[styles.place, leader && { color: GOLD }]}>{place}</Text>
      {character?.portrait ? (
        <Image source={character.portrait} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, !tally.isBot && styles.avatarHuman]}>
          <Text style={styles.avatarText}>
            {character?.emoji ?? tally.name.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.boardName}>
        <Text style={styles.name} numberOfLines={1}>{tally.name}</Text>
        {tally.isBot && !character && (
          <Bot size={14} color={theme.color.textMuted} strokeWidth={2.25} />
        )}
      </View>
      <View style={styles.boardNumbers}>
        <Text style={styles.wins}>
          {tally.wins} <Text style={styles.winsOf}>/ {tally.games}</Text>
        </Text>
        <Text style={styles.rate}>{winRate(tally)}% won</Text>
      </View>
    </View>
  );
}

function GameRow({ record }: { record: GameRecord }) {
  const result = resultLine(record);
  const others = record.players.length - 1;
  return (
    <View style={styles.game}>
      <View style={styles.gameTop}>
        <Text style={styles.gameTable} numberOfLines={1}>{record.table}</Text>
        <Text style={styles.gameDate}>{new Date(record.at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.gameResult}>
        {result.tone === 'won' && <Trophy size={15} color={GOLD} strokeWidth={2.25} />}
        <Text
          style={[
            styles.gameResultText,
            result.tone === 'won' && { color: GOLD },
            result.tone === 'lost' && { color: LOSS },
          ]}
        >
          {result.text}
        </Text>
      </View>
      <Text style={styles.gameMeta}>
        {record.campaign ? 'Campaign' : 'Free play'} · {record.players.length} players ·{' '}
        {record.turns} turn{record.turns === 1 ? '' : 's'}
        {record.shithead && others > 1 ? ` · Shithead: ${record.shithead}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.lg,
    paddingBottom: 28,
    backgroundColor: theme.color.feltBg,
    minHeight: '100%',
    gap: 10,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { color: theme.color.textOnDark, fontSize: 20, fontWeight: '800' },
  emptyText: {
    color: theme.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: PANEL, borderRadius: 12, padding: 10, gap: 2 },
  tileValue: { color: theme.color.textOnDark, fontSize: 22, fontWeight: '900' },
  tileLabel: { color: theme.color.textMuted, fontSize: 12, lineHeight: 15 },
  heading: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  panel: { backgroundColor: PANEL, borderRadius: 14, paddingHorizontal: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  boardRowLine: { borderBottomWidth: 1, borderBottomColor: LINE },
  place: { width: 22, fontSize: 16, fontWeight: '900', color: theme.color.textMuted },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7a4a24',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarHuman: { backgroundColor: theme.color.secondary },
  avatarText: { color: '#f1e3c2', fontSize: 15, fontWeight: '800' },
  boardName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: theme.color.textOnDark, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  boardNumbers: { alignItems: 'flex-end' },
  wins: { color: theme.color.textOnDark, fontSize: 16, fontWeight: '900' },
  winsOf: { color: theme.color.textMuted, fontSize: 13, fontWeight: '600' },
  rate: { color: theme.color.textMuted, fontSize: 11 },
  games: { gap: 8 },
  game: { backgroundColor: PANEL, borderRadius: 12, padding: 12, gap: 4 },
  gameTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  gameTable: { color: theme.color.textOnDark, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  gameDate: { color: '#6f7d77', fontSize: 11 },
  gameResult: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gameResultText: { color: '#c9d2ce', fontSize: 14, fontWeight: '700' },
  gameMeta: { color: theme.color.textMuted, fontSize: 12 },
  clear: {
    marginTop: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearArmed: { borderColor: LOSS },
  clearText: { color: theme.color.textMuted, fontSize: 14, fontWeight: '700' },
});
