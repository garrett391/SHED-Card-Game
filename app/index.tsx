/**
 * Home: you're sat at a table, cards in hand, and the menu is laid over
 * it. The scene behind is a campaign place (src/campaign/homeScenes.ts):
 * it moves on with the campaign, or stays on one you've pinned in Settings.
 *
 * Campaign and Free play are the two big choices; Records, Achievements
 * (Feats, to fit a tile), Tutorial and Rules sit in a row beneath. A game
 * in progress goes on top as Resume.
 */
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Constants from 'expo-constants';
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Map as MapIcon,
  Play,
  ScrollText,
  Spade,
  Trophy,
} from 'lucide-react-native';
import { theme } from '../src/components/theme';
import { useGameStore } from '../src/store/gameStore';
import { useCampaignStore } from '../src/store/campaignStore';
import { useProfileStore } from '../src/store/profileStore';
import { HomeScene, homeScene } from '../src/campaign/homeScenes';
import { restoreTable } from '../src/campaign/lastTable';
import { PRESET_ORDER, RULE_PRESETS } from '../src/campaign/presets';

const CREAM = '#f6e7c1';
const INK = '#20140a';
/** How far the art fades into the scene's dark above the menu. */
const FADE = 150;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // A game left unfinished (or cut off by a refresh) waits here. Dealing a
  // new one replaces it, so the other buttons leave it alone until then.
  const saved = useGameStore((s) => s.game);
  const savedTurn = saved && saved.phase === 'playing'
    ? saved.players[saved.currentPlayerIndex]
    : null;
  const completed = useCampaignStore((s) => s.completed);
  const pinned = useProfileStore((s) => s.homeScene);
  const lastTable = useProfileStore((s) => s.lastTable);
  const scene = homeScene(completed, pinned);
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';

  const done = PRESET_ORDER.filter((id) => completed[id]).length;
  const campaignNote =
    done === 0
      ? 'The road begins at Jake\'s table'
      : done === PRESET_ORDER.length
      ? `All ${done} tables restored`
      : `${done} of ${PRESET_ORDER.length} tables restored`;
  const last = restoreTable(lastTable, completed);
  const freePlayNote = last
    ? `${RULE_PRESETS[last.modeId].name} · ${last.players.length} at the table`
    : 'Any table, any company';

  return (
    <View style={[styles.screen, { backgroundColor: scene.base }]}>
      {/* A phone-wide column, so a desktop browser shows the same picture
          instead of a sliver of it stretched across the window. */}
      <View style={styles.column}>
        <Image
          source={scene.image}
          // Explicit size: on web a bundled image otherwise takes its own
          // pixel size and ignores the fill.
          style={[StyleSheet.absoluteFill, styles.art]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <Fade id="top" color={scene.base} stops={[[0, 0.88], [0.6, 0.6], [1, 0]]} style={styles.topFade} />

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.hero, { paddingTop: insets.top + 52 }]}>
            <Text style={[styles.title, { textShadowColor: scene.accent }]}>SHED</Text>
            <Text style={[styles.subtitle, { color: scene.accent }]}>
              The card game as spake by Jake
            </Text>
          </View>

          <View>
            <Fade id="menu" color={scene.base} stops={[[0, 0], [0.7, 0.85], [1, 1]]} style={styles.menuFade} />
            <View style={[styles.menu, { backgroundColor: scene.base }]}>
              {saved && (
                <BigButton
                  scene={scene}
                  primary
                  icon={<Play size={24} color={INK} fill={INK} strokeWidth={2} />}
                  title={saved.phase === 'gameOver' ? 'See results' : 'Resume game'}
                  note={`${saved.ruleConfig.name} · ${saved.players.length} players${
                    savedTurn ? ` · ${savedTurn.name}'s turn` : ''
                  }`}
                  onPress={() => router.push(saved.phase === 'swap' ? '/swap' : '/game')}
                />
              )}
              <BigButton
                scene={scene}
                primary={!saved}
                western
                icon={<MapIcon size={26} color={saved ? scene.accent : INK} strokeWidth={2} />}
                title="Campaign"
                note={campaignNote}
                onPress={() => router.push('/campaign')}
              />
              <BigButton
                scene={scene}
                icon={<Spade size={26} color={scene.accent} fill={scene.accent} strokeWidth={2} />}
                title="Free play"
                note={freePlayNote}
                onPress={() => router.push('/setup')}
              />

              <View style={styles.tiles}>
                <Tile scene={scene} label="Records" onPress={() => router.push('/records')}>
                  <ScrollText size={22} color={scene.accent} strokeWidth={2} />
                </Tile>
                <Tile
                  scene={scene}
                  label="Feats"
                  accessibilityLabel="Achievements"
                  onPress={() => router.push('/achievements')}
                >
                  <Trophy size={22} color={scene.accent} strokeWidth={2} />
                </Tile>
                <Tile scene={scene} label="Tutorial" onPress={() => router.push('/tutorial')}>
                  <GraduationCap size={22} color={scene.accent} strokeWidth={2} />
                </Tile>
                <Tile scene={scene} label="Rules" onPress={() => router.push('/rules')}>
                  <BookOpen size={22} color={scene.accent} strokeWidth={2} />
                </Tile>
              </View>

              <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
                <Text style={styles.footerText}>Long live Jake the Elder.</Text>
                <Text style={styles.version}>v{appVersion}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * A strip of `color` over the art, its opacity set by `stops` (offset,
 * opacity) from top to bottom. `id` must differ between strips: gradient
 * ids are shared by the whole page on web.
 */
function Fade({
  id,
  color,
  stops,
  style,
}: {
  id: string;
  color: string;
  stops: [offset: number, opacity: number][];
  style: object;
}) {
  return (
    <View style={style} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`home-fade-${id}`} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#home-fade-${id})`} />
      </Svg>
    </View>
  );
}

function BigButton({
  scene,
  primary,
  western,
  icon,
  title,
  note,
  onPress,
}: {
  scene: HomeScene;
  primary?: boolean;
  /** The title in the Western face (Campaign). */
  western?: boolean;
  icon: ReactNode;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${note}`}
      style={({ pressed }) => [
        styles.big,
        primary
          ? { backgroundColor: scene.accent, height: 74 }
          : { backgroundColor: scene.panel, borderWidth: 1.5, borderColor: scene.line },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <View style={styles.bigText}>
        <Text
          style={[
            styles.bigTitle,
            western && styles.bigTitleWestern,
            { color: primary ? INK : CREAM },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[styles.bigNote, { color: primary ? '#4a3210' : '#d9c7a3' }]}
          numberOfLines={1}
        >
          {note}
        </Text>
      </View>
      <ChevronRight size={22} color={primary ? INK : scene.accent} strokeWidth={2.5} />
    </Pressable>
  );
}

function Tile({
  scene,
  label,
  accessibilityLabel,
  onPress,
  children,
}: {
  scene: HomeScene;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: scene.panel, borderColor: scene.line },
        pressed && styles.pressed,
      ]}
    >
      {children}
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
  art: { width: '100%', height: '100%' },
  // Keeps the title and the settings cog readable over bright art.
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  // Fills the screen when there's room (the menu sits at the bottom, the
  // art shows between); scrolls on short screens.
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  hero: { alignItems: 'center', paddingBottom: 150 },
  title: {
    color: CREAM,
    fontFamily: theme.font.western,
    fontSize: 80,
    lineHeight: 92,
    letterSpacing: 4,
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: {
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '500',
    textShadowColor: '#000',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  menuFade: { position: 'absolute', top: -FADE, left: 0, right: 0, height: FADE },
  menu: { paddingHorizontal: 20, gap: 12 },
  big: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 64,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  bigText: { flex: 1, gap: 1 },
  bigTitle: { fontSize: 18, fontWeight: '800' },
  bigTitleWestern: { fontFamily: theme.font.western, fontWeight: '400', fontSize: 23 },
  bigNote: { fontSize: 13, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 2 },
  tile: {
    flex: 1,
    height: 74,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tileLabel: { color: CREAM, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  footer: { alignItems: 'center', paddingTop: 8, gap: 2 },
  footerText: { color: '#b8a98a', fontSize: 12 },
  version: { color: '#9a8c70', fontSize: 10 },
});
