import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import QuantityStepper from '../components/QuantityStepper';
import { apiError, createGrn, getPurchaseOrder } from '../api/warehouseService';
import { colors, spacing } from '../config/theme';

export default function GrnReceiveScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { poId, poNumber } = route.params || {};

  const [po, setPo] = useState(null);
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getPurchaseOrder(poId);
      const data = res?.data;
      setPo(data);
      const pending = (data?.lines || []).filter(
        (line) => (Number(line.quantity_ordered) - Number(line.quantity_received || 0)) > 0,
      );
      setLines(
        pending.map((line) => {
          const pendingQty = Number(line.quantity_ordered) - Number(line.quantity_received || 0);
          return {
            poLineId: line.id,
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            itemName: line.item_name,
            warehouseName: line.warehouse_name,
            pendingQty,
            quantityReceived: pendingQty,
            unitCost: Number(line.unit_cost) || 0,
            qualityStatus: 'accepted',
          };
        }),
      );
    } catch (err) {
      setError(apiError(err, 'Failed to load PO'));
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => { load(); }, [load]);

  const updateLine = (index, patch) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const onSubmit = async () => {
    const toSubmit = lines.filter((line) => Number(line.quantityReceived) > 0);
    if (!toSubmit.length) {
      setError('Enter quantity for at least one line');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createGrn({
        grnNumber: `GRN-${Date.now()}`,
        poId,
        receiptDate: new Date().toISOString().split('T')[0],
        notes: notes.trim() || undefined,
        lines: toSubmit.map((line) => ({
          poLineId: line.poLineId,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          quantityReceived: Number(line.quantityReceived),
          unitCost: Number(line.unitCost),
          qualityStatus: line.qualityStatus,
        })),
      });
      navigation.goBack();
    } catch (err) {
      setError(apiError(err, 'Failed to create GRN'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <GlassHeader title="Receive" subtitle={poNumber || 'Loading…'} />
        <Text>Loading PO lines…</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <GlassHeader
          title={po?.po_number || poNumber || 'Receive'}
          subtitle={po?.vendor_name || 'Confirm quantities to receive'}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!lines.length ? (
          <Text style={styles.muted}>All lines on this PO are already received.</Text>
        ) : (
          lines.map((line, index) => (
            <View key={line.poLineId} style={styles.lineCard}>
              <Text style={styles.lineTitle}>{line.itemName}</Text>
              <Text style={styles.lineMeta}>{line.warehouseName} · pending {line.pendingQty}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Qty to receive</Text>
                <QuantityStepper
                  value={line.quantityReceived}
                  min={0}
                  max={line.pendingQty}
                  onChange={(qty) => updateLine(index, { quantityReceived: qty })}
                />
              </View>
            </View>
          ))
        )}
        <TextInput
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          style={styles.notes}
        />
        <PrimaryButton title="Post GRN" onPress={onSubmit} loading={submitting} disabled={!lines.length} />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  lineCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  lineTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  lineMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, color: colors.text },
  notes: { marginVertical: spacing.md, backgroundColor: colors.white },
  error: { color: '#DC2626', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, marginBottom: spacing.md },
});
