import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { isUnlocked, useCampaignStore } from '../src/store/campaignStore';
import { characterByName, opponentsFor } from '../src/campaign/characters';
import { playSfx } from '../src/audio/sfx';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const DEFAULT_NAMES = ['Player 1', 'Jake', 'Erich', 'Bauer', 'Cousin', 'Elder'];

// ─── Mode picker card ───────────────────────────────────────────────────────────

function ModeCard({
  preset,
  selected,
  locked,
  unlockHint,
  onPress,
}: {
  preset: RuleConfig;
  selected: boolean;
  locked: boolean;
  unlockHint: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      disabled={locked}
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={
        locked ? `${preset.name}. Locked. ${unlockHint ?? ''}` : undefined
      }
      style={[
        styles.modeCard,
        selected && styles.modeCardSelected,
        locked && styles.modeCardLocked,
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
            locked && styles.modeNameLocked,
          ]}
          numberOfLines={1}
        >
          {locked ? `🔒 ${preset.name}` : preset.name}
        </Text>
      </View>
      {/* Locked variants keep their description hidden — discovering each
          rule twist is part of the campaign's reveal. */}
      <Text style={styles.modeDesc}>
        {locked ? unlockHint ?? 'Locked' : preset.description}
      </Text>
      {selected && !locked && (
        <Text style={styles.modeFlavor}>"{preset.flavorText}"</Text>
      )}
    </Pressable>
  );
}

// ─── Setup screen ───────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);

  const completed = useCampaignStore((s) => s.completed);
  // Preselect a variant when arriving from the campaign map. Guarded by the
  // unlock check so a stale/hand-typed param can't bypass the ladder.
  // When set, the screen is in CAMPAIGN mode: variant and roster are fixed
  // (you face the node's host at the node's table — no editing the story).
  const { preset: presetParam } = useLocalSearchParams<{ preset?: string }>();
  const campaignPreset =
    presetParam && RULE_PRESETS[presetParam] && isUnlocked(completed, presetParam)
      ? presetParam
      : null;
  const [selectedMode, setSelectedMode] = useState<string>(
    () => campaignPreset ?? 'jake-classic',
  );
  // Mode picker starts collapsed so the Players section and Deal button sit
  // above the fold. The collapsed header shows the current selection; tapping
  // it expands the full list, and choosing a mode snaps it shut again.
  const [modeExpanded, setModeExpanded] = useState(false);
  // Campaign nodes seed their named hosts as the bot lineup (the Chaos
  // Twins are a two-bot table). Free play keeps the generic default. The
  // lineup stays fully editable either way.
  const [players, setPlayers] = useState<PlayerConfig[]>(() => {
    const cast = campaignPreset ? opponentsFor(campaignPreset) : [];
    if (cast.length > 0) {
      return [
        { name: 'Player 1', isBot: false },
        ...cast.map((c) => ({ name: c.name, isBot: true })),
      ];
    }
    return [
      { name: 'Player 1', isBot: false },
      { name: 'Bot 1', isBot: true },
      { name: 'Bot 2', isBot: true },
    ];
  });

  // ── Scroll-down affordance ──────────────────────────────────────────────
  // The mode picker can fill the whole viewport on mobile, hiding the Players
  // section and "Deal cards" button below the fold. We surface a floating cue
  // that fades in while there's more content below and out once you reach the
  // bottom. Tapping it scrolls down.
  const scrollRef = useRef<ScrollView>(null);
  const cueOpacity = useRef(new Animated.Value(0)).current;
  const viewportH = useRef(0);
  const contentH = useRef(0);
  const offsetY = useRef(0);

  const updateCue = () => {
    const remaining = contentH.current - (offsetY.current + viewportH.current);
    const shouldShow = remaining > 24; // a little slack so it hides at the end
    Animated.timing(cueOpacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    updateCue();
  };

  const setName = (idx: number, name: string) =>
    setPlayers((ps) => ps.map((p, i) => (i === idx ? { ...p, name } : p)));

  // Lowest "Bot N" name not already taken, so toggling players back and
  // forth never produces duplicate bot names.
  const nextBotName = (ps: PlayerConfig[]) => {
    const taken = new Set(ps.map((p) => p.name));
    let n = 1;
    while (taken.has(`Bot ${n}`)) n++;
    return `Bot ${n}`;
  };

  const toggleBot = (idx: number) =>
    setPlayers((ps) =>
      ps.map((p, i) =>
        i === idx
          ? {
              ...p,
              isBot: !p.isBot,
              name: !p.isBot
                ? nextBotName(ps)
                : DEFAULT_NAMES[idx] ?? `Player ${idx + 1}`,
            }
          : p,
      ),
    );

  const addPlayer = () => {
    if (players.length >= MAX_PLAYERS) return;
    setPlayers([...players, { name: nextBotName(players), isBot: true }]);
  };

  const removePlayer = (idx: number) => {
    if (players.length <= MIN_PLAYERS) return;
    setPlayers(players.filter((_, i) => i !== idx));
  };

  const start = () => {
    const preset = RULE_PRESETS[selectedMode] ?? RULE_PRESETS['jake-classic'];
    playSfx('shuffle'); // the deal — fired on the tap itself
    // campaignPreset threads through to game-over, which uses it to offer
    // "Continue campaign" / "Try again" instead of the free-play actions.
    startGame(players, preset, campaignPreset);
    router.replace('/swap');
  };

  const selectedPreset =
    RULE_PRESETS[selectedMode] ?? RULE_PRESETS['jake-classic'];

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
          updateCue();
        }}
        onContentSizeChange={(_w, h) => {
          contentH.current = h;
          updateCue();
        }}
      >
        {/* ── Game mode: fixed banner in campaign, picker in free play ── */}
        {campaignPreset ? (
          <View style={styles.campaignBanner}>
            <Text style={styles.campaignLabel}>⚔️ CAMPAIGN</Text>
            <Text style={styles.campaignName}>{selectedPreset.name}</Text>
            <Text style={styles.modeDesc}>{selectedPreset.description}</Text>
          </View>
        ) : (
        <Pressable
          onPress={() => setModeExpanded((e) => !e)}
          style={styles.modeSectionHeader}
          accessibilityRole="button"
          accessibilityLabel={
            modeExpanded
              ? 'Collapse game mode list'
              : `Game mode: ${selectedPreset.name}. Tap to change.`
          }
        >
          <Text style={styles.sectionLabel}>Game mode</Text>
          <Text style={styles.modeChevron}>{modeExpanded ? '⌄' : '›'}</Text>
        </Pressable>
        )}

        {/* Picker and its collapsed summary exist only in free play — in
            campaign the banner above is the whole story (the variant is
            fixed; offering "Change" would contradict it). */}
        {!campaignPreset && (modeExpanded ? (
          PRESET_ORDER.map((id, i) => {
            // Free play offers only variants you've BEATEN — the campaign
            // frontier is unlocked for the campaign, but stays exclusive to
            // it until conquered. Jake's Classic is always open.
            const locked = i > 0 && !completed[id];
            return (
              <ModeCard
                key={id}
                preset={RULE_PRESETS[id]}
                selected={selectedMode === id}
                locked={locked}
                unlockHint={'Beat this table in the campaign to unlock'}
                onPress={() => {
                  setSelectedMode(id);
                  setModeExpanded(false);
                }}
              />
            );
          })
        ) : (
          <Pressable
            onPress={() => setModeExpanded(true)}
            style={[styles.modeCard, styles.modeCardSelected, styles.modeSummary]}
          >
            <View style={styles.modeSummaryBody}>
              <Text style={[styles.modeName, styles.modeNameSelected]} numberOfLines={1}>
                {selectedPreset.name}
              </Text>
              <Text style={[styles.modeDesc, styles.modeSummaryDesc]} numberOfLines={2}>
                {selectedPreset.description}
              </Text>
            </View>
            <Text style={styles.modeChange}>Change</Text>
          </Pressable>
        ))}

        {/* ── Player config ───────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Players</Text>
        {/* The hint describes free-play editing (toggle/add/remove) — in
            campaign the roster is fixed, so the instruction would be false. */}
        {!campaignPreset && (
          <Text style={styles.intro}>
            2–6 players. Tap a row to toggle human / bot.
          </Text>
        )}

        {players.map((p, i) => {
          // Campaign characters show their portrait/emoji instead of the
          // generic robot. Matched by name, so renaming the row reverts it
          // to a plain bot (and typing an exact character name summons them).
          const character = p.isBot ? characterByName(p.name) : null;
          return (
          <View key={i} style={styles.row}>
            <Pressable
              style={[styles.botToggle, p.isBot && styles.botToggleActive]}
              onPress={campaignPreset ? undefined : () => toggleBot(i)}
              disabled={!!campaignPreset}
            >
              {character?.portrait ? (
                <Image source={character.portrait} style={styles.botPortrait} />
              ) : (
                <Text style={styles.botEmoji}>
                  {p.isBot ? character?.emoji ?? '🤖' : '🧑'}
                </Text>
              )}
              <Text style={styles.botLabel}>{p.isBot ? 'Bot' : 'Human'}</Text>
            </Pressable>
            <TextInput
              value={p.name}
              onChangeText={(t) => setName(i, t)}
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={theme.color.textMuted}
              maxLength={16}
              // In campaign, the host's name is canon (and the portrait
              // lookup is by name) — humans can still name themselves.
              editable={!campaignPreset || !p.isBot}
            />
            {!campaignPreset && players.length > MIN_PLAYERS && (
              <Pressable onPress={() => removePlayer(i)} style={styles.removeBtn}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            )}
          </View>
          );
        })}

        {!campaignPreset && players.length < MAX_PLAYERS && (
          <Button title="+ Add player" variant="ghost" onPress={addPlayer} />
        )}

        <View style={styles.footer}>
          <Button title="Deal cards" onPress={start} />
        </View>
      </ScrollView>

      {/* Floating scroll-down cue — only visible while content sits below the fold */}
      <Animated.View
        style={[styles.scrollCue, { opacity: cueOpacity }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() =>
            scrollRef.current?.scrollTo({
              y: offsetY.current + viewportH.current * 0.8,
              animated: true,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Scroll down for players and deal"
          style={styles.scrollCuePill}
          hitSlop={8}
        >
          <Text style={styles.scrollCueText}>More below</Text>
          <Text style={styles.scrollCueChevron}>⌄</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: theme.space.lg, paddingBottom: 40 },

  // Floating scroll-down cue
  scrollCue: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: 'center',
  },
  scrollCuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,42,32,0.95)',
    borderColor: '#d4a843',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  scrollCueText: {
    color: '#f0d78c',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollCueChevron: {
    color: '#f0d78c',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: -2,
  },

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

  // Collapsible mode section
  modeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  campaignBanner: {
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.4)',
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 8,
  },
  campaignLabel: {
    color: theme.color.accent,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 4,
  },
  campaignName: {
    color: theme.color.textOnDark,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeChevron: {
    color: theme.color.textOnDark,
    fontSize: 20,
    fontWeight: '700',
    opacity: 0.6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  modeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeSummaryBody: {
    flex: 1,
  },
  modeSummaryDesc: {
    marginLeft: 0,
  },
  modeChange: {
    color: '#d4a843',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  modeCardLocked: {
    opacity: 0.55,
  },
  modeNameLocked: {
    color: theme.color.textMuted,
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
  botPortrait: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
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
