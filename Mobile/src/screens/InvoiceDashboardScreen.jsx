import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getInvoiceDashboardSummary } from '../api/financeService';
import { navigateMenuItem } from '../navigation/menuConfig';
import { colors, radius, spacing } from '../config/theme';

function KpiCard({ label, value, sub, colors: grad, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.cardPress}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <MaterialCommunityIcons name={icon} size={22} color="#fff" />
        <Text style={styles.cardValue}>{value}</Text>
        <Text style={styles.cardLabel}>{label}</Text>
        {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
      </LinearGradient>
    </Pressable>
  );
}

export default function InvoiceDashboardScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getInvoiceDashboardSummary();
      setData(res?.data || null);
    } catch (err) {
      setData(null);
      setError(apiError(err, 'Failed to load invoice dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 30000);
  useEffect(() => { load(); }, [load]);

  const p = data?.purchase || {};
  const s = data?.sales || {};

  const shortcuts = [
    { label: 'Sales invoices', screen: 'SalesInvoices', icon: 'file-document-outline' },
    { label: 'Purchase invoices', screen: 'PurchaseInvoices', icon: 'file-document-outline' },
    { label: 'Outstanding', screen: 'OutstandingInvoices', icon: 'clock-alert-outline' },
    { label: 'Payments', screen: 'InvoicePayments', icon: 'cash-multiple' },
  ];

  return (
    <AppScreen>
      <GlassHeader title="Invoice dashboard" subtitle="Finance overview" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={undefined}>
          <View style={styles.grid}>
            <KpiCard
              label="Purchase invoices"
              value={String(p.total_invoices ?? 0)}
              sub={p.total_amount != null ? `Amount: ${p.total_amount}` : null}
              colors={['#667eea', '#764ba2']}
              icon="cart-outline"
            />
            <KpiCard
              label="Purchase outstanding"
              value={String(p.outstanding_amount ?? 0)}
              colors={['#f093fb', '#f5576c']}
              icon="clock-outline"
              onPress={() => navigation.navigate('OutstandingInvoices')}
            />
            <KpiCard
              label="Sales invoices"
              value={String(s.total_invoices ?? 0)}
              sub={s.total_amount != null ? `Amount: ${s.total_amount}` : null}
              colors={['#11998e', '#38ef7d']}
              icon="file-document-outline"
            />
            <KpiCard
              label="Sales outstanding"
              value={String(s.outstanding_amount ?? 0)}
              colors={['#f7971e', '#ffd200']}
              icon="currency-usd"
              onPress={() => navigation.navigate('OutstandingInvoices')}
            />
          </View>
          <Text style={styles.sectionTitle}>Quick links</Text>
          {shortcuts.map((item) => (
            <Pressable
              key={item.screen}
              style={styles.linkRow}
              onPress={() => navigateMenuItem(navigation, { route: 'MoreTab', screen: item.screen })}
            >
              <MaterialCommunityIcons name={item.icon} size={22} color={colors.primary} />
              <Text style={styles.linkText}>{item.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  cardPress: { width: '48%' },
  card: { borderRadius: radius.lg, padding: spacing.md, minHeight: 100 },
  cardValue: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 },
  cardLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  cardSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: spacing.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  linkText: { flex: 1, fontSize: 15, color: '#334155', fontWeight: '600' },
});
