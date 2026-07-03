import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import QuantityStepper from '../components/QuantityStepper';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import {
  apiError,
  completePutaway,
  getPendingPutaways,
  getPutawayHistory,
  getWarehouseBins,
} from '../api/warehouseService';
import { colors, spacing } from '../config/theme';

export default function PutawayScreen() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [bins, setBins] = useState([]);
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'pending') {
        const pRes = await getPendingPutaways();
        setPending(Array.isArray(pRes?.data) ? pRes.data : []);
      } else {
        const hRes = await getPutawayHistory({ limit: 50 });
        setHistory(Array.isArray(hRes?.data) ? hRes.data : []);
      }
    } catch (err) {
      setError(apiError(err, 'Failed to load putaways'));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const reload = useFocusLoad(load, [load], 12000);

  useEffect(() => {
    load();
  }, [load]);

  const openPutaway = async (record) => {
    setSelected(record);
    setQuantity(Number(record.pendingQuantity) || 0);
    setBinId(record.defaultBinId || '');
    setNotes('');
    try {
      const res = await getWarehouseBins({
        warehouseId: record.warehouseId,
        status: 'active',
        limit: 500,
      });
      setBins(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setBins([]);
      setError(apiError(err, 'Failed to load bins'));
    }
  };

  const onSubmit = async () => {
    if (!selected || !binId) {
      setError('Select a bin');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await completePutaway({
        grnLineId: selected.grnLineId,
        binId,
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
      });
      setSelected(null);
      load();
    } catch (err) {
      setError(apiError(err, 'Failed to complete putaway'));
    } finally {
      setSubmitting(false);
    }
  };

  const rows = tab === 'pending' ? pending : history;

  return (
    <AppScreen>
      <GlassHeader title="Putaway" subtitle="Assign received stock to bins" />
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('pending')} style={[styles.tab, tab === 'pending' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>Pending ({pending.length})</Text>
        </Pressable>
        <Pressable onPress={() => setTab('history')} style={[styles.tab, tab === 'history' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
        </Pressable>
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
          keyExtractor={(item, idx) => String(item.grnLineId || item.id || idx)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.itemName || item.item_name || 'Item'}
              subtitle={item.warehouseName || item.warehouse_name}
              meta={tab === 'pending'
                ? `GRN ${item.grnNumber} · pending ${item.pendingQuantity}`
                : `${item.binCode || item.bin_code || 'Bin'} · ${item.quantity}`}
              icon="archive-arrow-down-outline"
              onPress={tab === 'pending' ? () => openPutaway(item) : undefined}
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>No {tab} putaways</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}

      <Modal visible={Boolean(selected)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.itemName}</Text>
            <Text style={styles.muted}>GRN {selected?.grnNumber}</Text>
            <Text style={styles.label}>Quantity</Text>
            <QuantityStepper
              value={quantity}
              min={0}
              max={Number(selected?.pendingQuantity) || undefined}
              onChange={setQuantity}
            />
            <Text style={[styles.label, { marginTop: spacing.md }]}>Bin</Text>
            {bins.map((bin) => (
              <Pressable
                key={bin.id}
                onPress={() => setBinId(bin.id)}
                style={[styles.binOption, binId === bin.id && styles.binSelected]}
              >
                <Text style={styles.binText}>{bin.code} {bin.name ? `· ${bin.name}` : ''}</Text>
              </Pressable>
            ))}
            <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined" style={styles.notes} />
            <PrimaryButton title="Complete putaway" onPress={onSubmit} loading={submitting} />
            <Pressable onPress={() => setSelected(null)} style={styles.closeLink}>
              <Text style={styles.muted}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: '#EEF2FF', borderColor: colors.primary },
  tabText: { fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  error: { color: '#DC2626', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.lg, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  binOption: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: spacing.xs },
  binSelected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  binText: { color: colors.text, fontWeight: '600' },
  notes: { marginVertical: spacing.md, backgroundColor: colors.white },
  closeLink: { alignItems: 'center', marginTop: spacing.sm },
});
