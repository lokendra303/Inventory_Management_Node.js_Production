import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getDocumentFolders } from '../api/financeService';

export default function DocumentsScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getDocumentFolders();
      const data = res?.data?.folders || res?.data || [];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load documents'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 30000);
  useEffect(() => { load(); }, [load]);

  return (
    <AppScreen>
      <GlassHeader title="Documents" subtitle="Folders" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => String(item.id ?? item.folder_id ?? i)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.name || 'Folder'}
              subtitle={item.parent_name || item.path}
              meta={item.file_count != null ? `${item.file_count} files` : undefined}
              icon="folder-outline"
            />
          )}
          ListEmptyComponent={(
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>
              No document folders. Upload files on the web app.
            </Text>
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
