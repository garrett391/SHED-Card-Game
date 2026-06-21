import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { theme } from './theme';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
  style,
  compact,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.normal,
        styles[variant],
        disabled && styles.disabled,
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'secondary' && styles.textSecondary,
          variant === 'ghost' && styles.textGhost,
          variant === 'danger' && styles.textDanger,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  normal: { paddingVertical: 14, paddingHorizontal: 22 },
  compact: { paddingVertical: 8, paddingHorizontal: 14 },
  primary: { backgroundColor: theme.color.primary },
  secondary: { backgroundColor: '#ecf0f1' },
  // Ghost variant: Transparent background with a clean, low-opacity white border 
  // so it clearly framing the button without distracting from primary actions.
  ghost: { 
    backgroundColor: 'transparent', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.25)' 
  },
  danger: { backgroundColor: theme.color.danger },
  disabled: { opacity: 0.4 },
  
  // Text Styles
  text: { color: '#fff', fontWeight: '700', fontSize: 16 },
  textSecondary: { color: theme.color.secondary },
  // Crisp, bright off-white text for high readability on dark green felt
  textGhost: { color: '#E0E6ED', fontWeight: '600' }, 
  // Bold white text to make sure the red "Pick up Pile" danger block pops perfectly
  textDanger: { color: '#ffffff', fontWeight: '700' },
});
