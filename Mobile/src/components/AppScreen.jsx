import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../config/theme';

export default function AppScreen({ children, style, edges = ['top', 'left', 'right'] }) {
  return (
    <SafeAreaView edges={edges} style={[styles.safe, style]}>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, paddingHorizontal: spacing.md },
});
