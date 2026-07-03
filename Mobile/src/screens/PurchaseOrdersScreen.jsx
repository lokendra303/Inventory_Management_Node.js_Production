import React, { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getPurchaseOrders } from '../api/operationsService';

const STATUS = { draft: 'Draft', sent: 'Sent', confirmed: 'Confirmed', partially_received: 'Partial', received: 'Received', cancelled: 'Cancelled' };

export default function PurchaseOrdersScreen() {
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPurchaseOrders();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load purchase orders'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 12000);

  return (
    <AppScreen>
      <GlassHeader title="Purchase orders" subtitle="View and confirm POs" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.po_number}
              subtitle={item.vendor_name}
              meta={`${item.order_date || ''} · ${STATUS[item.status] || item.status}`}
              icon="file-document-outline"
              onPress={() => navigation.navigate('PurchaseOrderDetail', { poId: item.id })}
            />
          )}
          ListEmptyComponent={<Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No purchase orders</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
