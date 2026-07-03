import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../config/theme';

export default function QuantityStepper({ value, onChange, min = 0, max, step = 1 }) {
  const num = Number(value) || 0;
  const dec = () => onChange(Math.max(min, num - step));
  const inc = () => onChange(max != null ? Math.min(max, num + step) : num + step);

  return (
    <View style={styles.row}>
      <Pressable onPress={dec} style={styles.btn}>
        <MaterialCommunityIcons name="minus" size={20} color={colors.primary} />
      </Pressable>
      <Text style={styles.value}>{num}</Text>
      <Pressable onPress={inc} style={styles.btn}>
        <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  value: { minWidth: 48, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
});
