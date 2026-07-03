import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import useFocusLoad from '../hooks/useFocusLoad';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import SkeletonTile from '../components/SkeletonTile';
import { hasPermission } from '../config/permissions';
import { apiError, getStockCount, submitStockCount } from '../api/warehouseService';
import { colors, spacing } from '../config/theme';

export default function StockCountDetailScreen() {
  const route = useRoute();
  const { user } = useAuth();
  const { countId } = route.params || {};
  const canCount = hasPermission(user, 'inventory_adjust');

  const [count, setCount] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!countId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStockCount(countId);
      const data = res?.data;
      setCount(data);
      setLines(
        (data?.lines || []).map((line) => ({
          lineId: line.id,
          itemName: line.item_name,
          sku: line.sku,
          systemQty: line.system_qty,
          inputQty: line.counted_qty != null ? String(line.counted_qty) : '',
        })),
      );
    } catch (err) {
      setError(apiError(err, 'Failed to load count'));
    } finally {
      setLoading(false);
    }
  }, [countId]);

  const reload = useFocusLoad(load, [load], 10000);

  const updateQty = (lineId, value) => {
    setLines((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, inputQty: value } : line)));
  };

  const onSubmit = async () => {
    const payload = lines
      .filter((line) => line.inputQty !== '' && line.inputQty != null)
      .map((line) => ({
        lineId: line.lineId,
        countedQty: parseFloat(line.inputQty),
      }));
    if (!payload.length) {
      setError('Enter at least one counted quantity');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitStockCount(countId, payload);
      reload();
    } catch (err) {
      setError(apiError(err, 'Failed to submit count'));
    } finally {
      setSubmitting(false);
    }
  };

  const editable = canCount && count && ['draft', 'in_progress'].includes(count.status);

  return (
    <AppScreen>
      <GlassHeader
        title={count?.count_number || 'Stock count'}
        subtitle={count?.warehouse_name || ''}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View>
          <SkeletonTile />
          <SkeletonTile />
        </View>
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(item) => String(item.lineId)}
            renderItem={({ item }) => (
              <View style={styles.lineCard}>
                <Text style={styles.title}>{item.itemName}</Text>
                <Text style={styles.meta}>{item.sku} · system {item.systemQty}</Text>
                {editable ? (
                  <TextInput
                    label="Counted qty"
                    value={item.inputQty}
                    onChangeText={(v) => updateQty(item.lineId, v)}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    style={styles.input}
                  />
                ) : (
                  <Text style={styles.counted}>Counted: {item.inputQty || '—'}</Text>
                )}
              </View>
            )}
          />
          {editable ? (
            <PrimaryButton title="Submit count" onPress={onSubmit} loading={submitting} />
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  lineCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
  input: { backgroundColor: colors.white },
  counted: { fontSize: 14, fontWeight: '600', color: colors.text },
  error: { color: '#DC2626', marginBottom: spacing.sm },
});
