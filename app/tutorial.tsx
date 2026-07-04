import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Center } from '../src/components/Center';
import { CharacterDialogue } from '../src/components/CharacterDialogue';
import { PlayingCard } from '../src/components/PlayingCard';
import { theme } from '../src/components/theme';
import { Card, PlaySource } from '../src/engine/types';
import * as engine from '../src/engine/engine';
import { useGameStore } from '../src/store/gameStore';
import { useTutorialStore } from '../src/store/tutorialStore';
import {
  LESSONS,
  allowedCardIds,
  canPlaySelection,
} from '../src/campaign/tutorial';
import { playSfx } from '../src/audio/sfx';

const CHRIS_PORTRAIT = require('../assets/images/characters/chris-portrait.png');

export default function TutorialScreen() {
  const router = useRouter();
  const resetGame = useGameStore((s) => s.reset);

  const lessonIndex = useTutorialStore((s) => s.lessonIndex);
  const stage = useTutorialStore((s) => s.stage);
  const lineIndex = useTutorialStore((s) => s.lineIndex);
  const game = useTutorialStore((s) => s.game);
  const selectedCardIds = useTutorialStore((s) => s.selectedCardIds);
  const start = useTutorialStore((s) => s.start);
  const tapContinue = useTutorialStore((s) => s.tapContinue);
  const toggleSelect = useTutorialStore((s) => s.toggleSelect);
  const confirmPlay = useTutorialStore((s) => s.confirmPlay);
  const pickup = useTutorialStore((s) => s.pickup);

  // Restart the tutorial fresh whenever the screen mounts.
  useEffect(() => {
    start();
  }, [start]);

  const lesson = LESSONS[lessonIndex];
  const task = lesson.task;
  const action = task?.action;

  const text =
    stage === 'intro'
      ? lesson.intro[lineIndex]
      : stage === 'play'
      ? task?.instruction ?? ''
      : lesson.success[lineIndex] ?? '';

  const isFinalEnd =
    !!lesson.final && stage === 'intro' && lineIndex >= lesson.intro.length - 1;
  const canAdvance = stage !== 'play' && !isFinalEnd;

  const allowed = allowedCardIds(game, lesson);
  const player = game.players[0];
  const activeSource = engine.getPlaySource(player);
  const isPickupStage = stage === 'play' && action === 'pickup';

  const renderRow = (cards: Card[], source: PlaySource, label: string) => {
    if (cards.length === 0) return null;
    return (
      <View style={styles.stackBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.cardRow}>
          {cards.map((card) => {
            const isActive =
              stage === 'play' && action === 'play' && source === activeSource;
            const isAllowed = allowed.has(card.id);
            const selectable = isActive && isAllowed;
            return (
              <PlayingCard
                key={card.id}
                card={card}
                selected={selectedCardIds.includes(card.id)}
                dimmed={isActive && !isAllowed}
                disabled={!selectable}
                onPress={selectable ? () => toggleSelect(card.id) : undefined}
              />
            );
          })}
        </View>
      </View>
    );
  };

  const renderFaceDownRow = () => {
    if (player.faceDown.length === 0) return null;
    return (
      <View style={styles.stackBlock}>
        <Text style={styles.rowLabel}>Face-down (blind)</Text>
        <View style={styles.cardRow}>
          {player.faceDown.map((card) => (
            <PlayingCard key={card.id} faceDown disabled />
          ))}
        </View>
      </View>
    );
  };

  const dialogueFooter = isFinalEnd ? (
    <View>
      <Button
        title="Play a real game"
        compact
        onPress={() => {
          resetGame();
          router.replace('/setup');
        }}
      />
      <View style={styles.finalButtons}>
        <Button
          title="Read the rules"
          variant="ghost"
          compact
          onPress={() => router.push('/rules')}
          style={styles.flexBtn}
        />
        <Button
          title="Menu"
          variant="ghost"
          compact
          onPress={() => router.replace('/')}
          style={styles.flexBtn}
        />
      </View>
    </View>
  ) : undefined;

  return (
    <View style={styles.screen}>
      {/* Progress */}
      <View style={styles.progress}>
        <Text style={styles.progressTitle}>Chris's Tutorial · {lesson.title}</Text>
        <View style={styles.dots}>
          {LESSONS.map((l, i) => (
            <View
              key={l.id}
              style={[
                styles.dot,
                i === lessonIndex && styles.dotActive,
                i < lessonIndex && styles.dotDone,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Board (or celebratory final screen) */}
      <ScrollView contentContainerStyle={styles.board}>
        {lesson.final ? (
          <View style={styles.finalHero}>
            <Image
              source={CHRIS_PORTRAIT}
              style={styles.finalPortrait}
              resizeMode="contain"
            />
            <Text style={styles.finalTitle}>Tutorial complete</Text>
          </View>
        ) : (
          <>
            <Center
              game={game}
              onPickup={isPickupStage ? pickup : undefined}
              isHumanTurn={isPickupStage}
              mustPickup={isPickupStage}
            />

            {renderRow(player.hand, 'hand', 'Your hand')}
            {renderRow(player.faceUp, 'faceUp', 'Face-up')}
            {renderFaceDownRow()}

            {/* Action controls */}
            {stage === 'play' && action === 'play' && (
              <View style={styles.actions}>
                <Button
                  title="Play selected"
                  onPress={() => {
                    playSfx('cardPlace');
                    confirmPlay();
                  }}
                  disabled={!canPlaySelection(selectedCardIds, lesson)}
                />
              </View>
            )}
            {stage === 'play' && action === 'pickup' && (
              <View style={styles.actions}>
                <Button
                  title="Pick up pile"
                  variant="danger"
                  onPress={() => {
                    playSfx('cardPickup');
                    pickup();
                  }}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Chris */}
      <View style={styles.dialogueWrap}>
        <CharacterDialogue
          name="Chris the Scribe"
          text={text}
          portrait={CHRIS_PORTRAIT}
          onAdvance={() => {
            // Page-turn on the tap itself (not an effect watching lineIndex)
            // so the sound stays causal and never fires on mount.
            playSfx('pageTurn');
            tapContinue();
          }}
          canAdvance={canAdvance}
          footer={dialogueFooter}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.feltBg,
  },
  progress: {
    paddingHorizontal: theme.space.lg,
    paddingTop: 10,
    paddingBottom: 6,
  },
  progressTitle: {
    color: theme.color.accent,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: {
    backgroundColor: theme.color.accent,
    transform: [{ scale: 1.25 }],
  },
  dotDone: {
    backgroundColor: 'rgba(244,196,48,0.5)',
  },

  board: {
    paddingHorizontal: theme.space.lg,
    paddingTop: 8,
    paddingBottom: 16,
  },
  stackBlock: {
    marginTop: 14,
  },
  rowLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 16, // room for the selected-card lift
  },
  actions: {
    marginTop: 18,
  },

  // Final screen
  finalHero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  finalPortrait: {
    width: 160,
    height: 160,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.color.accent,
  },
  finalTitle: {
    color: theme.color.textOnDark,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
  },

  // Chris dialogue, pinned to the bottom
  dialogueWrap: {
    paddingHorizontal: theme.space.md,
    paddingBottom: 16,
    paddingTop: 6,
  },
  finalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  flexBtn: {
    flex: 1,
  },
});