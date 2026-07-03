import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../config/theme';

const STATUS = {
  ok: { label: 'In stock', colors: ['#10B981', '#059669'] },
  low: { label: 'Low stock', colors: ['#F59E0B', '#D97706'] },
  out: { label: 'Out of stock', colors: ['#EF4444', '#DC2626'] },
  unknown: { label: 'Unknown', colors: ['#94A3B8', '#64748B'] },
};

export function stockStatusFromQty(quantity, reorderLevel) {
  const qty = Number(quantity) || 0;
  const reorder = Number(reorderLevel);
  if (qty <= 0) return 'out';
  if (!Number.isNaN(reorder) && reorder > 0 && qty <= reorder) return 'low';
  return 'ok';
}

export default function StatusPill({ status = 'unknown', label }) {
  const cfg = STATUS[status] || STATUS.unknown;
  return (
    <LinearGradient colors={cfg.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
      <Text style={styles.text}>{label || cfg.label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { color: colors.white, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
