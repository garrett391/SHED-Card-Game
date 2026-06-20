import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const POWER_CARDS = [
  { rank: '2', tier: 'HIGH', rule: 'Always playable. Resets pile back to a 2.' },
  { rank: '8', tier: 'HIGH', rule: 'Always playable. Invisible — next player plays off card beneath it.' },
  { rank: '7', tier: 'LOW', rule: 'Next card must be 7 or lower (8 still playable on it).' },
  { rank: '10', tier: 'LOW', rule: 'Burns the pile. Same player goes again. Cannot play on a 7.' },
  { rank: '4 of a kind', tier: 'SPECIAL', rule: 'Burns the pile (8s don\'t break the sequence).' },
];

export const HomeScreen: React.FC<Props> = ({ navigation }) => (
  <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>💩 SHED</Text>
    <Text style={styles.subtitle}>Pass-and-Play · 2–6 Players</Text>

    <TouchableOpacity
      style={styles.primaryBtn}
      onPress={() => navigation.navigate('Setup')}
    >
      <Text style={styles.primaryBtnText}>New Game</Text>
    </TouchableOpacity>

    {/* Quick rules reference */}
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Quick Rules</Text>

      <Text style={styles.sectionHeader}>Objective</Text>
      <Text style={styles.body}>
        Be the first to play all your cards through three phases: hand (early),
        face-up (mid), and mystery face-down (late).
      </Text>

      <Text style={styles.sectionHeader}>On Your Turn</Text>
      <Text style={styles.body}>
        Play a card equal to or higher than the top of the pile (Meets or Beats).
        If you can't (or choose not to), pick up the whole pile.
      </Text>

      <Text style={styles.sectionHeader}>Power Cards</Text>
      {POWER_CARDS.map(pc => (
        <View key={pc.rank} style={styles.powerRow}>
          <View style={[styles.tierBadge, pc.tier === 'HIGH' ? styles.tierHigh : pc.tier === 'LOW' ? styles.tierLow : styles.tierSpecial]}>
            <Text style={styles.tierText}>{pc.tier}</Text>
          </View>
          <View style={styles.powerInfo}>
            <Text style={styles.powerRank}>{pc.rank}</Text>
            <Text style={styles.powerRule}>{pc.rule}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionHeader}>Draw Rule</Text>
      <Text style={styles.body}>
        Keep at least 3 cards in hand by drawing from the draw pile after each
        play. Once the draw pile is empty, no more drawing.
      </Text>
    </View>

    <Text style={styles.footer}>Rules as spake by Jake, the Elder 👴</Text>
  </ScrollView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1a4a1a' },
  content: { padding: 20, paddingBottom: 60 },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginTop: 40,
    letterSpacing: 4,
  },
  subtitle: {
    color: '#81c784',
    textAlign: 'center',
    marginBottom: 32,
    fontSize: 15,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: '#f5c518',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 28,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#111',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a4a1a',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2e7d32',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 5,
    gap: 10,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    minWidth: 52,
    alignItems: 'center',
  },
  tierHigh: { backgroundColor: '#1b5e20' },
  tierLow: { backgroundColor: '#e65100' },
  tierSpecial: { backgroundColor: '#4a148c' },
  tierText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  powerInfo: { flex: 1 },
  powerRank: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  powerRule: { fontSize: 13, color: '#555', lineHeight: 18 },
  footer: {
    color: '#81c784',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
