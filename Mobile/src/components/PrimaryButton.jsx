import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../config/theme';

export default function PrimaryButton({ title, onPress, loading, disabled, style }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [styles.press, pressed && !isDisabled && styles.pressed, style]}>
      <LinearGradient
        colors={isDisabled ? ['#94A3B8', '#64748B'] : [colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.btn}
      >
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.label}>{title}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { borderRadius: radius.md, overflow: 'hidden' },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  label: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
