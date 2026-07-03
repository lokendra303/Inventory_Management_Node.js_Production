import React, { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import WorkflowTile from '../components/WorkflowTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { getPendingReceipts, getPurchaseOrders, apiError } from '../api/warehouseService';

const PENDING_STATUSES = new Set(['sent', 'confirmed', 'partially_received']);

function groupPendingByPo(lines) {
  const map = new Map();
  lines.forEach((line) => {
    const poId = line.po_id || line.poId;
    if (!poId) return;
    if (!map.has(poId)) {
      map.set(poId, {
        id: poId,
        po_number: line.po_number || line.poNumber,
        vendor_name: line.vendor_name || line.vendorName,
        status: 'partially_received',
        pendingLines: 0,
      });
    }
    map.get(poId).pendingLines += 1;
  });
  return Array.from(map.values());
}

export default function GrnScreen() {
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPurchaseOrders();
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(list.filter((po) => PENDING_STATUSES.has(po.status)));
    } catch (err) {
      try {
        const pendingRes = await getPendingReceipts();
        const lines = Array.isArray(pendingRes?.data) ? pendingRes.data : [];
        setRows(groupPendingByPo(lines));
        if (!lines.length) setError('');
      } catch (inner) {
        setRows([]);
        setError(apiError(inner, apiError(err, 'Could not load receive queue')));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 12000);

  return (
    <AppScreen>
      <GlassHeader title="Receive goods" subtitle="GRN against open purchase orders" />
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
              title={item.po_number || 'Purchase order'}
              subtitle={item.vendor_name || 'Vendor'}
              meta={`${item.vendor_name || 'Vendor'}${item.pendingLines ? ` · ${item.pendingLines} lines` : ''}`}
              icon="truck-delivery-outline"
              onPress={() => navigation.navigate('GrnReceive', { poId: item.id, poNumber: item.po_number })}
            />
          )}
          ListEmptyComponent={<Text style={{ color: '#64748B', textAlign: 'center', marginTop: 24 }}>No open POs to receive</Text>}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}
