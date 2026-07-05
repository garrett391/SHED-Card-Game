/**
 * Campaign map — a winding vertical path through PRESET_ORDER.
 *
 * Built entirely from Views (no SVG dependency): nodes zigzag left/right,
 * joined by rows of interpolated dots. Three node states:
 *   - completed: full color, gold star badge
 *   - current:   full color, gently pulsing ring ("you are here")
 *   - locked:    dark, 🔒, tagline replaced by an unlock hint
 *
 * The list renders BOTTOM-UP (start at the bottom, like climbing the map in
 * the reference art), so PRESET_ORDER is reversed for display and the
 * ScrollView starts scrolled to the end.
 *
 * Tapping an unlocked node preselects that variant on the setup screen via
 * the `preset` route param. Completed nodes stay playable (replays).
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../src/components/theme';
import { RULE_PRESETS, PRESET_ORDER } from '../src/campaign/presets';
import { MAP_SCENES, DEFAULT_SCENE } from '../src/campaign/mapMeta';
import { isUnlocked, useCampaignStore } from '../src/store/campaignStore';

const NODE_SIZE = 76;
const CONNECTOR_HEIGHT = 52;
const CONNECTOR_DOTS = 7;
/** Horizontal center of a node, as % of row width, for each side. */
const SIDE_CENTER = { left: 25, right: 75 } as const;

type NodeState = 'completed' | 'current' | 'available' | 'locked';

export default function CampaignScreen() {
  const router = useRouter();
  const completed = useCampaignStore((s) => s.completed);
  const scrollRef = useRef<ScrollView>(null);

  // First unlocked-but-not-completed preset is "current".
  const currentId =
    PRESET_ORDER.find((id) => isUnlocked(completed, id) && !completed[id]) ??
    null;
  const doneCount = PRESET_ORDER.filter((id) => completed[id]).length;

  const stateFor = (id: string): NodeState => {
    if (completed[id]) return 'completed';
    if (id === currentId) return 'current';
    // 'available' only occurs with gap-y progress data (unlocked, uncompleted,
    // but not the frontier) — rendered like current minus the pulse/ring.
    return isUnlocked(completed, id) ? 'available' : 'locked';
  };

  // Bottom-up: start of the campaign sits at the bottom of the scroll.
  const displayOrder = [...PRESET_ORDER].reverse();

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {doneCount === PRESET_ORDER.length
          ? '🏆 Campaign complete — long live Jake the Elder'
          : `${doneCount} / ${PRESET_ORDER.length} variants mastered`}
      </Text>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {displayOrder.map((id, i) => {
          // Zigzag by position in the ORIGINAL order so adding presets never
          // reshuffles which side existing nodes sit on.
          const orderIdx = PRESET_ORDER.indexOf(id);
          const side: 'left' | 'right' = orderIdx % 2 === 0 ? 'left' : 'right';
          const nextSide: 'left' | 'right' =
            orderIdx % 2 === 0 ? 'right' : 'left';
          const prevName =
            orderIdx > 0 ? RULE_PRESETS[PRESET_ORDER[orderIdx - 1]].name : null;
          return (
            <View key={id}>
              {/* Connector ABOVE each node except the topmost (last in
                  PRESET_ORDER = first in displayOrder). Drawn from the next
                  node's side down to this node's side. */}
              {i > 0 && <Connector fromSide={nextSide} toSide={side} />}
              <MapNode
                preset={RULE_PRESETS[id]}
                scene={MAP_SCENES[id] ?? DEFAULT_SCENE}
                state={stateFor(id)}
                side={side}
                unlockHint={prevName ? `Beat ${prevName} to unlock` : null}
                isStart={orderIdx === 0}
                onPress={() => router.push({ pathname: '/setup', params: { preset: id } })}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Node ────────────────────────────────────────────────────────────────────

function MapNode({
  preset,
  scene,
  state,
  side,
  unlockHint,
  isStart,
  onPress,
}: {
  preset: (typeof RULE_PRESETS)[string];
  scene: (typeof MAP_SCENES)[string];
  state: NodeState;
  side: 'left' | 'right';
  unlockHint: string | null;
  isStart: boolean;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state !== 'current') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  return (
    <View style={[styles.nodeRow, side === 'right' && styles.nodeRowRight]}>
      <Pressable
        onPress={locked ? undefined : onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={
          locked
            ? `${preset.name}. Locked. ${unlockHint ?? ''}`
            : `${preset.name}. ${state === 'completed' ? 'Completed.' : ''} Tap to play.`
        }
        style={styles.nodePressable}
      >
        <Animated.View
          style={[
            styles.node,
            { transform: [{ scale: state === 'current' ? pulse : 1 }] },
            locked
              ? styles.nodeLocked
              : { backgroundColor: scene.color, borderColor: '#00000033' },
            state === 'current' && styles.nodeCurrent,
          ]}
        >
          <Text style={styles.nodeEmoji}>{locked ? '🔒' : scene.emoji}</Text>
          {state === 'completed' && (
            <View style={styles.starBadge}>
              <Text style={styles.starText}>★</Text>
            </View>
          )}
        </Animated.View>
        <Text style={[styles.nodeLabel, locked && styles.nodeLabelLocked]}>
          {isStart && !locked ? 'START — ' : ''}
          {preset.name}
        </Text>
        <Text style={styles.nodeTagline} numberOfLines={2}>
          {locked ? unlockHint ?? 'Locked' : scene.tagline}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Dotted connector between two zigzag sides ──────────────────────────────

function Connector({
  fromSide,
  toSide,
}: {
  fromSide: 'left' | 'right';
  toSide: 'left' | 'right';
}) {
  const fromX = SIDE_CENTER[fromSide];
  const toX = SIDE_CENTER[toSide];
  return (
    <View style={styles.connector} pointerEvents="none">
      {Array.from({ length: CONNECTOR_DOTS }, (_, i) => {
        const t = (i + 0.5) / CONNECTOR_DOTS;
        const leftPct = fromX + (toX - fromX) * (1 - t); // top = from, bottom = to
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: `${leftPct}%`,
                top: (CONNECTOR_HEIGHT / CONNECTOR_DOTS) * i,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.feltBg,
  },
  progress: {
    color: theme.color.textMuted,
    textAlign: 'center',
    fontSize: 13,
    letterSpacing: 0.5,
    paddingVertical: 10,
    backgroundColor: theme.color.feltBgDark,
  },
  scroll: {
    paddingVertical: 28,
    paddingHorizontal: theme.space.lg,
  },
  nodeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  nodeRowRight: {
    justifyContent: 'flex-end',
  },
  nodePressable: {
    width: '50%',
    alignItems: 'center',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLocked: {
    backgroundColor: '#1c2b26',
    borderColor: '#00000055',
    opacity: 0.8,
  },
  nodeCurrent: {
    borderColor: theme.color.accent,
    shadowColor: theme.color.accent,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  nodeEmoji: {
    fontSize: 30,
  },
  starBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.color.feltBg,
  },
  starText: {
    color: '#3a2c00',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  nodeLabel: {
    color: theme.color.textOnDark,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  nodeLabelLocked: {
    color: theme.color.textMuted,
  },
  nodeTagline: {
    color: theme.color.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 150,
  },
  connector: {
    height: CONNECTOR_HEIGHT,
    marginVertical: 6,
  },
  dot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#f4c43077',
  },
});