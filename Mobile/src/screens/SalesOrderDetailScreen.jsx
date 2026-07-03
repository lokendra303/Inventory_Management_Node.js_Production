import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import QuantityStepper from '../components/QuantityStepper';
import { hasPermission } from '../config/permissions';
import {
  apiError, confirmSalesOrder, getSalesOrder, shipSalesOrder,
} from '../api/operationsService';
import { colors, spacing } from '../config/theme';

export default function SalesOrderDetailScreen() {
  const route = useRoute();
  const { user } = useAuth();
  const { soId } = route.params || {};
  const canManage = hasPermission(user, 'sales_management');
  const canShip = hasPermission(user, 'inventory_ship');

  const [so, setSo] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!soId) return;
    setLoading(true);
    try {
      const res = await getSalesOrder(soId);
      const data = res?.data;
      setSo(data);
      setLines(
        (data?.lines || []).map((line) => {
          const ordered = Number(line.quantity_ordered || 0);
          const shipped = Number(line.quantity_shipped || 0);
          const pending = Math.max(ordered - shipped, 0);
          return {
            soLineId: line.id,
            itemName: line.item_name,
            warehouseName: line.warehouse_name,
            pendingQty: pending,
            shipQty: pending,
          };
        }),
      );
    } catch (err) {
      setError(apiError(err, 'Failed to load SO'));
    } finally {
      setLoading(false);
    }
  }, [soId]);

  useEffect(() => { load(); }, [load]);

  const onConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await confirmSalesOrder(soId);
      await load();
    } catch (err) {
      setError(apiError(err, 'Failed to confirm'));
    } finally {
      setSubmitting(false);
    }
  };

  const onShip = async () => {
    const payload = lines
      .filter((l) => Number(l.shipQty) > 0)
      .map((l) => ({ soLineId: l.soLineId, quantity: Number(l.shipQty) }));
    if (!payload.length) {
      setError('Enter ship quantity for at least one line');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await shipSalesOrder(soId, {
        shipmentNumber: `SHIP-${Date.now()}`,
        lines: payload,
      });
      await load();
    } catch (err) {
      setError(apiError(err, 'Failed to ship'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <GlassHeader title="Sales order" subtitle="Loading…" />
      </AppScreen>
    );
  }

  const showShip = canShip && ['confirmed', 'partially_shipped'].includes(so?.status);

  return (
    <AppScreen>
      <ScrollView>
        <GlassHeader title={so?.so_number || 'SO'} subtitle={so?.customer_name} />
        <Text style={styles.meta}>Status: {so?.status}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {lines.map((line) => (
          <View key={line.soLineId} style={styles.line}>
            <Text style={styles.lineTitle}>{line.itemName}</Text>
            <Text style={styles.lineMeta}>{line.warehouseName} · pending {line.pendingQty}</Text>
            {showShip && line.pendingQty > 0 ? (
              <View style={styles.row}>
                <Text style={styles.label}>Ship qty</Text>
                <QuantityStepper
                  value={line.shipQty}
                  min={0}
                  max={line.pendingQty}
                  onChange={(qty) => setLines((prev) => prev.map((l) => (l.soLineId === line.soLineId ? { ...l, shipQty: qty } : l)))}
                />
              </View>
            ) : null}
          </View>
        ))}
        {canManage && so?.status === 'draft' ? (
          <PrimaryButton title="Confirm order" onPress={onConfirm} loading={submitting} />
        ) : null}
        {showShip ? (
          <PrimaryButton title="Ship order" onPress={onShip} loading={submitting} style={{ marginTop: spacing.sm }} />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.textMuted, marginBottom: spacing.sm },
  line: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  lineTitle: { fontWeight: '700', color: colors.text },
  lineMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text },
  error: { color: '#DC2626', marginBottom: spacing.sm },
});
