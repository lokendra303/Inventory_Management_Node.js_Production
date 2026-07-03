import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import StatusPill from '../components/StatusPill';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getBatches, getExpiryAlerts, getSerials } from '../api/warehouseService';
import { colors, spacing } from '../config/theme';

export default function BatchTrackingScreen() {
  const [tab, setTab] = useState('batches');
  const [batches, setBatches] = useState([]);
  const [serials, setSerials] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'batches') {
        const res = await getBatches({ limit: 100 });
        setBatches(Array.isArray(res?.data) ? res.data : []);
      } else if (tab === 'serials') {
        const res = await getSerials({ limit: 100 });
        setSerials(Array.isArray(res?.data) ? res.data : []);
      } else {
        const res = await getExpiryAlerts();
        setAlerts(Array.isArray(res?.data) ? res.data : []);
      }
    } catch (err) {
      setError(apiError(err, 'Failed to load batch data'));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const reload = useFocusLoad(load, [load], 12000);

  useEffect(() => {
    load();
  }, [load]);

  const rows = tab === 'batches' ? batches : tab === 'serials' ? serials : alerts;

  return (
    <AppScreen>
      <GlassHeader title="Batch / serial" subtitle="Lots, serials, and expiry alerts" />
      <View style={styles.tabs}>
        {[
          { id: 'batches', label: 'Batches' },
          { id: 'serials', label: 'Serials' },
          { id: 'alerts', label: 'Expiry' },
        ].map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View>
          <SkeletonTile />
          <SkeletonTile />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => String(item.id || item.batch_id || idx)}
          renderItem={({ item }) => {
            if (tab === 'batches') {
              return (
                <WorkflowTile
                  title={item.batch_number || item.batchNumber}
                  subtitle={item.item_name || item.itemName}
                  meta={`${item.warehouse_name || ''} · qty ${item.quantity_remaining ?? item.quantityRemaining}`}
                  icon="layers-outline"
                  status={item.status === 'active' ? 'ok' : item.status === 'expired' ? 'out' : 'low'}
                  statusLabel={item.status}
                />
              );
            }
            if (tab === 'serials') {
              return (
                <WorkflowTile
                  title={item.serial_number || item.serialNumber}
                  subtitle={item.item_name || item.itemName}
                  meta={item.warehouse_name || item.warehouseName}
                  icon="barcode"
                  status={item.status === 'available' ? 'ok' : 'unknown'}
                  statusLabel={item.status}
                />
              );
            }
            return (
              <View style={styles.alertCard}>
                <Text style={styles.alertTitle}>{item.batch_number || item.batchNumber}</Text>
                <Text style={styles.alertMeta}>{item.item_name || item.itemName}</Text>
                <Text style={styles.alertMeta}>Expires: {item.expiry_date || item.expiryDate || '—'}</Text>
                <StatusPill status="low" label={item.alert_level || item.alertLevel || 'expiry'} />
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>No records</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: '#EEF2FF', borderColor: colors.primary },
  tabText: { fontWeight: '600', color: colors.textMuted, fontSize: 12 },
  tabTextActive: { color: colors.primary },
  error: { color: '#DC2626', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  alertCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  alertTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  alertMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
