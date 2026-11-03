import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameLogModal } from '../src/components/GameLogModal';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';
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

/**
 * Colors for the results screen. Felt is the default; a campaign table can
 * dress the screen in its own colors (keyed by preset id, so free play at
 * the same table gets them too), and `poster` swaps the headline for the
 * table's own verdict when one human is playing.
 */
interface Palette {
  bg: string;
  panel: string;
  line: string;
  /** The winner's row and the main button. */
  accent: string;
  /** Text on the accent. */
  accentInk: string;
  /** The losing human's headline and outline. */
  loss: string;
  text: string;
  muted: string;
  quoteOnAccent: string;
  quoteOnPanel: string;
  poster?: 'wanted';
}

const FELT: Palette = {
  bg: theme.color.feltBg,
  panel: theme.color.feltBgDark,
  line: '#2b5a49',
  accent: theme.color.accent,
  accentInk: '#1a1a1a',
  loss: '#e2603f', // readable on the felt, unlike theme danger red
  text: theme.color.textOnDark,
  muted: theme.color.textMuted,
  quoteOnAccent: '#fff7d6',
  quoteOnPanel: '#163f32',
};

// The Outlaw Pass: saddle leather and canyon dust, a wanted poster up top.
const OUTLAW: Palette = {
  bg: '#3a1f12',
  panel: '#2a160c',
  line: '#6b3e22',
  accent: '#d9a441',
  accentInk: '#2a160c',
  loss: '#f08a5d',
  text: '#f1e3c2',
  muted: '#d9b98a',
  quoteOnAccent: '#f6e7c4',
  quoteOnPanel: '#4a2a18',
  poster: 'wanted',
};

const PALETTES: Record<string, Palette> = { 'the-pass': OUTLAW };

const STYLES = new Map<Palette, ReturnType<typeof makeStyles>>();
function stylesFor(P: Palette) {
  let st = STYLES.get(P);
  if (!st) STYLES.set(P, (st = makeStyles(P)));
  return st;
}

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
  useEffect(() => {
    if (!game && !departing.current) router.replace('/');
  }, [game, router]);

  if (!game) return null;
  const P = PALETTES[game.ruleConfig.id] ?? FELT;
  const styles = stylesFor(P);

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
    headlineColor = P.accent;
    subline = shitheads.length === 1
      ? `Out first. ${shitheads[0].name} is the Shithead.`
      : `Out first. ${names(shitheads)} are the Shitheads.`;
  } else if (you && isShithead(you)) {
    headline = "You're the Shithead.";
    headlineColor = P.loss;
    const n = cardsLeft(you);
    subline = `${winner?.name ?? 'Someone'} went out first. You held ${n} card${n === 1 ? '' : 's'}.`;
  } else if (you) {
    headline = 'You got out.';
    headlineColor = P.text;
    subline = `${names(shitheads)} ${shitheads.length === 1 ? 'is the Shithead' : 'are the Shitheads'}.`;
  } else {
    headline = `${winner?.name ?? 'Nobody'} wins.`;
    headlineColor = P.accent;
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
            <Text style={styles.logBtnIcon}>📜</Text>
          </Pressable>
        </View>

        {P.poster === 'wanted' && you && winner ? (
          <WantedPoster
            P={P}
            you={you}
            won={winner.id === you.id}
            winner={winner}
            cardsLeft={cardsLeft(you)}
            robbed={stats?.robbed?.[you.id] ?? 0}
          />
        ) : (
          <View style={styles.hero}>
            <Text style={[styles.headline, { color: headlineColor }]}>{headline}</Text>
            <Text style={styles.subline}>{subline}</Text>
          </View>
        )}

        <View style={styles.standings}>
          {standings.map((p, i) => (
            <StandingRow
              key={p.id}
              P={P}
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
  P,
  place,
  player,
  isYou,
  won,
  shithead,
  cardsLeft,
  line,
}: {
  P: Palette;
  place: number;
  player: Player;
  isYou: boolean;
  won: boolean;
  shithead: boolean;
  cardsLeft: number;
  line: string | null;
}) {
  const styles = stylesFor(P);
  const character = characterByName(player.name);
  const status = won
    ? 'Out first · Winner'
    : shithead
    ? `Shithead · ${cardsLeft} card${cardsLeft === 1 ? '' : 's'} left`
    : 'Got out';
  return (
    <View style={[styles.row, won && styles.rowWon, isYou && !won && styles.rowYou]}>
      <View style={styles.rowMain}>
        <Text style={[styles.place, won && styles.inkDark, isYou && !won && { color: P.loss }]}>
          {place}
        </Text>
        <Avatar P={P} player={player} character={character} won={won} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, won && styles.inkDark]} numberOfLines={1}>
            {player.name}
            {isYou && <Text style={[styles.you, won && styles.inkDark]}> (you)</Text>}
            {player.isBot && !character ? ' 🤖' : ''}
          </Text>
          <Text
            style={[
              styles.rowStatus,
              won && styles.inkDark,
              shithead && isYou && { color: P.loss, fontWeight: '700' },
            ]}
          >
            {status}
          </Text>
        </View>
        {cardsLeft > 0 && <Fan P={P} count={cardsLeft} />}
      </View>
      {line && (
        <View style={[styles.quote, won ? styles.quoteOnGold : styles.quoteOnFelt]}>
          <Text style={[styles.quoteText, !won && { color: P.text }]}>“{line}”</Text>
        </View>
      )}
    </View>
  );
}

function Avatar({
  P,
  player,
  character,
  won,
  size = won ? 44 : 40,
}: {
  P: Palette;
  player: Player;
  character: Character | null;
  won: boolean;
  size?: number;
}) {
  const styles = stylesFor(P);
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
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.42) }]}>
        {character?.emoji ?? initial(player.name)}
      </Text>
    </View>
  );
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

/**
 * The Outlaw Pass's verdict: a wanted poster for the player who lost, or
 * the pass cleared and stamped when they won.
 */
function WantedPoster({
  P,
  you,
  won,
  winner,
  cardsLeft,
  robbed,
}: {
  P: Palette;
  you: Player;
  won: boolean;
  winner: Player;
  cardsLeft: number;
  robbed: number;
}) {
  const styles = stylesFor(P);
  return (
    <View style={[styles.poster, won ? styles.posterTiltWin : styles.posterTiltLoss]}>
      {won ? (
        <>
          <Text style={styles.posterBig}>THE PASS{'\n'}IS CLEAR</Text>
          <Text style={styles.posterKicker}>{you.name} went out first</Text>
          <View style={styles.stamp} accessibilityElementsHidden>
            <Text style={styles.stampText}>CLEARED</Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.posterBig}>WANTED</Text>
          <Text style={styles.posterKicker}>for holding the most cards</Text>
          <View style={styles.posterFrame}>
            <Avatar P={P} player={you} character={characterByName(you.name)} won={false} size={92} />
          </View>
          <Text style={styles.posterName}>{you.name.toUpperCase()}</Text>
          <Text style={styles.posterTitle}>THE SHITHEAD</Text>
          <View style={styles.posterRule}>
            <Text style={styles.posterFact}>
              {cardsLeft} card{cardsLeft === 1 ? '' : 's'} held
            </Text>
            {robbed > 0 && (
              <Text style={styles.posterFact}>
                Robbed {robbed === 1 ? 'once' : robbed === 2 ? 'twice' : `${robbed} times`}
              </Text>
            )}
          </View>
          <Text style={styles.posterNote}>Brought in by {winner.name}, out first.</Text>
        </>
      )}
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
function Fan({ P, count }: { P: Palette; count: number }) {
  const styles = stylesFor(P);
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

function makeStyles(P: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: P.bg },
    // Buttons scroll with everything else, pushed to the bottom when there's
    // room: pinned below a ScrollView they hid the stats on a phone.
    scroll: { flexGrow: 1, padding: 20, paddingBottom: 28, gap: 18 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tableName: {
      color: P.muted,
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
      borderColor: P.line,
      backgroundColor: P.panel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logBtnIcon: { fontSize: 20 },
    hero: { gap: 6 },
    headline: { fontSize: 42, fontWeight: '900', lineHeight: 46, letterSpacing: -0.5 },
    subline: { color: P.text, opacity: 0.85, fontSize: 15, lineHeight: 21 },
    standings: { gap: 8 },
    row: { backgroundColor: P.panel, borderRadius: 14, padding: 12, gap: 10 },
    rowWon: { backgroundColor: P.accent },
    rowYou: { borderWidth: 2, borderColor: P.loss, padding: 10 },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    place: { width: 20, fontSize: 20, fontWeight: '900', color: P.muted },
    inkDark: { color: P.accentInk },
    avatar: {
      backgroundColor: '#7a4a24',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarHuman: { backgroundColor: theme.color.secondary },
    avatarText: { color: '#f1e3c2', fontSize: 18, fontWeight: '800' },
    rowText: { flex: 1, gap: 2 },
    rowName: { color: P.text, fontSize: 16, fontWeight: '800' },
    you: { color: P.muted, fontWeight: '500' },
    rowStatus: { color: P.muted, fontSize: 13 },
    fan: { flexDirection: 'row', alignItems: 'center' },
    fanCard: {
      width: 22,
      height: 32,
      borderRadius: 4,
      backgroundColor: theme.color.cardBg,
      borderWidth: 1,
      borderColor: '#444',
    },
    fanMore: { color: P.muted, fontSize: 12, fontWeight: '700', marginLeft: 4 },
    quote: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    quoteOnGold: { backgroundColor: P.quoteOnAccent },
    quoteOnFelt: { backgroundColor: P.quoteOnPanel },
    quoteText: { color: '#1a1a1a', fontSize: 15, lineHeight: 21 },
    tiles: { flexDirection: 'row', gap: 8 },
    tile: { flex: 1, backgroundColor: P.panel, borderRadius: 12, padding: 10, gap: 2 },
    tileValue: { color: P.text, fontSize: 22, fontWeight: '900' },
    tileLabel: { color: P.muted, fontSize: 12, lineHeight: 15 },
    banner: {
      backgroundColor: P.panel,
      borderWidth: 1,
      borderColor: P.accent,
      borderRadius: 12,
      padding: 14,
      gap: 3,
    },
    bannerLabel: {
      color: P.accent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    bannerItem: { color: P.text, fontSize: 15 },
    bannerLink: { color: P.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
    bannerTitle: { color: P.text, fontSize: 18, fontWeight: '800' },
    bannerFlavor: { color: P.muted, fontSize: 14, fontStyle: 'italic' },
    actions: { marginTop: 'auto', paddingTop: 8, gap: 10 },
    primary: {
      height: 54,
      borderRadius: 14,
      backgroundColor: P.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: P.accentInk, fontSize: 18, fontWeight: '800' },
    secondaryRow: { flexDirection: 'row', gap: 10 },
    secondary: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: P.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { color: P.text, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.75 },
    poster: {
      backgroundColor: '#f1e3c2',
      borderRadius: 6,
      paddingVertical: 20,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    posterTiltLoss: { transform: [{ rotate: '-1.2deg' }] },
    posterTiltWin: { transform: [{ rotate: '1deg' }] },
    posterBig: {
      fontFamily: theme.font.western,
      fontSize: 52,
      lineHeight: 56,
      color: '#3b2a1a',
      textAlign: 'center',
    },
    posterKicker: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2.4,
      textTransform: 'uppercase',
      color: '#7a4a24',
      textAlign: 'center',
    },
    posterFrame: {
      width: 128,
      height: 128,
      borderWidth: 4,
      borderColor: '#3b2a1a',
      backgroundColor: '#e3cfa3',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 4,
    },
    posterName: { fontFamily: theme.font.western, fontSize: 32, color: '#3b2a1a', textAlign: 'center' },
    posterTitle: { fontFamily: theme.font.western, fontSize: 18, color: '#8a2e1b' },
    posterRule: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderTopWidth: 2,
      borderBottomWidth: 2,
      borderColor: '#3b2a1a',
      paddingVertical: 7,
      marginTop: 2,
    },
    posterFact: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: '#3b2a1a',
    },
    posterNote: { fontSize: 13, color: '#5c4630', textAlign: 'center' },
    stamp: {
      marginTop: 6,
      borderWidth: 3,
      borderColor: '#8a2e1b',
      borderRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 3,
      transform: [{ rotate: '-8deg' }],
    },
    stampText: { fontFamily: theme.font.western, fontSize: 22, color: '#8a2e1b' },
  });
}

