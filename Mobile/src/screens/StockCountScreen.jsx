import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { hasPermission } from '../config/permissions';
import {
  apiError,
  approveStockCount,
  cancelStockCount,
  createStockCount,
  getStockCounts,
  getWarehouses,
} from '../api/warehouseService';
import { colors, spacing } from '../config/theme';

const STATUS_LABEL = {
  draft: 'Draft',
  in_progress: 'In progress',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export default function StockCountScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'inventory_adjust');
  const canApprove = hasPermission(user, 'inventory_management');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getStockCounts();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load stock counts'));
    } finally {
      setLoading(false);
    }
  }, []);

  const openCreate = async () => {
    try {
      const res = await getWarehouses({ status: 'active' });
      setWarehouses(Array.isArray(res?.data) ? res.data : []);
      setWarehouseId('');
      setNotes('');
      setModalOpen(true);
    } catch (err) {
      setError(apiError(err, 'Failed to load warehouses'));
    }
  };

  const onCreate = async () => {
    if (!warehouseId) {
      setError('Select a warehouse');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await createStockCount({
        warehouseId,
        countType: 'full',
        scheduledDate: new Date().toISOString().split('T')[0],
        notes: notes.trim() || undefined,
      });
      setModalOpen(false);
      await load();
      if (res?.data?.id) {
        navigation.navigate('StockCountDetail', { countId: res.data.id });
      }
    } catch (err) {
      setError(apiError(err, 'Failed to create stock count'));
    } finally {
      setCreating(false);
    }
  };

  const onApprove = async (countId) => {
    try {
      await approveStockCount(countId);
      load();
    } catch (err) {
      setError(apiError(err, 'Failed to approve count'));
    }
  };

  const onCancel = async (countId) => {
    try {
      await cancelStockCount(countId);
      load();
    } catch (err) {
      setError(apiError(err, 'Failed to cancel count'));
    }
  };

  const reload = useFocusLoad(load, [load], 12000);

  return (
    <AppScreen>
      <GlassHeader
        title="Stock count"
        subtitle="Floor counts and approvals"
        right={canCreate ? (
          <Pressable onPress={openCreate} style={styles.addBtn}>
            <Text style={styles.addText}>+ New</Text>
          </Pressable>
        ) : null}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View>
          <SkeletonTile />
          <SkeletonTile />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.count_number}
              subtitle={item.warehouse_name}
              meta={`${item.counted_lines || 0}/${item.total_lines || 0} lines · ${item.count_type}`}
              status={item.status === 'pending_approval' ? 'low' : item.status === 'approved' ? 'ok' : 'unknown'}
              statusLabel={STATUS_LABEL[item.status] || item.status}
              icon="clipboard-check-outline"
              onPress={() => navigation.navigate('StockCountDetail', { countId: item.id })}
              right={
                <View>
                  {canApprove && item.status === 'pending_approval' ? (
                    <Pressable onPress={() => onApprove(item.id)} style={styles.smallBtn}>
                      <Text style={styles.smallBtnText}>Approve</Text>
                    </Pressable>
                  ) : null}
                  {canCreate && ['draft', 'in_progress'].includes(item.status) ? (
                    <Pressable onPress={() => onCancel(item.id)} style={[styles.smallBtn, styles.cancelBtn]}>
                      <Text style={styles.smallBtnText}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>No stock counts yet</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New stock count</Text>
            <Text style={styles.label}>Warehouse</Text>
            {warehouses.map((wh) => (
              <Pressable
                key={wh.id}
                onPress={() => setWarehouseId(wh.id)}
                style={[styles.whOption, warehouseId === wh.id && styles.whSelected]}
              >
                <Text style={styles.whText}>{wh.name}</Text>
              </Pressable>
            ))}
            <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined" style={styles.notes} />
            <PrimaryButton title="Create count" onPress={onCreate} loading={creating} />
            <Pressable onPress={() => setModalOpen(false)} style={styles.closeLink}>
              <Text style={styles.muted}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 8 },
  addText: { color: colors.white, fontWeight: '700' },
  error: { color: '#DC2626', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  smallBtn: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 4 },
  cancelBtn: { backgroundColor: '#64748B' },
  smallBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.md, color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  whOption: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: spacing.xs },
  whSelected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  whText: { color: colors.text, fontWeight: '600' },
  notes: { marginVertical: spacing.md, backgroundColor: colors.white },
  closeLink: { alignItems: 'center', marginTop: spacing.sm },
});
