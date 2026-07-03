import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SearchBar from '../components/SearchBar';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getWarehouseBins } from '../api/financeService';

export default function WarehouseLocationsScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getWarehouseBins({ limit: 500 });
      const data = res?.data?.bins || res?.data || [];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load warehouse locations'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 30000);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return rows;
    const q = debouncedSearch.toLowerCase();
    return rows.filter((r) => (
      String(r.bin_code || r.code || r.name || '').toLowerCase().includes(q)
      || String(r.zone_name || r.rack_name || r.warehouse_name || '').toLowerCase().includes(q)
    ));
  }, [rows, debouncedSearch]);

  return (
    <AppScreen>
      <GlassHeader title="Zones / racks / bins" subtitle="Warehouse locations" />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search bins" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => String(item.id ?? item.bin_id ?? i)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.bin_code || item.code || item.name || 'Bin'}
              subtitle={[item.zone_name, item.rack_name, item.warehouse_name].filter(Boolean).join(' · ')}
              meta={item.status || (item.capacity != null ? `Cap ${item.capacity}` : undefined)}
              icon="map-marker-radius-outline"
            />
          )}
          ListEmptyComponent={(
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No locations</Text>
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
