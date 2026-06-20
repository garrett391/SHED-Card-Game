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
          (variant === 'secondary' || variant === 'ghost') && styles.textDark,
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
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.color.textMuted },
  danger: { backgroundColor: theme.color.danger },
  disabled: { opacity: 0.4 },
  text: { color: '#fff', fontWeight: '700', fontSize: 16 },
  textDark: { color: theme.color.secondary },
});
