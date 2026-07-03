import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getAuditTrail } from '../api/financeService';

export default function AuditTrailScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAuditTrail({ limit: 100 });
      const data = res?.data?.entries || res?.data?.auditTrail || res?.data || [];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load audit trail'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 30000);
  useEffect(() => { load(); }, [load]);

  return (
    <AppScreen>
      <GlassHeader title="Audit trail" subtitle="Recent activity" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => String(item.id ?? i)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.action || item.event || 'Activity'}
              subtitle={[item.entity_type, item.entity_id].filter(Boolean).join(' #')}
              meta={[item.user_name || item.username, item.created_at || item.timestamp].filter(Boolean).join(' · ')}
              icon="shield-search"
            />
          )}
          ListEmptyComponent={(
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No audit entries</Text>
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
