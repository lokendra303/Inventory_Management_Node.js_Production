import React, { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getSalesOrders } from '../api/operationsService';

const STATUS = {
  draft: 'Draft', confirmed: 'Confirmed', partially_shipped: 'Partial ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

export default function SalesOrdersScreen() {
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSalesOrders();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load sales orders'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 12000);

  return (
    <AppScreen>
      <GlassHeader title="Sales orders" subtitle="Confirm and ship orders" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.so_number}
              subtitle={item.customer_name}
              meta={`${item.order_date || ''} · ${STATUS[item.status] || item.status}`}
              icon="cart-outline"
              onPress={() => navigation.navigate('SalesOrderDetail', { soId: item.id })}
            />
          )}
          ListEmptyComponent={<Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No sales orders</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
