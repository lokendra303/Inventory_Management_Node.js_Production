import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import HomeCategorySection from '../components/HomeCategorySection';
import useFocusLoad from '../hooks/useFocusLoad';
import { APP_VERSION } from '../config/appVersion';
import { hasPermission } from '../config/permissions';
import { buildHomeSections, navigateMenuItem } from '../navigation/menuConfig';
import {
  getDashboardStats,
  getExpiryAlerts,
  getPendingPutaways,
  getStockCounts,
} from '../api/warehouseService';
import { colors, radius, spacing } from '../config/theme';

function StatBentoCard({ title, value, icon, colors: grad, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.bentoPress}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bento}>
        <View style={styles.bentoIcon}>
          <MaterialCommunityIcons name={icon} size={22} color={colors.white} />
        </View>
        <Text style={styles.bentoValue}>{value}</Text>
        <Text style={styles.bentoTitle}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const EMPTY_STATS = {
  items: '—',
  lowStock: '—',
  onHand: '—',
  pendingPutaway: '—',
  openCounts: '—',
  expiryAlerts: '—',
};

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [stats, setStats] = useState(EMPTY_STATS);
  const statsCacheRef = useRef({ at: 0, data: EMPTY_STATS });

  const categories = useMemo(() => buildHomeSections(user, APP_VERSION, 4), [user]);

  const loadStats = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - statsCacheRef.current.at < 30000) {
      setStats(statsCacheRef.current.data);
      return;
    }

    try {
      const tasks = [getDashboardStats().catch(() => null)];
      if (hasPermission(user, 'inventory_receive')) tasks.push(getPendingPutaways().catch(() => null));
      else tasks.push(Promise.resolve(null));
      if (hasPermission(user, 'inventory_adjust')) tasks.push(getStockCounts().catch(() => null));
      else tasks.push(Promise.resolve(null));
      if (hasPermission(user, 'inventory_view')) tasks.push(getExpiryAlerts().catch(() => null));
      else tasks.push(Promise.resolve(null));

      const [dashRes, putawayRes, countsRes, alertsRes] = await Promise.all(tasks);
      const dash = dashRes?.data || dashRes || {};
      const putaways = Array.isArray(putawayRes?.data) ? putawayRes.data : [];
      const counts = Array.isArray(countsRes?.data) ? countsRes.data : [];
      const openCounts = counts.filter((c) => ['draft', 'in_progress', 'pending_approval'].includes(c.status));
      const alerts = Array.isArray(alertsRes?.data) ? alertsRes.data : [];

      const next = {
        items: String(dash.activeItems ?? dash.totalItems ?? '—'),
        lowStock: String(dash.lowStockCount ?? '—'),
        onHand: String(dash.totalQuantity ?? '—'),
        pendingPutaway: String(putaways.length),
        openCounts: String(openCounts.length),
        expiryAlerts: String(alerts.length),
      };
      statsCacheRef.current = { at: Date.now(), data: next };
      setStats(next);
    } catch {
      setStats(statsCacheRef.current.data);
    }
  }, [user]);

  useFocusLoad(loadStats, [loadStats], 30000);

  const name = user?.firstName || user?.name || user?.email || 'User';

  const goItem = (item) => navigateMenuItem(navigation, item);
  const openMenu = () => navigation.navigate('MoreTab');

  return (
    <AppScreen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <GlassHeader title={`Welcome, ${name}`} subtitle={`Dashboard · v${APP_VERSION}`} />

        <Text style={styles.blockLabel}>Overview</Text>
        <View style={styles.grid}>
          <StatBentoCard title="Active items" value={stats.items} icon="cube-outline" colors={['#1B4DFF', '#3B82F6']} onPress={() => navigation.navigate('ItemsTab')} />
          <StatBentoCard title="Low stock" value={stats.lowStock} icon="alert-outline" colors={['#F59E0B', '#F97316']} onPress={() => navigateMenuItem(navigation, { route: 'InventoryTab', screen: 'InventoryMain' })} />
          <StatBentoCard title="On hand" value={stats.onHand} icon="warehouse" colors={['#00C2A8', '#14B8A6']} onPress={() => navigateMenuItem(navigation, { route: 'InventoryTab', screen: 'InventoryMain' })} />
          <StatBentoCard title="Scan" value="Go" icon="barcode-scan" colors={['#6366F1', '#8B5CF6']} onPress={() => navigation.navigate('ScanTab')} />
          {hasPermission(user, 'inventory_receive') ? (
            <StatBentoCard title="Putaway queue" value={stats.pendingPutaway} icon="archive-arrow-down-outline" colors={['#0EA5E9', '#0284C7']} onPress={() => navigateMenuItem(navigation, { route: 'InventoryTab', screen: 'Putaways' })} />
          ) : null}
          {hasPermission(user, 'inventory_adjust') ? (
            <StatBentoCard title="Open counts" value={stats.openCounts} icon="clipboard-check-outline" colors={['#8B5CF6', '#7C3AED']} onPress={() => navigateMenuItem(navigation, { route: 'InventoryTab', screen: 'StockCounts' })} />
          ) : null}
          {hasPermission(user, 'inventory_view') ? (
            <StatBentoCard title="Expiry alerts" value={stats.expiryAlerts} icon="calendar-alert" colors={['#EF4444', '#DC2626']} onPress={() => navigateMenuItem(navigation, { route: 'InventoryTab', screen: 'BatchTracking' })} />
          ) : null}
        </View>

        <View style={styles.modulesHead}>
          <Text style={styles.blockLabel}>Modules</Text>
          <Pressable onPress={openMenu} style={styles.menuBtn}>
            <MaterialCommunityIcons name="menu" size={18} color={colors.primary} />
            <Text style={styles.menuBtnText}>Full menu</Text>
          </Pressable>
        </View>

        {categories.map((section) => (
          <HomeCategorySection
            key={section.id}
            section={section}
            onPressItem={goItem}
            onPressMore={openMenu}
          />
        ))}

        <Text style={styles.hint}>Use the Inventory tab for stock lists, or More → for the complete menu.</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  blockLabel: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  bentoPress: { width: '48%', flexGrow: 1 },
  bento: { borderRadius: radius.lg, padding: spacing.md, minHeight: 100 },
  bentoIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  bentoValue: { color: colors.white, fontSize: 24, fontWeight: '800' },
  bentoTitle: { color: '#E2E8F0', marginTop: 4, fontWeight: '600', fontSize: 13 },
  modulesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  menuBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  menuBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
});
