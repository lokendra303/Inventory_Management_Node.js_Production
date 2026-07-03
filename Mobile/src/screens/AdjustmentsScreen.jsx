import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import QuantityStepper from '../components/QuantityStepper';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import {
  adjustStock, apiError, getAdjustments, getItemStock, getItems, getWarehouses,
} from '../api/operationsService';
import { colors, spacing } from '../config/theme';

const REASONS = {
  increase: ['Count Correction', 'Stock Found', 'Return to Stock', 'Other'],
  decrease: ['Count Correction', 'Damaged', 'Expired', 'Missing / Lost', 'Other'],
};

export default function AdjustmentsScreen() {
  const [history, setHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('increase');
  const [quantityChange, setQuantityChange] = useState(1);
  const [reason, setReason] = useState('Count Correction');
  const [currentStock, setCurrentStock] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAdjustments({ limit: 50 });
      setHistory(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load adjustments'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 12000);

  const openModal = async () => {
    try {
      const [iRes, wRes] = await Promise.all([
        getItems({ limit: 200, status: 'active' }),
        getWarehouses({ status: 'active' }),
      ]);
      setItems(Array.isArray(iRes?.data) ? iRes.data : []);
      setWarehouses(Array.isArray(wRes?.data) ? wRes.data : []);
      setModalOpen(true);
    } catch (err) {
      setError(apiError(err, 'Failed to load lookups'));
    }
  };

  const onSelectStock = async (nextItemId, nextWhId) => {
    setItemId(nextItemId);
    setWarehouseId(nextWhId);
    if (!nextItemId || !nextWhId) {
      setCurrentStock(null);
      return;
    }
    try {
      const res = await getItemStock(nextItemId, nextWhId);
      setCurrentStock(res?.data || null);
    } catch {
      setCurrentStock(null);
    }
  };

  const onSubmit = async () => {
    if (!itemId || !warehouseId) {
      setError('Select item and warehouse');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await adjustStock({
        itemId,
        warehouseId,
        adjustmentType,
        quantityChange: Number(quantityChange),
        reason,
        lossType: 'OTHER',
      });
      setModalOpen(false);
      reload();
    } catch (err) {
      setError(apiError(err, 'Adjustment failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <GlassHeader
        title="Adjustments"
        subtitle="Correct stock on hand"
        right={(
          <Pressable onPress={openModal} style={styles.addBtn}>
            <Text style={styles.addText}>+ New</Text>
          </Pressable>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.item_name || 'Item'}
              subtitle={item.warehouse_name}
              meta={`${item.adjustment_type} ${item.quantity_change} · ${item.reason}`}
              icon="tune-vertical"
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>No adjustments yet</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={styles.sheetTitle}>New adjustment</Text>
            <Text style={styles.label}>Item</Text>
            {items.slice(0, 30).map((it) => (
              <Pressable key={it.id} onPress={() => onSelectStock(it.id, warehouseId)} style={[styles.option, itemId === it.id && styles.selected]}>
                <Text>{it.name}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Warehouse</Text>
            {warehouses.map((wh) => (
              <Pressable key={wh.id} onPress={() => onSelectStock(itemId, wh.id)} style={[styles.option, warehouseId === wh.id && styles.selected]}>
                <Text>{wh.name}</Text>
              </Pressable>
            ))}
            {currentStock ? (
              <Text style={styles.muted}>On hand: {currentStock.quantity_on_hand ?? currentStock.quantityOnHand ?? '—'}</Text>
            ) : null}
            <View style={styles.typeRow}>
              {['increase', 'decrease'].map((t) => (
                <Pressable key={t} onPress={() => { setAdjustmentType(t); setReason(REASONS[t][0]); }} style={[styles.typeChip, adjustmentType === t && styles.selected]}>
                  <Text style={styles.typeText}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Quantity</Text>
            <QuantityStepper value={quantityChange} min={1} onChange={setQuantityChange} />
            <Text style={styles.label}>Reason</Text>
            {REASONS[adjustmentType].map((r) => (
              <Pressable key={r} onPress={() => setReason(r)} style={[styles.option, reason === r && styles.selected]}>
                <Text>{r}</Text>
              </Pressable>
            ))}
            <PrimaryButton title="Post adjustment" onPress={onSubmit} loading={submitting} />
            <Pressable onPress={() => setModalOpen(false)}><Text style={styles.muted}>Cancel</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 8 },
  addText: { color: colors.white, fontWeight: '700' },
  error: { color: '#DC2626', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  label: { fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  option: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: spacing.xs },
  selected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  typeChip: { flex: 1, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center' },
  typeText: { textTransform: 'capitalize', fontWeight: '600' },
});
