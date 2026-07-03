import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getProfitLoss } from '../api/financeService';

export default function ProfitLossScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getProfitLoss({});
      setData(res?.data || null);
    } catch (err) {
      setData(null);
      setError(apiError(err, 'Failed to load profit & loss'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 30000);
  useEffect(() => { load(); }, [load]);

  const rows = [
    { label: 'Revenue', value: data?.revenue ?? data?.total_revenue },
    { label: 'Cost of goods sold', value: data?.cogs ?? data?.cost_of_goods_sold },
    { label: 'Gross profit', value: data?.gross_profit },
    { label: 'Operating expenses', value: data?.operating_expenses ?? data?.expenses },
    { label: 'Net profit', value: data?.net_profit ?? data?.net_income },
  ];

  return (
    <AppScreen>
      <GlassHeader title="Profit & loss" subtitle="Current period summary" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <ScrollView>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>{row.value ?? '—'}</Text>
            </View>
          ))}
          {!rows.some((r) => r.value != null) ? (
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>
              No P&L data for this period. Use the web app for detailed reports.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: { fontSize: 15, color: '#334155', fontWeight: '600' },
  value: { fontSize: 16, color: '#1E293B', fontWeight: '700' },
});
