/**
 * Achievements: every badge, unlocked or not, with how to earn it.
 * Locked ones still show their name and description: knowing what to
 * chase is half the fun.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ACHIEVEMENTS } from '../src/achievements/achievements';
import { useAchievementStore } from '../src/store/achievementStore';
import { theme } from '../src/components/theme';
import { Flame, Lock } from 'lucide-react-native';
import { AchievementIcon } from '../src/components/AchievementIcon';

export default function AchievementsScreen() {
  const unlocked = useAchievementStore((s) => s.unlocked);
  const streak = useAchievementStore((s) => s.streak);
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryCount}>
            {count} <Text style={styles.summaryOf}>of {ACHIEVEMENTS.length} unlocked</Text>
          </Text>
          {streak > 0 && (
            <View style={styles.streak}>
              <Flame size={14} color="#f08a4b" strokeWidth={2.25} />
              <Text style={styles.streakText}>
                {streak} win{streak === 1 ? '' : 's'} in a row
              </Text>
            </View>
          )}
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${(count / ACHIEVEMENTS.length) * 100}%` }]} />
        </View>
      </View>

      {ACHIEVEMENTS.map((a) => {
        const date = unlocked[a.id];
        return (
          <View
            key={a.id}
            style={[styles.row, date ? styles.rowDone : styles.rowLocked]}
            accessibilityLabel={`${a.name}. ${date ? 'Unlocked.' : 'Locked.'} ${a.description}`}
          >
            <View style={[styles.badge, date ? styles.badgeDone : styles.badgeLocked]}>
              <AchievementIcon id={a.id} size={24} color={date ? theme.color.accent : '#93a39c'} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.name, !date && styles.nameLocked]}>{a.name}</Text>
              <Text style={styles.desc}>{a.description}</Text>
              {date ? (
                <Text style={[styles.meta, styles.metaDone]}>
                  Unlocked {new Date(date).toLocaleDateString()}
                </Text>
              ) : (
                <View style={styles.metaRow}>
                  <Lock size={11} color="#93a39c" strokeWidth={2.5} />
                  <Text style={styles.meta}>Locked</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.lg,
    backgroundColor: theme.color.feltBg,
    minHeight: '100%',
    gap: 10,
  },
  summary: { gap: 8, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryCount: { color: theme.color.textOnDark, fontSize: 22, fontWeight: '900' },
  summaryOf: { color: theme.color.textMuted, fontSize: 14, fontWeight: '600' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { color: '#f0b08a', fontSize: 13, fontWeight: '700' },
  bar: { height: 8, borderRadius: 4, backgroundColor: theme.color.feltBgDark, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowDone: { backgroundColor: 'rgba(244,196,48,0.08)', borderColor: 'rgba(244,196,48,0.5)' },
  rowLocked: { backgroundColor: theme.color.feltBgDark, borderColor: 'transparent' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeDone: { backgroundColor: '#3a2f08', borderColor: theme.color.accent },
  badgeLocked: { backgroundColor: '#13241d', borderColor: '#3b5248' },
  text: { flex: 1 },
  name: { color: theme.color.textOnDark, fontSize: 16, fontWeight: '800' },
  nameLocked: { color: '#dfe6e2' },
  desc: { color: '#b9c6c0', fontSize: 13, lineHeight: 18, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { color: '#93a39c', fontSize: 11, fontWeight: '600' },
  metaDone: { color: theme.color.accent, marginTop: 4 },
});
