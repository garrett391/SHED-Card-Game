import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { theme } from '../src/components/theme';
import { useRadioStore, STATIONS } from '../src/store/radioStore';

// ---------------------------------------------------------------------------
// RadioToggle  (lives in the header of every screen)
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

function RadioToggle() {
  const isPlaying = useRadioStore((s) => s.isPlaying);
  const isLoading = useRadioStore((s) => s.isLoading);
  const stationIndex = useRadioStore((s) => s.stationIndex);
  const loadError = useRadioStore((s) => s.loadError);
  const toggle = useRadioStore((s) => s.toggle);
  const setStation = useRadioStore((s) => s.setStation);

  const [pickerOpen, setPickerOpen] = useState(false);
  const station = STATIONS[stationIndex];
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.headerRow}>
      {/* Emoji tap: mobile = open picker, web = play/pause */}
      <Pressable
        onPress={isWeb ? toggle : () => setPickerOpen(true)}
        hitSlop={isWeb ? 8 : 12}
        style={styles.toggleBtn}
        accessibilityLabel={
          isWeb
            ? isPlaying ? `Pause ${station.name}` : `Play ${station.name}`
            : 'Open radio controls'
        }
        accessibilityRole="button"
      >
        <Text style={{ fontSize: 20, opacity: isPlaying ? 1 : 0.35 }}>
          {station.emoji}
        </Text>
      </Pressable>

      {/* Station name + caret: web only */}
      {isWeb && (
        <Pressable
          onPress={() => setPickerOpen(true)}
          hitSlop={8}
          style={styles.pickerBtn}
          accessibilityLabel="Choose radio station"
          accessibilityRole="button"
        >
          <Text
            style={[styles.stationName, !isPlaying && styles.stationNameDim]}
            numberOfLines={1}
          >
            {station.name}
          </Text>
          <Text style={styles.caret}>▾</Text>
        </Pressable>
      )}

      <StationPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentIndex={stationIndex}
        isPlaying={isPlaying}
        isLoading={isLoading}
        loadError={loadError}
        onSelect={(i) => {
          setStation(i);
          setPickerOpen(false);
        }}
        onToggle={toggle}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// StationPicker  (the popout)
// ---------------------------------------------------------------------------

interface StationPickerProps {
  visible: boolean;
  onClose: () => void;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  loadError: string | null;
  onSelect: (index: number) => void;
  onToggle: () => void;
}

function StationPicker({
  visible,
  onClose,
  currentIndex,
  isPlaying,
  isLoading,
  loadError,
  onSelect,
  onToggle,
}: StationPickerProps) {
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
            <Text style={styles.cardTitle}>Radio</Text>
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
  }, [init]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.color.feltBgDark },
          headerTintColor: theme.color.textOnDark,
          contentStyle: { backgroundColor: theme.color.feltBg },
          headerRight: () => <RadioToggle />,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Shed' }} />
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
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 150,
  },
  stationName: {
    color: theme.color.accent,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120,
  },
  stationNameDim: {
    color: theme.color.textMuted,
  },
  caret: {
    color: theme.color.textMuted,
    fontSize: 12,
    marginLeft: 3,
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
