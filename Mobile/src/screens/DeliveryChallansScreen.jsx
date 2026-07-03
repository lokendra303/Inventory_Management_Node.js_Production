import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { hasPermission } from '../config/permissions';
import { apiError, getDeliveryChallans, updateChallanStatus } from '../api/operationsService';

const NEXT_STATUS = { draft: 'dispatched', dispatched: 'delivered' };

export default function DeliveryChallansScreen() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'sales_management');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getDeliveryChallans();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load challans'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 12000);

  const advanceStatus = async (item) => {
    const next = NEXT_STATUS[item.status];
    if (!next) return;
    try {
      await updateChallanStatus(item.id, next);
      load();
    } catch (err) {
      setError(apiError(err, 'Failed to update status'));
    }
  };

  return (
    <AppScreen>
      <GlassHeader title="Delivery challans" subtitle="Dispatch and delivery status" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.challan_number || item.challanNumber}
              subtitle={item.customer_name || item.customerName}
              meta={`${item.challan_date || item.challanDate || ''} · ${item.status}`}
              icon="truck-fast-outline"
              right={
                canManage && NEXT_STATUS[item.status] ? (
                  <Pressable onPress={() => advanceStatus(item)} style={{ backgroundColor: '#1B4DFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>→ {NEXT_STATUS[item.status]}</Text>
                  </Pressable>
                ) : undefined
              }
            />
          )}
          ListEmptyComponent={<Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No challans</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
