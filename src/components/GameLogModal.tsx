import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LogEntry } from '../engine/types';
import { theme } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  log: LogEntry[];
}

/**
 * Scrollable game-log modal (the 📜 button's target). Shared between the
 * in-game history view and the game-over screen so a finished game can
 * still be reviewed play-by-play.
 */
export function GameLogModal({ visible, onClose, log }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Game Log</Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  const text = log.map((e) => e.text).join('\n');
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(text);
                  }
                }}
                hitSlop={8}
                style={styles.copyBtn}
              >
                <Text style={styles.copyText}>📋 Copy</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.list} bounces={false}>
            {log.map((entry) => (
              <View key={entry.id} style={styles.row}>
                <Text style={styles.num}>{entry.id + 1}</Text>
                <Text style={styles.text}>{entry.text}</Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.lg,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  copyText: {
    color: theme.color.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  close: {
    color: theme.color.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    paddingTop: 6,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  num: {
    color: theme.color.textMuted,
    fontSize: 11,
    width: 28,
    textAlign: 'right',
    marginRight: 10,
    fontVariant: ['tabular-nums'],
  },
  text: {
    color: theme.color.textOnDark,
    fontSize: 13,
    flex: 1,
  },
});
