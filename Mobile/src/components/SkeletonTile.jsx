import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing } from '../config/theme';

export default function SkeletonTile() {
  const shimmer = useSharedValue(0.35);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.line, styles.short, animatedStyle]} />
      <Animated.View style={[styles.line, animatedStyle]} />
      <Animated.View style={[styles.line, styles.mid, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  line: { height: 12, borderRadius: 6, backgroundColor: '#E2E8F0', marginBottom: spacing.sm },
  short: { width: '40%' },
  mid: { width: '65%', marginBottom: 0 },
});
