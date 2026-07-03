import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import QuantityStepper from '../components/QuantityStepper';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { hasPermission } from '../config/permissions';
import {
  apiError, approveTransfer, getItems, getTransferApprovals, getWarehouses,
  rejectTransfer, requestTransferApproval,
} from '../api/operationsService';
import { colors, spacing } from '../config/theme';

export default function TransferApprovalsScreen() {
  const { user } = useAuth();
  const canApprove = hasPermission(user, 'inventory_management');
  const canRequest = hasPermission(user, 'inventory_transfer');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [itemId, setItemId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getTransferApprovals();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(apiError(err, 'Failed to load requests'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 12000);

  const openRequest = async () => {
    const [iRes, wRes] = await Promise.all([
      getItems({ limit: 200, status: 'active' }),
      getWarehouses({ status: 'active' }),
    ]);
    setItems(Array.isArray(iRes?.data) ? iRes.data : []);
    setWarehouses(Array.isArray(wRes?.data) ? wRes.data : []);
    setModalOpen(true);
  };

  const onRequest = async () => {
    setSubmitting(true);
    try {
      await requestTransferApproval({
        itemId, fromWarehouseId, toWarehouseId, quantity: Number(quantity), reason: reason.trim() || undefined,
      });
      setModalOpen(false);
      reload();
    } catch (err) {
      setError(apiError(err, 'Request failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onApprove = async (id) => {
    try {
      await approveTransfer(id);
      reload();
    } catch (err) {
      setError(apiError(err, 'Approve failed'));
    }
  };

  const onReject = async (id) => {
    try {
      await rejectTransfer(id, 'Rejected from mobile');
      reload();
    } catch (err) {
      setError(apiError(err, 'Reject failed'));
    }
  };

  return (
    <AppScreen>
      <GlassHeader
        title="Transfer approvals"
        subtitle="Request and approve moves"
        right={canRequest ? (
          <Pressable onPress={openRequest} style={styles.addBtn}>
            <Text style={styles.addText}>+ Request</Text>
          </Pressable>
        ) : null}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.item_name || item.transfer_number}
              subtitle={`${item.from_warehouse_name} → ${item.to_warehouse_name}`}
              meta={`Qty ${item.quantity} · ${item.status}`}
              icon="clipboard-check-outline"
              right={
                item.status === 'pending' && canApprove ? (
                  <View>
                    <Pressable onPress={() => onApprove(item.id)} style={styles.okBtn}><Text style={styles.btnText}>Approve</Text></Pressable>
                    <Pressable onPress={() => onReject(item.id)} style={styles.noBtn}><Text style={styles.btnText}>Reject</Text></Pressable>
                  </View>
                ) : undefined
              }
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>No transfer requests</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Text style={styles.sheetTitle}>Request transfer</Text>
            {items.slice(0, 20).map((it) => (
              <Pressable key={it.id} onPress={() => setItemId(it.id)} style={[styles.option, itemId === it.id && styles.selected]}><Text>{it.name}</Text></Pressable>
            ))}
            <Text style={styles.label}>From</Text>
            {warehouses.map((wh) => (
              <Pressable key={`f-${wh.id}`} onPress={() => setFromWarehouseId(wh.id)} style={[styles.option, fromWarehouseId === wh.id && styles.selected]}><Text>{wh.name}</Text></Pressable>
            ))}
            <Text style={styles.label}>To</Text>
            {warehouses.map((wh) => (
              <Pressable key={`t-${wh.id}`} onPress={() => setToWarehouseId(wh.id)} style={[styles.option, toWarehouseId === wh.id && styles.selected]}><Text>{wh.name}</Text></Pressable>
            ))}
            <QuantityStepper value={quantity} min={1} onChange={setQuantity} />
            <TextInput label="Reason" value={reason} onChangeText={setReason} mode="outlined" style={{ marginVertical: spacing.sm }} />
            <PrimaryButton title="Submit request" onPress={onRequest} loading={submitting} />
            <Pressable onPress={() => setModalOpen(false)}><Text style={styles.muted}>Cancel</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 8 },
  addText: { color: colors.white, fontWeight: '700', fontSize: 11 },
  error: { color: '#DC2626', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center' },
  okBtn: { backgroundColor: '#10B981', padding: 6, borderRadius: 6, marginBottom: 4 },
  noBtn: { backgroundColor: '#64748B', padding: 6, borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  label: { fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
  option: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: spacing.xs },
  selected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
});
