import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../config/theme';

export default function GlassHeader({ title, subtitle, right }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  titles: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.textMuted },
  right: { marginLeft: spacing.sm },
});
