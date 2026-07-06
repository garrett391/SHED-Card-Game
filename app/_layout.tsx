import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { theme } from '../src/components/theme';
import { useRadioStore, STATIONS } from '../src/store/radioStore';
import { preloadSfx, setSfxMuted, isSfxMuted } from '../src/audio/sfx';

// ---------------------------------------------------------------------------
// SettingsButton  (lives in the header of every screen)
// ---------------------------------------------------------------------------
//
//   [🎷]  Relaxing Jazz ▾
//    │         └────────── tap → open station picker (popout)
//    └────────────────────── tap → play / pause
//
// The 🎷 dims when paused. The name + caret opens a dropdown-style modal
// listing every station available on this platform; tapping one switches to
// it and starts playing. (Replaces the old janky ⏭ "next station" button.)
// ---------------------------------------------------------------------------

function SettingsButton() {
  const isPlaying = useRadioStore((s) => s.isPlaying);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        style={styles.toggleBtn}
        accessibilityLabel="Open settings"
        accessibilityRole="button"
      >
        <Text style={{ fontSize: 20 }}>⚙️</Text>
        {/* Tiny now-playing dot keeps radio state glanceable without a
            second sound button in the header. */}
        {isPlaying && <Text style={styles.nowPlayingNote}>♪</Text>}
      </Pressable>
      <SettingsSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// SettingsSheet  (the popout: sound effects + radio in one place)
// ---------------------------------------------------------------------------

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const isPlaying = useRadioStore((s) => s.isPlaying);
  const isLoading = useRadioStore((s) => s.isLoading);
  const currentIndex = useRadioStore((s) => s.stationIndex);
  const loadError = useRadioStore((s) => s.loadError);
  const onToggle = useRadioStore((s) => s.toggle);
  const setStation = useRadioStore((s) => s.setStation);
  const onSelect = (i: number) => setStation(i);

  // SFX mute mirrors the module-level flag in sfx.ts; the initial read keeps
  // it in sync when the sheet remounts.
  const [sfxMuted, setSfxMutedState] = useState(isSfxMuted());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Tapping outside the card closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable swallows taps so they don't hit the backdrop. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Settings</Text>
          </View>

          {/* ── Sound effects ─────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Sound effects</Text>
          <Pressable
            onPress={() => {
              const next = !sfxMuted;
              setSfxMuted(next);
              setSfxMutedState(next);
            }}
            style={styles.sfxRow}
            accessibilityRole="switch"
            accessibilityState={{ checked: !sfxMuted }}
            accessibilityLabel="Game sound effects"
          >
            <Text style={styles.stationEmoji}>{sfxMuted ? '🔇' : '🔊'}</Text>
            <Text style={styles.sfxLabel}>Card & game sounds</Text>
            <Text style={[styles.sfxState, !sfxMuted && styles.sfxStateOn]}>
              {sfxMuted ? 'Off' : 'On'}
            </Text>
          </Pressable>

          {/* ── Radio ─────────────────────────────────────────────────── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Radio</Text>
            <Pressable onPress={onToggle} hitSlop={8} style={styles.playPause}>
              <Text style={styles.playPauseText}>
                {isLoading ? '…' : isPlaying ? '⏸  Pause' : '▶  Play'}
              </Text>
            </Pressable>
          </View>

          {loadError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          )}

          <ScrollView style={styles.list} bounces={false}>
            {STATIONS.map((station, index) => {
              const active = index === currentIndex;
              return (
                <Pressable
                  key={station.id}
                  onPress={() => onSelect(index)}
                  style={[styles.stationRow, active && styles.stationRowActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.stationEmoji}>{station.emoji}</Text>
                  <Text
                    style={[
                      styles.stationRowName,
                      active && styles.stationRowNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {station.name}
                  </Text>
                  {active && (
                    <Text style={styles.activeDot}>
                      {isLoading ? '…' : isPlaying ? '♪' : '❚❚'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const init = useRadioStore((s) => s.init);

  useEffect(() => {
    init();
    // Create SFX players up front so the first sound has no load latency.
    // (Playback itself only ever happens after a user tap, which keeps web
    // autoplay policies happy.)
    preloadSfx();
  }, [init]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.color.feltBgDark },
          headerTintColor: theme.color.textOnDark,
          contentStyle: { backgroundColor: theme.color.feltBg },
          headerRight: () => <SettingsButton />,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Shed' }} />
        <Stack.Screen name="campaign" options={{ title: 'Campaign' }} />
        <Stack.Screen name="setup" options={{ title: 'Players' }} />
        <Stack.Screen name="tutorial" options={{ title: 'Tutorial' }} />
        <Stack.Screen name="swap" options={{ title: 'Swap cards' }} />
        <Stack.Screen name="game" options={{ title: 'Shed', headerBackVisible: false }} />
        <Stack.Screen name="game-over" options={{ title: 'Game over', headerBackVisible: false }} />
        <Stack.Screen name="rules" options={{ title: 'Rules', presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  toggleBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  // Popout
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
    // Push the card down so it reads as a dropdown from the header.
    paddingTop: 90,
    paddingRight: 8,
  },
  card: {
    width: 240,
    maxHeight: 360,
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    paddingVertical: 6,
    // Soft elevation on both platforms.
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  nowPlayingNote: {
    position: 'absolute',
    top: 0,
    right: 0,
    color: '#f4c430',
    fontSize: 11,
  },
  sectionLabel: {
    color: '#9aa5a0',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 6,
  },
  sfxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sfxLabel: {
    color: '#f5f5f5',
    fontSize: 15,
    flex: 1,
    marginLeft: 10,
  },
  sfxState: {
    color: '#9aa5a0',
    fontSize: 13,
    fontWeight: '700',
  },
  sfxStateOn: {
    color: '#f4c430',
  },
  cardTitle: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  playPause: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playPauseText: {
    color: theme.color.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    paddingTop: 4,
  },
  errorBanner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,80,80,0.15)',
  },
  errorText: {
    color: theme.color.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  stationRowActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stationEmoji: {
    fontSize: 18,
    width: 26,
  },
  stationRowName: {
    flex: 1,
    color: theme.color.textOnDark,
    fontSize: 14,
  },
  stationRowNameActive: {
    color: theme.color.accent,
    fontWeight: '700',
  },
  activeDot: {
    color: theme.color.accent,
    fontSize: 13,
    marginLeft: 8,
  },
});
