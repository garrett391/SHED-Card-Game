import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../src/components/Button';
import { theme } from '../src/components/theme';
import { Bot, Lock, Plus, Swords } from 'lucide-react-native';
import { useGameStore } from '../src/store/gameStore';
import { PlayerConfig, RuleConfig } from '../src/engine/types';
import { RULE_PRESETS, PRESET_ORDER } from '../src/campaign/presets';
import { isUnlocked, useCampaignStore } from '../src/store/campaignStore';
import {
  Character,
  characterByName,
  opponentsFor,
} from '../src/campaign/characters';
import { emptySeats, SeatSlot, seatsFor } from '../src/table/seatLayout';
import { playSfx } from '../src/audio/sfx';
import { DEFAULT_PLAYER_NAME, useProfileStore } from '../src/store/profileStore';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  restoreTable,
  toSavedTable,
} from '../src/campaign/lastTable';


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
          {preset.name}
        </Text>
        {locked && <Lock size={14} color={theme.color.textMuted} strokeWidth={2.25} />}
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
  // The name you last played under, remembered on this device.
  const savedName = useProfileStore((s) => s.playerName);
  const setPlayerName = useProfileStore((s) => s.setPlayerName);

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
  // Free play opens on the table you last dealt (variant and seats), if
  // there is one; the campaign always seats the node's own cast.
  const [lastTable] = useState(() =>
    campaignPreset ? null : restoreTable(useProfileStore.getState().lastTable, completed),
  );
  const [selectedMode, setSelectedMode] = useState<string>(
    () => campaignPreset ?? lastTable?.modeId ?? 'jake-classic',
  );
  // The table picker (free play): a sheet over the screen, opened from the
  // table card's "Change".
  const [modeExpanded, setModeExpanded] = useState(false);
  // The seat being edited (its place in the lineup), or null.
  const [editing, setEditing] = useState<number | null>(null);
  // Campaign nodes seed their named hosts as the bot lineup (the Chaos
  // Twins are a two-bot table), each with their own play style. Free play
  // keeps the generic default. The lineup stays fully editable either way.
  const [players, setPlayers] = useState<PlayerConfig[]>(() => {
    const cast = campaignPreset ? opponentsFor(campaignPreset) : [];
    if (cast.length > 0) {
      return [
        { name: savedName, isBot: false },
        ...cast.map((c) => ({ name: c.name, isBot: true, botStyle: c.botStyle })),
      ];
    }
    if (lastTable) return lastTable.players;
    return [
      { name: savedName, isBot: false },
      { name: 'Bot 1', isBot: true },
      { name: 'Bot 2', isBot: true },
    ];
  });

  // Opened before the profile had loaded from the device (a refresh on
  // this screen): bring the last table in when it arrives.
  useEffect(() => {
    if (campaignPreset || useProfileStore.persist.hasHydrated()) return;
    return useProfileStore.persist.onFinishHydration((profile) => {
      const table = restoreTable(profile.lastTable, useCampaignStore.getState().completed);
      if (!table) return;
      setSelectedMode(table.modeId);
      setPlayers(table.players);
    });
  }, [campaignPreset]);

  // The profile loads from storage asynchronously, so on a cold start the
  // first render may still see the default. Once the saved name arrives,
  // fill it in, unless the seat was already renamed by hand.
  useEffect(() => {
    if (savedName === DEFAULT_PLAYER_NAME) return;
    setPlayers((ps) =>
      ps.map((p, i) =>
        i === 0 && !p.isBot && p.name === DEFAULT_PLAYER_NAME ? { ...p, name: savedName } : p,
      ),
    );
  }, [savedName]);

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
                : idx === 0
                ? savedName
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
    setEditing(null);
  };

  /** Seat the table's cast when a seat-rules table is picked (the Outlaw
   *  Pass, the Council): the rules ride on the characters. Keeps as many
   *  humans as fit beside them. */
  const pickMode = (id: string) => {
    setSelectedMode(id);
    setModeExpanded(false);
    if (!RULE_PRESETS[id].seatRules) return;
    const cast = opponentsFor(id);
    setPlayers((ps) => [
      ...ps.filter((p) => !p.isBot).slice(0, MAX_PLAYERS - cast.length),
      ...cast.map((c) => ({ name: c.name, isBot: true, botStyle: c.botStyle })),
    ]);
  };

  const start = () => {
    const preset = RULE_PRESETS[selectedMode] ?? RULE_PRESETS['jake-classic'];
    playSfx('shuffle'); // the deal — fired on the tap itself
    // Remember the first human's name for next time; a blank name falls
    // back to the saved one rather than dealing in a nameless player.
    const lineup = players.map((p, i) => {
      if (!p.isBot && !p.name.trim()) return { ...p, name: i === 0 ? savedName : `Player ${i + 1}` };
      // Seat-rules tables (the Council): each host brings their own table's
      // rules, matched by name like portraits are.
      const home = p.isBot && preset.seatRules ? characterByName(p.name)?.homeTable : undefined;
      return home && RULE_PRESETS[home] ? { ...p, rules: RULE_PRESETS[home] } : p;
    });
    const firstHuman = lineup.find((p) => !p.isBot);
    if (firstHuman) setPlayerName(firstHuman.name);
    // Free play remembers this table for next time (names as dealt).
    if (!campaignPreset) {
      useProfileStore.getState().setLastTable(toSavedTable(preset.id, lineup));
    }
    // campaignPreset threads through to game-over, which uses it to offer
    // "Continue campaign" / "Try again" instead of the free-play actions.
    startGame(lineup, preset, campaignPreset);
    router.replace('/swap');
  };

  const selectedPreset =
    RULE_PRESETS[selectedMode] ?? RULE_PRESETS['jake-classic'];

  const seats = seatsFor(players.length);
  // The table shrinks to fit a short screen (a phone browser with its
  // bars showing), so your own seat isn't left under the Deal button.
  const { height: windowH } = useWindowDimensions();
  // Five or six need the table's full length for two seats down each
  // side; fewer can sit round a shorter one. The campaign banner is
  // taller than free play's table card.
  // (Free play always shows all six places, the empty ones as plus signs.)
  const bothSides = !campaignPreset || players.length >= 5;
  const minH = bothSides ? TABLE_MIN_H : TABLE_MIN_H_FEW;
  const chromeH = TABLE_CHROME_H + (campaignPreset ? 40 : 0);
  const tableH = Math.max(minH, Math.min(TABLE_H, windowH - chromeH));
  const slotStyle = slotStyles(tableH, bothSides);
  const humans = players.filter((p) => !p.isBot).length;
  const tableNumber = campaignPreset ? PRESET_ORDER.indexOf(campaignPreset) + 1 : 0;
  const room = MAX_PLAYERS - players.length;
  const edited = editing !== null ? players[editing] : undefined;

  return (
    <View style={styles.screen}>
      {/* "Free play" names the screen. In the campaign the banner below
          says where you are, so the header stays empty. */}
      <Stack.Screen options={{ title: campaignPreset ? '' : 'Free play' }} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* ── The table: a fixed banner in the campaign, a picker in free play ── */}
        {campaignPreset ? (
          <View style={styles.tableCard}>
            <View style={styles.campaignLabelRow}>
              <Swords size={13} color={theme.color.accent} strokeWidth={2.25} />
              <Text style={styles.campaignLabel}>
                CAMPAIGN · TABLE {tableNumber} OF {PRESET_ORDER.length}
              </Text>
            </View>
            <Text style={[styles.tableName, styles.tableNameCampaign]}>{selectedPreset.name}</Text>
            <Text style={styles.tableDesc}>{selectedPreset.description}</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => setModeExpanded(true)}
            style={({ pressed }) => [styles.tableCard, styles.tableCardRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Table: ${selectedPreset.name}. Tap to change.`}
          >
            <View style={styles.tableCardBody}>
              <Text style={styles.tableName} numberOfLines={1}>{selectedPreset.name}</Text>
              <Text style={styles.tableDesc} numberOfLines={2}>{selectedPreset.description}</Text>
            </View>
            <Text style={styles.tableChange}>Change</Text>
          </Pressable>
        )}

        {/* ── The table from above, everyone in their seat ─────────────── */}
        <View style={[styles.table, { height: tableH }]}>
          <View style={styles.oval} />
          <View style={styles.centre} pointerEvents="none">
            <Text style={styles.centreCount}>{players.length}</Text>
            <Text style={styles.centreLabel}>at the table</Text>
            {!campaignPreset && (
              <Text style={styles.centreNote}>
                {room === 0 ? 'Full table' : `room for ${room} more`}
              </Text>
            )}
          </View>

          {players.map((p, i) => {
            // Campaign characters show their portrait. Matched by name, so
            // renaming a bot reverts it to a plain one (and typing an exact
            // character name summons them).
            const character = p.isBot ? characterByName(p.name) : null;
            // Hosts are canon in the campaign; your own seat is yours to name.
            const canEdit = !campaignPreset || !p.isBot;
            // At the Council each host brings the rules of their own table,
            // so their seat says which. Elsewhere a name is enough.
            const home = character?.homeTable;
            const note =
              campaignPreset && selectedPreset.seatRules && home && RULE_PRESETS[home]
                ? RULE_PRESETS[home].name
                : null;
            return (
              <Seat
                key={i}
                position={slotStyle[seats[i]]}
                player={p}
                character={character}
                note={note}
                you={i === 0 && !p.isBot}
                youLabel={!p.isBot && humans === 1}
                onPress={canEdit ? () => setEditing(i) : undefined}
              />
            );
          })}
          {!campaignPreset &&
            emptySeats(players.length).map((slot) => (
              <Pressable
                key={slot}
                onPress={addPlayer}
                style={({ pressed }) => [styles.seat, slotStyle[slot], pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Empty seat. Tap to add a player."
              >
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Plus size={24} color={theme.color.textMuted} strokeWidth={2.25} />
                </View>
                <Text style={styles.seatEmptyLabel}>Empty</Text>
              </Pressable>
            ))}
        </View>

        <Text style={styles.hint}>
          {campaignPreset
            ? 'Tap your seat to change your name.'
            : 'Tap a seat to change who sits there.'}
        </Text>
      </ScrollView>

      {/* Docked under the table, so dealing never needs a scroll. */}
      <View style={styles.footer}>
        <Button title="Deal cards" onPress={start} />
      </View>

      {/* ── Table picker (free play) ─────────────────────────────────── */}
      <Modal
        visible={modeExpanded}
        transparent
        animationType="fade"
        onRequestClose={() => setModeExpanded(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModeExpanded(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Choose a table</Text>
            <ScrollView bounces={false} contentContainerStyle={styles.sheetList}>
              {PRESET_ORDER.map((id, i) => (
                // Free play offers only variants you've BEATEN — the campaign
                // frontier is unlocked for the campaign, but stays exclusive
                // to it until conquered. Jake's Classic is always open.
                <ModeCard
                  key={id}
                  preset={RULE_PRESETS[id]}
                  selected={selectedMode === id}
                  locked={i > 0 && !completed[id]}
                  unlockHint={'Beat this table in the campaign to unlock'}
                  onPress={() => pickMode(id)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Seat editor ──────────────────────────────────────────────── */}
      <Modal
        visible={!!edited}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        {/* Near the top, so a phone keyboard doesn't cover it. */}
        <Pressable style={[styles.backdrop, styles.backdropTop]} onPress={() => setEditing(null)}>
          {edited && editing !== null && (
            <Pressable style={[styles.sheet, styles.seatSheet]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>
                {campaignPreset ? 'Your name' : `Seat ${editing + 1}`}
              </Text>
              <TextInput
                value={edited.name}
                onChangeText={(t) => setName(editing, t)}
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={theme.color.textMuted}
                maxLength={16}
                accessibilityLabel="Name"
                onSubmitEditing={() => setEditing(null)}
                returnKeyType="done"
              />
              {!campaignPreset && (
                <View style={styles.segment}>
                  {[false, true].map((bot) => {
                    const on = edited.isBot === bot;
                    return (
                      <Pressable
                        key={String(bot)}
                        onPress={on ? undefined : () => toggleBot(editing)}
                        style={[styles.segmentHalf, on && styles.segmentHalfOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                          {bot ? 'Bot' : 'Human'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <View style={styles.sheetActions}>
                {!campaignPreset && players.length > MIN_PLAYERS && (
                  <Button
                    title="Remove"
                    variant="ghost"
                    onPress={() => removePlayer(editing)}
                    style={styles.sheetAction}
                  />
                )}
                <Button title="Done" onPress={() => setEditing(null)} style={styles.sheetAction} />
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── A seat at the table ────────────────────────────────────────────────────────

function Seat({
  position,
  player,
  character,
  note,
  you,
  youLabel,
  onPress,
}: {
  /** Where the seat goes in the table area (see slotStyles). */
  position: object;
  player: PlayerConfig;
  character: Character | null;
  /** A line under a host's name: the table whose rules they play by. */
  note: string | null;
  /** The first seat, when a person sits in it: drawn larger, ringed in gold. */
  you: boolean;
  /** Say "(you)": only when there's a single human to mean. */
  youLabel: boolean;
  /** Omitted for seats that can't be changed (campaign hosts). */
  onPress?: () => void;
}) {
  const size = you ? 72 : 64;
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.seat, position, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${player.name || 'Player'}, ${player.isBot ? 'bot' : 'human'}${
        onPress ? '. Tap to change.' : ''
      }`}
    >
      {character?.portrait ? (
        <Image source={character.portrait} style={[styles.avatar, round, styles.avatarHost]} />
      ) : (
        <View
          style={[
            styles.avatar,
            round,
            player.isBot ? styles.avatarBot : styles.avatarHuman,
            you && styles.avatarYou,
          ]}
        >
          {character ? (
            <Text style={styles.avatarEmoji}>{character.emoji}</Text>
          ) : player.isBot ? (
            <Bot size={28} color="#f1e3c2" strokeWidth={2} />
          ) : (
            <Text style={styles.avatarInitial}>
              {(player.name.trim().charAt(0) || '?').toUpperCase()}
            </Text>
          )}
        </View>
      )}
      <Text style={styles.seatName} numberOfLines={2}>
        {player.name || 'Player'}
        {youLabel && <Text style={styles.seatYou}> (you)</Text>}
      </Text>
      {note && <Text style={styles.seatNote} numberOfLines={1}>{note}</Text>}
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

/** The table area: seats sit round an oval, anchored by their top edge. */
const TABLE_H = 520;
/** As small as it goes before the side seats would run into each other. */
const TABLE_MIN_H = 420;
/** With four or fewer there's one seat a side, so it can go shorter. */
const TABLE_MIN_H_FEW = 360;
/** Everything else on the screen: header, table card, hint and Deal. */
const TABLE_CHROME_H = 290;
/** The oval sits below the top seat and above yours. */
const OVAL_TOP = 104;
const OVAL_BOTTOM = 110;
const SEAT_W = 100;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: theme.space.lg, paddingBottom: theme.space.sm },
  pressed: { opacity: 0.75 },

  // Docked action bar.
  footer: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    backgroundColor: theme.color.feltBg,
  },

  // The table card (free play) and campaign banner.
  tableCard: {
    backgroundColor: theme.color.feltBgDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
  },
  tableCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tableCardBody: { flex: 1, gap: 3 },
  tableName: { color: theme.color.accent, fontFamily: theme.font.western, fontSize: 20 },
  tableNameCampaign: { color: theme.color.textOnDark, fontSize: 22 },
  tableDesc: { color: '#c9d2ce', fontSize: 13, lineHeight: 18 },
  tableChange: { color: theme.color.accent, fontSize: 13, fontWeight: '700' },
  campaignLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  campaignLabel: {
    color: theme.color.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // The table from above.
  table: {
    height: TABLE_H,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: 18,
  },
  oval: {
    position: 'absolute',
    top: OVAL_TOP,
    bottom: OVAL_BOTTOM,
    left: '25%',
    right: '25%',
    borderRadius: 999,
    backgroundColor: '#17604a',
    borderWidth: 12,
    borderColor: '#5a3a1c',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  centre: {
    position: 'absolute',
    top: OVAL_TOP,
    bottom: OVAL_BOTTOM,
    left: '31%',
    right: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centreCount: {
    color: theme.color.textOnDark,
    fontFamily: theme.font.western,
    fontSize: 34,
    lineHeight: 40,
  },
  centreLabel: { color: '#d5e0db', fontSize: 13, fontWeight: '600' },
  centreNote: {
    color: '#b9c6c0',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },

  seat: { position: 'absolute', width: SEAT_W, alignItems: 'center', gap: 4 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarHost: { borderWidth: 2, borderColor: '#7a4a24' },
  avatarBot: { backgroundColor: '#7a4a24' },
  avatarHuman: { backgroundColor: theme.color.secondary },
  avatarYou: { borderWidth: 3, borderColor: theme.color.accent },
  avatarEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#5f8576',
    backgroundColor: 'rgba(10,42,32,0.6)',
  },
  avatarEmoji: { fontSize: 28 },
  avatarInitial: { color: '#f1e3c2', fontSize: 26, fontWeight: '800' },
  seatName: {
    color: theme.color.textOnDark,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  seatYou: { color: theme.color.textMuted, fontWeight: '500' },
  seatNote: { color: '#c9d2ce', fontSize: 11, lineHeight: 14, textAlign: 'center' },
  seatEmptyLabel: { color: theme.color.textMuted, fontSize: 13, fontWeight: '600' },
  hint: { color: theme.color.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6 },

  // Sheets: the table picker and the seat editor.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.space.lg,
  },
  backdropTop: { justifyContent: 'flex-start', paddingTop: 110 },
  sheet: {
    maxHeight: '80%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: theme.color.feltBg,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  seatSheet: { paddingHorizontal: 16, gap: 12 },
  sheetTitle: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sheetList: { paddingHorizontal: 12, paddingBottom: 4 },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetAction: { flex: 1 },
  input: {
    color: theme.color.textOnDark,
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#4d6d61',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    padding: 4,
  },
  segmentHalf: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentHalfOn: { backgroundColor: theme.color.accent },
  segmentText: { color: '#c9d2ce', fontSize: 15, fontWeight: '600' },
  segmentTextOn: { color: '#1a1a1a', fontWeight: '800' },

  // Table picker cards.
  modeCard: {
    backgroundColor: theme.color.feltBgDark,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardSelected: { borderColor: theme.color.accent },
  modeCardLocked: { opacity: 0.55 },
  modeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  modeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRadioSelected: { borderColor: theme.color.accent },
  modeRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  modeName: { flex: 1, color: theme.color.textOnDark, fontSize: 16, fontWeight: '700' },
  modeNameSelected: { color: theme.color.accent },
  modeNameLocked: { color: theme.color.textMuted },
  modeDesc: { color: theme.color.textMuted, fontSize: 13, lineHeight: 18 },
  modeFlavor: { color: theme.color.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 6 },
});

/**
 * Where each place sits in a table area `tableH` tall (seats anchor by
 * their top). With one seat a side it sits beside the oval's middle;
 * with two (`bothSides`) they start higher and keep a full seat's height
 * apart, so a two-line name and a note never run into the seat below.
 */
function slotStyles(tableH: number, bothSides: boolean): Record<SeatSlot, object> {
  const ovalH = tableH - OVAL_TOP - OVAL_BOTTOM;
  const upper = bothSides ? OVAL_TOP - 30 : OVAL_TOP + ovalH * 0.1;
  const lower = upper + Math.max(124, ovalH * 0.56);
  return {
    top: { top: 0, left: '50%', marginLeft: -SEAT_W / 2 },
    // Nudged out past the screen's padding so names clear the table's rim.
    upperLeft: { top: upper, left: -10 },
    lowerLeft: { top: lower, left: -10 },
    upperRight: { top: upper, right: -10 },
    lowerRight: { top: lower, right: -10 },
    bottom: { bottom: 0, left: '50%', marginLeft: -SEAT_W / 2 },
  };
}
