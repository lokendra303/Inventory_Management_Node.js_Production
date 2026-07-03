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
  apiError, getItems, getTransfers, getWarehouses, transferStock,
} from '../api/operationsService';
import { colors, spacing } from '../config/theme';

export default function TransfersScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [itemId, setItemId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getTransfers();
      setHistory(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load transfers'));
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

  const onSubmit = async () => {
    if (!itemId || !fromWarehouseId || !toWarehouseId) {
      setError('Select item and both warehouses');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError('Source and destination must differ');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await transferStock({
        itemId,
        fromWarehouseId,
        toWarehouseId,
        quantity: Number(quantity),
      });
      setModalOpen(false);
      reload();
    } catch (err) {
      setError(apiError(err, 'Transfer failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <GlassHeader
        title="Move stock"
        subtitle="Inter-warehouse transfers"
        right={(
          <Pressable onPress={openModal} style={styles.addBtn}>
            <Text style={styles.addText}>+ Transfer</Text>
          </Pressable>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, idx) => String(item.id || item.transferId || idx)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.item_name || 'Item'}
              subtitle={`${item.from_warehouse_name || item.fromWarehouseName} → ${item.to_warehouse_name || item.toWarehouseName}`}
              meta={`Qty ${item.quantity} · ${item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}`}
              icon="swap-horizontal"
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>No transfer history</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={styles.sheetTitle}>Transfer stock</Text>
            <Text style={styles.label}>Item</Text>
            {items.slice(0, 25).map((it) => (
              <Pressable key={it.id} onPress={() => setItemId(it.id)} style={[styles.option, itemId === it.id && styles.selected]}>
                <Text>{it.name}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>From warehouse</Text>
            {warehouses.map((wh) => (
              <Pressable key={`from-${wh.id}`} onPress={() => setFromWarehouseId(wh.id)} style={[styles.option, fromWarehouseId === wh.id && styles.selected]}>
                <Text>{wh.name}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>To warehouse</Text>
            {warehouses.map((wh) => (
              <Pressable key={`to-${wh.id}`} onPress={() => setToWarehouseId(wh.id)} style={[styles.option, toWarehouseId === wh.id && styles.selected]}>
                <Text>{wh.name}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Quantity</Text>
            <QuantityStepper value={quantity} min={1} onChange={setQuantity} />
            <PrimaryButton title="Transfer" onPress={onSubmit} loading={submitting} />
            <Pressable onPress={() => setModalOpen(false)}><Text style={styles.muted}>Cancel</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 8 },
  addText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  error: { color: '#DC2626', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  label: { fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  option: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: spacing.xs },
  selected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
});
