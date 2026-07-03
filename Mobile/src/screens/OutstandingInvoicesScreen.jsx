import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getOutstandingInvoices } from '../api/financeService';

function flattenOutstanding(data) {
  if (!data) return [];
  const detail = data.aging_detail || {};
  return [
    ...(detail.current || []),
    ...(detail.overdue_1_30 || []),
    ...(detail.overdue_31_60 || []),
    ...(detail.overdue_61_90 || []),
    ...(detail.overdue_90_plus || []),
  ];
}

export default function OutstandingInvoicesScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getOutstandingInvoices();
      setData(res?.data || null);
    } catch (err) {
      setData(null);
      setError(apiError(err, 'Failed to load outstanding invoices'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 30000);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => flattenOutstanding(data), [data]);
  const totalOutstanding = data?.total_outstanding ?? 0;
  const totalCount = data?.total_count ?? rows.length;

  return (
    <AppScreen>
      <GlassHeader
        title="Outstanding"
        subtitle={`${totalCount} invoice(s) · Total ${totalOutstanding}`}
      />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => String(item.id ?? item.invoice_id ?? i)}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.invoice_number || item.number || 'Invoice'}
              subtitle={item.party_name || item.customer_name || item.vendor_name}
              meta={[item.status, item.balance_due != null ? `Due: ${item.balance_due}` : item.aging_bucket].filter(Boolean).join(' · ')}
              icon="clock-alert-outline"
            />
          )}
          ListEmptyComponent={(
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>
              No outstanding invoices
            </Text>
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
