import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SearchBar from '../components/SearchBar';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getVendors } from '../api/operationsService';

export default function VendorsScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getVendors({ search: debouncedSearch || undefined, limit: 100 });
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load vendors'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  const reload = useFocusLoad(load, [load], 15000);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => (
      String(r.display_name || r.name || '').toLowerCase().includes(q)
      || String(r.email || '').toLowerCase().includes(q)
    ));
  }, [rows, search]);

  return (
    <AppScreen>
      <GlassHeader title="Vendors" subtitle="Supplier directory" />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search vendors" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.display_name || item.name || 'Vendor'}
              subtitle={item.email || item.phone}
              meta={item.status ? `Status: ${item.status}` : undefined}
              icon="truck-outline"
            />
          )}
          ListEmptyComponent={<Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No vendors</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
