import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import {
  apiError,
  getAccountingSummary,
  getTrialBalance,
} from '../api/financeService';

export default function AccountingScreen() {
  const [summary, setSummary] = useState(null);
  const [trialRows, setTrialRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sumRes, tbRes] = await Promise.all([
        getAccountingSummary(),
        getTrialBalance({ limit: 100 }),
      ]);
      setSummary(sumRes?.data || null);
      const rows = tbRes?.data?.accounts || tbRes?.data?.trial_balance || tbRes?.data || [];
      setTrialRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setSummary(null);
      setTrialRows([]);
      setError(apiError(err, 'Failed to load accounting'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 30000);
  useEffect(() => { load(); }, [load]);

  return (
    <AppScreen>
      <GlassHeader title="Accounting" subtitle="Summary & trial balance" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryRow}>
            {[
              { label: 'Receivables', value: summary?.total_receivables },
              { label: 'Payables', value: summary?.total_payables },
              { label: 'Cash', value: summary?.cash_balance },
              { label: 'Revenue', value: summary?.total_revenue },
            ].map((card) => (
              <View key={card.label} style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{card.value ?? '—'}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.sectionTitle}>Trial balance</Text>
          <FlatList
            data={trialRows}
            keyExtractor={(item, i) => String(item.account_id ?? item.id ?? item.code ?? i)}
            renderItem={({ item }) => (
              <WorkflowTile
                title={item.account_name || item.name || item.code || 'Account'}
                subtitle={item.account_type || item.type}
                meta={[item.debit != null ? `Dr ${item.debit}` : null, item.credit != null ? `Cr ${item.credit}` : null, item.balance != null ? `Bal ${item.balance}` : null].filter(Boolean).join(' · ')}
                icon="book-open-outline"
              />
            )}
            ListEmptyComponent={(
              <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>
                No trial balance rows
              </Text>
            )}
            onRefresh={reload}
            refreshing={loading}
          />
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryRow: { marginBottom: 16, maxHeight: 90 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginRight: 10,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  summaryLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
});
