import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import { API_URL } from '../config/env';
import { APP_VERSION } from '../config/appVersion';
import { colors, radius, spacing } from '../config/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  return (
    <AppScreen>
      <GlassHeader title="Settings" subtitle="Account & app" />
      <View style={styles.card}>
        <Text style={styles.name}>{user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.meta}>Role: {user?.role || '—'}</Text>
        <Text style={styles.meta}>App version: {APP_VERSION}</Text>
        <Divider style={{ marginVertical: spacing.md }} />
        <Text style={styles.label}>API</Text>
        <Text style={styles.api}>{API_URL}</Text>
      </View>
      <Button mode="outlined" onPress={() => navigation.navigate('SkuRules')} style={styles.btn}>
        SKU rules
      </Button>
      <Button mode="contained" buttonColor={colors.danger} onPress={logout} style={styles.btn}>
        Log out
      </Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, marginTop: 4 },
  label: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  api: { color: colors.text, marginTop: 4, fontSize: 13 },
  btn: { marginBottom: spacing.sm },
});
