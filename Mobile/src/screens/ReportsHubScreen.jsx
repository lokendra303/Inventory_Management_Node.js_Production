import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import {
  apiError,
  getReportDashboard,
  getReportInventory,
  getReportPurchases,
  getReportSales,
} from '../api/financeService';

const REPORT_BLOCKS = [
  { key: 'dashboard', title: 'Dashboard summary', icon: 'view-dashboard-outline', loader: getReportDashboard },
  { key: 'inventory', title: 'Inventory report', icon: 'warehouse', loader: getReportInventory },
  { key: 'sales', title: 'Sales report', icon: 'cart-outline', loader: getReportSales },
  { key: 'purchases', title: 'Purchases report', icon: 'shopping-outline', loader: getReportPurchases },
];

export default function ReportsHubScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.all(
        REPORT_BLOCKS.map(async (block) => {
          try {
            const res = await block.loader();
            const data = res?.data || {};
            const headline = data.summary || data.headline || data.total_items || data.total_sales || data.total_purchases;
            return {
              key: block.key,
              title: block.title,
              icon: block.icon,
              subtitle: headline != null ? String(headline) : 'Loaded',
              meta: data.period || data.date_range || 'Tap for web details',
            };
          } catch {
            return {
              key: block.key,
              title: block.title,
              icon: block.icon,
              subtitle: 'Unavailable',
              meta: 'Open web for full export',
            };
          }
        }),
      );
      setRows(results);
    } catch (err) {
      setRows([]);
      setError(apiError(err, 'Failed to load reports'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 60000);
  useEffect(() => { load(); }, [load]);

  return (
    <AppScreen>
      <GlassHeader title="Reports" subtitle="Summary snapshots" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <WorkflowTile
              title={item.title}
              subtitle={item.subtitle}
              meta={item.meta}
              icon={item.icon}
            />
          )}
          ListEmptyComponent={(
            <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No reports</Text>
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
