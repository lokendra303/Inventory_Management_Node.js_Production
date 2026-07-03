import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../config/theme';

export default function HomeCategorySection({ section, onPressItem, onPressMore }) {
  const extra = section.totalCount > section.items.length
    ? section.totalCount - section.items.length
    : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={[styles.iconOrb, { backgroundColor: `${section.accent}18` }]}>
          <MaterialCommunityIcons name={section.icon} size={20} color={section.accent} />
        </View>
        <Text style={styles.title}>{section.label}</Text>
        {extra > 0 ? (
          <Pressable onPress={onPressMore} hitSlop={8}>
            <Text style={styles.moreLink}>+{extra} more</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.grid}>
        {section.items.map((item) => (
          <Pressable
            key={`${section.id}-${item.screen || item.label}`}
            onPress={() => onPressItem(item)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <MaterialCommunityIcons name={item.icon || 'link'} size={18} color={section.accent} />
            <Text style={styles.chipText} numberOfLines={2}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  iconOrb: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  moreLink: { fontSize: 12, fontWeight: '700', color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  chipPressed: { opacity: 0.9, backgroundColor: '#EEF2FF' },
  chipText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
});
