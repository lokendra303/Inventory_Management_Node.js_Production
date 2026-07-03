import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { APP_VERSION } from '../config/appVersion';
import { colors, radius, spacing } from '../config/theme';
import { buildVisibleMenu, navigateMenuItem } from './menuConfig';

export default function CustomDrawerContent(props) {
  const { user, logout } = useAuth();
  const sections = buildVisibleMenu(user, APP_VERSION);
  const name = user?.firstName || user?.name || user?.email || 'User';

  const go = (item) => navigateMenuItem(props.navigation, item);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.role}>{user?.role || 'User'} · v{APP_VERSION}</Text>
      </View>

      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={[styles.sectionIcon, { backgroundColor: `${section.accent}22` }]}>
              <MaterialCommunityIcons name={section.icon} size={18} color={section.accent} />
            </View>
            <Text style={styles.sectionLabel}>{section.label}</Text>
          </View>
          {section.items.map((item) => (
            <Pressable
              key={`${section.id}-${item.screen || item.label}`}
              onPress={() => go(item)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <MaterialCommunityIcons name={item.icon || 'circle-small'} size={20} color={colors.primary} />
              <Text style={styles.itemText}>{item.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ))}

      <Pressable onPress={logout} style={styles.logout}>
        <MaterialCommunityIcons name="logout" size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.lg, flexGrow: 1 },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  role: { fontSize: 13, color: colors.textMuted, marginTop: 4, textTransform: 'capitalize' },
  section: { marginBottom: spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  itemPressed: { backgroundColor: '#F1F5F9' },
  itemText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  logout: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logoutText: { marginLeft: spacing.sm, color: '#DC2626', fontWeight: '700', fontSize: 15 },
});
