import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

/**
 * Under the pile: whose turn it is and what just happened on the left, the
 * Play button on the right when the human can play. The button stays
 * tappable with nothing selected (dimmed) so the screen can explain why.
 */
export function TurnBanner({
  title,
  recent,
  notice,
  selectedCount,
  onPlay,
}: {
  title: string;
  /** The last action, one line; omitted before anyone has played. */
  recent?: string;
  /** A short-lived message (why a play was refused) shown in place of
   *  `recent`, so nothing below it moves. */
  notice?: string;
  selectedCount: number;
  /** Shows the Play button. */
  onPlay?: () => void;
}) {
  const ready = selectedCount > 0;
  return (
    <View style={styles.banner}>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        {notice !== undefined ? (
          <Text style={[styles.recent, styles.notice]}>{notice}</Text>
        ) : (
          recent !== undefined && <Text style={styles.recent}>{recent}</Text>
        )}
      </View>
      {onPlay && (
        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [
            styles.playBtn,
            ready ? styles.playBtnActive : styles.playBtnDim,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.playBtnText, !ready && styles.playBtnTextDim]}>
            {selectedCount > 1 ? `Play ${selectedCount}` : 'Play'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 3,
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
  },
  info: {
    flex: 1,
  },
  title: {
    color: theme.color.accent,
    fontWeight: '700',
    fontSize: 15,
  },
  recent: {
    color: theme.color.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  notice: { color: theme.color.accent, fontWeight: '600' },
  playBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    marginLeft: 10,
  },
  playBtnActive: {
    backgroundColor: theme.color.primary,
  },
  playBtnDim: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  playBtnTextDim: {
    color: theme.color.textMuted,
  },
});
