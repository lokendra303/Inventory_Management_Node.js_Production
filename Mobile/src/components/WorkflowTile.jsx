import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StatusPill from './StatusPill';
import { colors, radius, spacing } from '../config/theme';

export default function WorkflowTile({
  title,
  subtitle,
  meta,
  icon = 'clipboard-list-outline',
  status,
  statusLabel,
  onPress,
  right,
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
        {status ? <View style={styles.pillRow}><StatusPill status={status} label={statusLabel} /></View> : null}
      </View>
      {right || <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />}
    </Pressable>
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
    padding: spacing.md,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  meta: { fontSize: 12, color: colors.primary, marginTop: 4, fontWeight: '600' },
  pillRow: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
