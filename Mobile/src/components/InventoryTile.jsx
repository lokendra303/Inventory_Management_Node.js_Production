import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import StatusPill, { stockStatusFromQty } from './StatusPill';
import { colors, radius, spacing } from '../config/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function InventoryTile({ title, subtitle, sku, quantity, reorderLevel, icon = 'package-variant', onPress }) {
  const scale = useSharedValue(1);
  const status = stockStatusFromQty(quantity, reorderLevel);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 16, stiffness: 280 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }); }}
      style={[styles.card, animStyle]}
    >
      <LinearGradient colors={[colors.primary, colors.accent]} style={styles.accent} />
      <View style={styles.orb}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {sku ? <Text style={styles.sku}>{sku}</Text> : null}
        <View style={styles.footer}>
          {quantity != null ? <Text style={styles.qty}>Qty {quantity}</Text> : null}
          <StatusPill status={status} />
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingRight: spacing.sm,
  },
  accent: { width: 5, alignSelf: 'stretch' },
  orb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  body: { flex: 1, paddingVertical: spacing.md },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sku: { fontSize: 12, color: colors.primary, marginTop: 4, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingRight: spacing.sm },
  qty: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
