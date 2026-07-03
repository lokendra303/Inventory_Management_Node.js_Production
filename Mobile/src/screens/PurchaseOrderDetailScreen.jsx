import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import { hasPermission } from '../config/permissions';
import { apiError, confirmPurchaseOrder, getPurchaseOrder } from '../api/operationsService';
import { colors, spacing } from '../config/theme';

export default function PurchaseOrderDetailScreen() {
  const route = useRoute();
  const { user } = useAuth();
  const { poId } = route.params || {};
  const canConfirm = hasPermission(user, 'purchase_management');

  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const res = await getPurchaseOrder(poId);
      setPo(res?.data);
    } catch (err) {
      setError(apiError(err, 'Failed to load PO'));
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => { load(); }, [load]);

  const onConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await confirmPurchaseOrder(poId);
      await load();
    } catch (err) {
      setError(apiError(err, 'Failed to confirm PO'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <GlassHeader title="Purchase order" subtitle="Loading…" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView>
        <GlassHeader title={po?.po_number || 'PO'} subtitle={po?.vendor_name} />
        <Text style={styles.meta}>Status: {po?.status}</Text>
        <Text style={styles.meta}>Order date: {po?.order_date || '—'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {(po?.lines || []).map((line) => (
          <View key={line.id} style={styles.line}>
            <Text style={styles.lineTitle}>{line.item_name}</Text>
            <Text style={styles.lineMeta}>
              Qty {line.quantity_ordered} · received {line.quantity_received || 0} · {line.warehouse_name}
            </Text>
          </View>
        ))}
        {canConfirm && po?.status === 'sent' ? (
          <PrimaryButton title="Confirm PO" onPress={onConfirm} loading={submitting} />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.textMuted, marginBottom: 4 },
  line: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  lineTitle: { fontWeight: '700', color: colors.text },
  lineMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  error: { color: '#DC2626', marginVertical: spacing.sm },
});
