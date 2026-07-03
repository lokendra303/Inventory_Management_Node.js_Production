import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SearchBar from '../components/SearchBar';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useFocusLoad from '../hooks/useFocusLoad';
import apiClient from '../api/apiClient';
import { apiError } from '../api/operationsService';
import {
  LIST_SCREEN_REGISTRY,
  extractListRows,
  pickField,
} from '../config/screenRegistry';

async function fetchListRows(config) {
  if (config.mergeRequests?.length) {
    const results = await Promise.all(
      config.mergeRequests.map((req) => apiClient.get(req.endpoint, { params: req.params })),
    );
    const merged = [];
    const seen = new Set();
    results.forEach((res) => {
      extractListRows(res, config.dataPaths).forEach((row) => {
        const id = row?.id ?? JSON.stringify(row);
        if (seen.has(id)) return;
        seen.add(id);
        merged.push(row);
      });
    });
    return merged;
  }

  const res = await apiClient.get(config.endpoint, { params: config.params });
  return extractListRows(res, config.dataPaths);
}

export default function GenericApiListScreen() {
  const route = useRoute();
  const config = LIST_SCREEN_REGISTRY[route.name];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchListRows(config);
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(apiError(err, `Failed to load ${config.title?.toLowerCase() || 'records'}`));
    } finally {
      setLoading(false);
    }
  }, [config]);

  const reload = useFocusLoad(load, [load], 15000);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return rows;
    const q = debouncedSearch.toLowerCase();
    return rows.filter((row) => {
      const blob = [
        pickField(row, config?.titleKeys),
        pickField(row, config?.subtitleKeys),
        pickField(row, config?.metaKeys),
      ].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [rows, debouncedSearch, config]);

  if (!config) {
    return (
      <AppScreen>
        <Text>Screen not configured.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <GlassHeader title={config.title} subtitle="Browse & lookup" />
      <SearchBar value={search} onChangeText={setSearch} placeholder={`Search ${config.title?.toLowerCase()}`} />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => String(item.id ?? item._id ?? index)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={pickField(item, config.titleKeys) || config.title}
              subtitle={pickField(item, config.subtitleKeys)}
              meta={pickField(item, config.metaKeys)}
              icon={config.icon || 'file-document-outline'}
            />
          )}
          ListEmptyComponent={(
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>
              No records found
            </Text>
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
