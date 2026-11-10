import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bot, ScrollText } from 'lucide-react-native';
import { GameLogModal } from '../src/components/GameLogModal';
import { theme } from '../src/components/theme';
import { useGameHydrated, useGameStore } from '../src/store/gameStore';
import { isUnlocked, useCampaignStore } from '../src/store/campaignStore';
import { RULE_PRESETS, PRESET_ORDER } from '../src/campaign/presets';
import { CINEMATICS, ENDING_ID } from '../src/campaign/story';
import {
  Character,
  characterByName,
  endLine,
  endLinesFor,
  opponentsFor,
} from '../src/campaign/characters';
import { ACHIEVEMENT_BY_ID } from '../src/achievements/achievements';
import { Player } from '../src/engine/types';

const GOLD = theme.color.accent;
const LOSS = '#e2603f'; // readable on the felt, unlike theme danger red
const PANEL = theme.color.feltBgDark;
const LINE = '#2b5a49';

/**
 * Final standings: a headline for the player, everyone ranked by how close
 * they came (winner first, then fewest cards left), the host's parting line
 * on their own row, a few numbers from the game, then what to do next.
 * Works the same for free play, the campaign and last-man-standing tables.
 */
export default function GameOverScreen() {
  const router = useRouter();
  const game = useGameStore((s) => s.game);
  const stats = useGameStore((s) => s.stats);
  const reset = useGameStore((s) => s.reset);
  const campaignPresetId = useGameStore((s) => s.campaignPresetId);
  const earnedThisGame = useGameStore((s) => s.earnedThisGame);
  const completed = useCampaignStore((s) => s.completed);
  const lastUnlockedId = useCampaignStore((s) => s.lastUnlockedId);
  const acknowledgeUnlock = useCampaignStore((s) => s.acknowledgeUnlock);
  const unlockedPreset = lastUnlockedId ? RULE_PRESETS[lastUnlockedId] : null;

  // Post-game review: same 📜 log as the in-game history button.
  const [logOpen, setLogOpen] = useState(false);

  // The campaign host's parting words. Picked once so re-renders don't
  // swap the line mid-read.
  const [hostLine] = useState(() => {
    if (!game || !campaignPresetId) return null;
    const hosts = opponentsFor(campaignPresetId).filter((c) => endLinesFor(c, campaignPresetId));
    if (hosts.length === 0) return null;
    const playerWon =
      game.winnerId !== null && !game.players[game.winnerId].isBot;
    // A host who won gets the last word; otherwise (the player won, or a
    // host without lines did) any host may speak, so every voice gets heard.
    const winnerName = game.winnerId !== null ? game.players[game.winnerId].name : null;
    const host =
      (!playerWon && hosts.find((c) => c.name === winnerName)) ||
      hosts[Math.floor(Math.random() * hosts.length)];
    const text = endLine(host, playerWon, campaignPresetId);
    return text ? { host, text } : null;
  });

  // If state was wiped, bail home — but NOT when we wiped it ourselves on
  // the way out. departTo() resets the game store before navigating, which
  // re-fires this effect with game === null; without the guard its
  // router.replace('/') races (and wins against) the intended destination,
  // sending every button to the main menu.
  const departing = useRef(false);
  const hydrated = useGameHydrated();
  useEffect(() => {
    if (hydrated && !game && !departing.current) router.replace('/');
  }, [hydrated, game, router]);

  if (!game) return null;

  const winner = game.winnerId !== null ? game.players[game.winnerId] : null;
  const cardsLeft = (p: Player) => p.hand.length + p.faceUp.length + p.faceDown.length;

  // Who counts as a "Shithead" depends on the mode:
  //   - first-out-wins (default): everyone who didn't win first is a shithead.
  //   - last-man-standing: only the single last player left holding cards
  //     (players who shed out in the middle finished safely and are spared).
  const isShithead = (p: Player) =>
    game.lastManStanding ? p.id === game.shitheadId : p.id !== game.winnerId;

  // Winner first, then everyone else by how close they came.
  const standings = [...game.players].sort((a, b) => {
    if (a.id === game.winnerId) return -1;
    if (b.id === game.winnerId) return 1;
    return cardsLeft(a) - cardsLeft(b);
  });

  // With exactly one human at the table, the screen talks to them.
  const humans = game.players.filter((p) => !p.isBot);
  const you = humans.length === 1 ? humans[0] : null;
  const shitheads = game.players.filter(isShithead);
  const names = (ps: Player[]) =>
    ps.length <= 1 ? ps.map((p) => p.name).join('')
      : `${ps.slice(0, -1).map((p) => p.name).join(', ')} and ${ps[ps.length - 1].name}`;

  let headline: string;
  let headlineColor: string;
  let subline: string;
  if (you && winner?.id === you.id) {
    headline = 'You win.';
    headlineColor = GOLD;
    subline = shitheads.length === 1
      ? `Out first. ${shitheads[0].name} is the Shithead.`
      : `Out first. ${names(shitheads)} are the Shitheads.`;
  } else if (you && isShithead(you)) {
    headline = "You're the Shithead.";
    headlineColor = LOSS;
    const n = cardsLeft(you);
    subline = `${winner?.name ?? 'Someone'} went out first. You held ${n} card${n === 1 ? '' : 's'}.`;
  } else if (you) {
    headline = 'You got out.';
    headlineColor = theme.color.textOnDark;
    subline = `${names(shitheads)} ${shitheads.length === 1 ? 'is the Shithead' : 'are the Shitheads'}.`;
  } else {
    headline = `${winner?.name ?? 'Nobody'} wins.`;
    headlineColor = GOLD;
    subline = `${names(shitheads)} ${shitheads.length === 1 ? 'is the Shithead' : 'are the Shitheads'}.`;
  }

  // A few numbers from the game: yours with one human, the table's otherwise.
  const mine = (xs: number[] | undefined) =>
    !xs ? 0 : you ? xs[you.id] ?? 0 : xs.reduce((a, b) => a + b, 0);
  const robbing = game.ruleConfig.stickUp || game.players.some((p) => p.rules?.stickUp);
  const tiles = stats
    ? [
        { value: stats.turns ?? 0, label: 'turn' },
        { value: mine(stats.pickups), label: 'pickup' },
        robbing
          ? { value: mine(stats.robbed), label: you ? 'time robbed' : 'robbery' }
          : { value: mine(stats.burns), label: 'burn' },
      ].map((t) => ({ ...t, label: plural(t.value, t.label) }))
    : [];

  // ── Campaign continuation ────────────────────────────────────────────────
  // Only games launched from the campaign map get campaign actions — free
  // play with the same preset keeps the generic Play again / Home.
  //
  // "Continue" targets the node AFTER the one just played, so the campaign
  // reads as a linear march: replaying node 1 continues to node 2 (even if
  // it's already beaten), never teleporting across the map to the frontier.
  // After a win the next node is unlocked by definition; the isUnlocked
  // check is belt-and-braces for exotic states. No next node → campaign end.
  const humanWon = winner !== null && !winner.isBot;
  const nextNodeId = (() => {
    if (!campaignPresetId) return null;
    const idx = PRESET_ORDER.indexOf(campaignPresetId);
    const next = idx >= 0 ? PRESET_ORDER[idx + 1] : undefined;
    return next && isUnlocked(completed, next) ? next : null;
  })();

  /** Leave this screen for `route`, clearing transient state first. */
  const departTo = (route: Parameters<typeof router.replace>[0]) => {
    departing.current = true; // suppress the bail-home effect (see above)
    acknowledgeUnlock();
    reset();
    router.replace(route);
  };

  // Mirrors the map's node onPress: entering the next node plays its
  // cutscene (which flows into setup itself; Skip is always on screen).
  const continueCampaign = () => {
    if (!nextNodeId) return;
    departTo({
      pathname: CINEMATICS[nextNodeId] ? '/cinematic' : '/setup',
      params: { preset: nextNodeId },
    });
  };

  // Won with a node ahead → march on. Lost → rematch this node. Won the
  // final node → the ending, which returns to the map.
  const primary = !campaignPresetId
    ? { title: 'Play again', onPress: () => departTo('/setup') }
    : humanWon && nextNodeId
    ? { title: 'Continue campaign', onPress: continueCampaign }
    : humanWon
    ? { title: 'Continue', onPress: () => departTo({ pathname: '/cinematic', params: { preset: ENDING_ID } }) }
    : { title: 'Try again', onPress: () => departTo({ pathname: '/setup', params: { preset: campaignPresetId } }) };
  const showMap = !!campaignPresetId && (!humanWon || !!nextNodeId);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Text style={styles.tableName}>{game.ruleConfig.name}</Text>
          <Pressable
            onPress={() => setLogOpen(true)}
            hitSlop={8}
            style={styles.logBtn}
            accessibilityLabel="Review game log"
            accessibilityRole="button"
          >
            <ScrollText size={20} color={theme.color.textMuted} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.headline, { color: headlineColor }]}>{headline}</Text>
          <Text style={styles.subline}>{subline}</Text>
        </View>

        <View style={styles.standings}>
          {standings.map((p, i) => (
            <StandingRow
              key={p.id}
              place={i + 1}
              player={p}
              isYou={you?.id === p.id}
              won={p.id === game.winnerId}
              shithead={isShithead(p)}
              cardsLeft={cardsLeft(p)}
              line={hostLine && hostLine.host.name === p.name ? hostLine.text : null}
            />
          ))}
        </View>

        {tiles.length > 0 && (
          <View style={styles.tiles}>
            {tiles.map((t) => (
              <View key={t.label} style={styles.tile}>
                <Text style={styles.tileValue}>{t.value}</Text>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </View>
            ))}
          </View>
        )}

        {earnedThisGame.length > 0 && (
          <Pressable
            style={styles.banner}
            onPress={() => router.push('/achievements')}
            accessibilityRole="button"
            accessibilityLabel={`${earnedThisGame.length} achievements unlocked. View all.`}
          >
            <Text style={styles.bannerLabel}>
              {earnedThisGame.length === 1 ? 'Achievement unlocked' : `${earnedThisGame.length} achievements unlocked`}
            </Text>
            {earnedThisGame.map((id) => (
              <Text key={id} style={styles.bannerItem}>
                {ACHIEVEMENT_BY_ID[id].emoji} {ACHIEVEMENT_BY_ID[id].name}
              </Text>
            ))}
            <Text style={styles.bannerLink}>View all ›</Text>
          </Pressable>
        )}

        {unlockedPreset && (
          <View style={styles.banner}>
            <Text style={styles.bannerLabel}>New table unlocked</Text>
            <Text style={styles.bannerTitle}>{unlockedPreset.name}</Text>
            <Text style={styles.bannerFlavor}>{unlockedPreset.flavorText}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={primary.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{primary.title}</Text>
          </Pressable>
          <View style={styles.secondaryRow}>
            {showMap && (
              <Pressable
                onPress={() => departTo('/campaign')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>Campaign map</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => departTo('/')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Home</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <GameLogModal visible={logOpen} onClose={() => setLogOpen(false)} log={game.log} />
    </View>
  );
}

function StandingRow({
  place,
  player,
  isYou,
  won,
  shithead,
  cardsLeft,
  line,
}: {
  place: number;
  player: Player;
  isYou: boolean;
  won: boolean;
  shithead: boolean;
  cardsLeft: number;
  line: string | null;
}) {
  const character = characterByName(player.name);
  const status = won
    ? 'Out first · Winner'
    : shithead
    ? `Shithead · ${cardsLeft} card${cardsLeft === 1 ? '' : 's'} left`
    : 'Got out';
  return (
    <View style={[styles.row, won && styles.rowWon, isYou && !won && styles.rowYou]}>
      <View style={styles.rowMain}>
        <Text style={[styles.place, won && styles.inkDark, isYou && !won && { color: LOSS }]}>
          {place}
        </Text>
        <Avatar player={player} character={character} won={won} />
        <View style={styles.rowText}>
          <View style={styles.nameRow}>
            <Text style={[styles.rowName, won && styles.inkDark]} numberOfLines={1}>
              {player.name}
              {isYou && <Text style={[styles.you, won && styles.inkDark]}> (you)</Text>}
            </Text>
            {player.isBot && !character && (
              <Bot size={15} color={won ? '#1a1a1a' : theme.color.textMuted} strokeWidth={2.25} />
            )}
          </View>
          <Text
            style={[
              styles.rowStatus,
              won && styles.inkDark,
              shithead && isYou && { color: LOSS, fontWeight: '700' },
            ]}
          >
            {status}
          </Text>
        </View>
        {cardsLeft > 0 && <Fan count={cardsLeft} />}
      </View>
      {line && (
        <View style={[styles.quote, won ? styles.quoteOnGold : styles.quoteOnFelt]}>
          <Text style={[styles.quoteText, !won && { color: theme.color.textOnDark }]}>“{line}”</Text>
        </View>
      )}
    </View>
  );
}

function Avatar({ player, character, won }: { player: Player; character: Character | null; won: boolean }) {
  const size = won ? 44 : 40;
  const frame = [
    styles.avatar,
    { width: size, height: size, borderRadius: size / 2 },
    !player.isBot && styles.avatarHuman,
  ];
  if (character?.portrait) {
    return <Image source={character.portrait} style={frame} resizeMode="cover" />;
  }
  return (
    <View style={frame}>
      <Text style={styles.avatarText}>
        {character?.emoji ?? player.name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** "1 pickup", "3 pickups"; the count is shown separately. */
function plural(n: number, word: string): string {
  if (n === 1) return word;
  if (word === 'robbery') return 'robberies';
  if (word === 'time robbed') return 'times robbed';
  return word + 's';
}

/** The cards a player was stuck with, as a small fan (five at most). */
function Fan({ count }: { count: number }) {
  const shown = Math.min(count, 5);
  return (
    <View style={styles.fan} accessibilityLabel={`${count} cards left`}>
      {Array.from({ length: shown }, (_, i) => (
        <View key={i} style={[styles.fanCard, i > 0 && { marginLeft: -12 }]} />
      ))}
      {count > 5 && <Text style={styles.fanMore}>+{count - 5}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.feltBg },
  // Buttons scroll with everything else, pushed to the bottom when there's
  // room: pinned below a ScrollView they hid the stats on a phone.
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 28, gap: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tableName: {
    color: theme.color.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  logBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: PANEL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { gap: 6 },
  headline: { fontSize: 42, fontWeight: '900', lineHeight: 46, letterSpacing: -0.5 },
  subline: { color: '#c9d2ce', fontSize: 15, lineHeight: 21 },
  standings: { gap: 8 },
  row: { backgroundColor: PANEL, borderRadius: 14, padding: 12, gap: 10 },
  rowWon: { backgroundColor: GOLD },
  rowYou: { borderWidth: 2, borderColor: LOSS, padding: 10 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  place: { width: 20, fontSize: 20, fontWeight: '900', color: theme.color.textMuted },
  inkDark: { color: '#1a1a1a' },
  avatar: {
    backgroundColor: '#7a4a24',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarHuman: { backgroundColor: theme.color.secondary },
  avatarText: { color: '#f1e3c2', fontSize: 18, fontWeight: '800' },
  rowText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowName: { color: theme.color.textOnDark, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  you: { color: theme.color.textMuted, fontWeight: '500' },
  rowStatus: { color: theme.color.textMuted, fontSize: 13 },
  fan: { flexDirection: 'row', alignItems: 'center' },
  fanCard: {
    width: 22,
    height: 32,
    borderRadius: 4,
    backgroundColor: theme.color.cardBg,
    borderWidth: 1,
    borderColor: '#444',
  },
  fanMore: { color: theme.color.textMuted, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  quote: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  quoteOnGold: { backgroundColor: '#fff7d6' },
  quoteOnFelt: { backgroundColor: '#163f32' },
  quoteText: { color: '#1a1a1a', fontSize: 15, lineHeight: 21 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: PANEL, borderRadius: 12, padding: 10, gap: 2 },
  tileValue: { color: theme.color.textOnDark, fontSize: 22, fontWeight: '900' },
  tileLabel: { color: theme.color.textMuted, fontSize: 12, lineHeight: 15 },
  banner: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    padding: 14,
    gap: 3,
  },
  bannerLabel: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bannerItem: { color: theme.color.textOnDark, fontSize: 15 },
  bannerLink: { color: GOLD, fontSize: 13, fontWeight: '700', marginTop: 4 },
  bannerTitle: { color: theme.color.textOnDark, fontSize: 18, fontWeight: '800' },
  bannerFlavor: { color: theme.color.textMuted, fontSize: 14, fontStyle: 'italic' },
  actions: { marginTop: 'auto', paddingTop: 8, gap: 10 },
  primary: {
    height: 54,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#1a1a1a', fontSize: 18, fontWeight: '800' },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: theme.color.textOnDark, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
