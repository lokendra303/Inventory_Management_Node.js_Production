import React, { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import useFocusLoad from '../hooks/useFocusLoad';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import { apiError, getWarehouses } from '../api/warehouseService';

export default function WarehousesScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getWarehouses();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load warehouses'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 12000);

  return (
    <AppScreen>
      <GlassHeader title="Warehouses" subtitle="Active storage locations" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
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
              title={item.name}
              subtitle={item.code || item.location || 'Warehouse'}
              meta={item.status ? `Status: ${item.status}` : undefined}
              icon="warehouse"
              status={item.status === 'active' ? 'ok' : 'unknown'}
              statusLabel={item.status}
            />
          )}
          ListEmptyComponent={<Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No warehouses</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
