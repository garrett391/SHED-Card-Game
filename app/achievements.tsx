/**
 * Achievements: every badge, unlocked or not, with how to earn it.
 * Locked ones still show their name and description: knowing what to
 * chase is half the fun.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ACHIEVEMENTS } from '../src/achievements/achievements';
import { useAchievementStore } from '../src/store/achievementStore';
import { theme } from '../src/components/theme';

export default function AchievementsScreen() {
  const unlocked = useAchievementStore((s) => s.unlocked);
  const streak = useAchievementStore((s) => s.streak);
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.summary}>
        {count} / {ACHIEVEMENTS.length} unlocked
        {streak > 0 ? `  ·  🔥 ${streak} win${streak === 1 ? '' : 's'} in a row` : ''}
      </Text>
      {ACHIEVEMENTS.map((a) => {
        const date = unlocked[a.id];
        return (
          <View
            key={a.id}
            style={[styles.row, date ? styles.rowDone : styles.rowLocked]}
            accessibilityLabel={`${a.name}. ${date ? 'Unlocked.' : 'Locked.'} ${a.description}`}
          >
            <View style={[styles.badge, date ? styles.badgeDone : styles.badgeLocked]}>
              <Text style={[styles.emoji, !date && styles.emojiLocked]}>{a.emoji}</Text>
            </View>
            <View style={styles.text}>
              <Text style={[styles.name, !date && styles.nameLocked]}>{a.name}</Text>
              <Text style={styles.desc}>{a.description}</Text>
              <Text style={styles.meta}>
                {date ? `Unlocked ${new Date(date).toLocaleDateString()}` : 'Locked'}
                {a.credit ? `  ·  Idea: ${a.credit}` : ''}
              </Text>
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
  summary: {
    color: theme.color.textMuted,
    textAlign: 'center',
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: theme.radius.md,
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
  badgeLocked: { backgroundColor: '#13241d', borderColor: '#2a3a33' },
  emoji: { fontSize: 24 },
  emojiLocked: { opacity: 0.3 },
  text: { flex: 1 },
  name: { color: theme.color.textOnDark, fontSize: 16, fontWeight: '800' },
  nameLocked: { color: '#c3cbc6' },
  desc: { color: theme.color.textMuted, fontSize: 13, marginTop: 2 },
  meta: { color: '#6f7d77', fontSize: 11, marginTop: 4 },
});
