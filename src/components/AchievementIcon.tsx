/**
 * The line icon for each achievement, in place of emoji: the same icon
 * family as the rest of the app, and one that can be drawn in gold when
 * earned or greyed when locked.
 */
import {
  Bomb,
  Clover,
  EyeOff,
  FireExtinguisher,
  Flame,
  LucideIcon,
  Medal,
  Radiation,
  Repeat2,
  ScrollText,
  ShieldCheck,
  Spade,
  Sword,
  Swords,
} from 'lucide-react-native';
import { AchievementId } from '../achievements/achievements';

const ICONS: Record<AchievementId, LucideIcon> = {
  'uno-reverse': Repeat2,
  'big-bomb': Bomb,
  'tactical-nuke': Radiation,
  'ninja-warrior': EyeOff, // four 8s, the invisible card
  'bomb-technician': FireExtinguisher,
  'novice-duelist': Sword,
  'master-duelist': Swords,
  'lucky-sob': Clover,
  'cracking-aces': Spade,
  'hat-trick': Medal,
  unshedable: Flame,
  keeper: ScrollText,
  'without-a-scratch': ShieldCheck,
};

export function AchievementIcon({
  id,
  size = 24,
  color,
}: {
  id: AchievementId;
  size?: number;
  color: string;
}) {
  const Icon = ICONS[id];
  return <Icon size={size} color={color} strokeWidth={2} />;
}
