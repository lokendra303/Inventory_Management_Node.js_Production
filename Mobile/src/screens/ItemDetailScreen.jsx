import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import StatusPill, { stockStatusFromQty } from '../components/StatusPill';
import { hasPermission } from '../config/permissions';
import { colors, radius, spacing } from '../config/theme';

export default function ItemDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const itemId = route.params?.itemId;
  const [item, setItem] = useState(null);
  const canManage = hasPermission(user, 'item_management');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get(`/items/${itemId}`);
        setItem(res?.data || null);
      } catch {
        setItem(null);
      }
    })();
  }, [itemId]);

  if (!item) {
    return (
      <AppScreen>
        <Text style={styles.muted}>Loading item...</Text>
      </AppScreen>
    );
  }

  const qty = item.quantity ?? item.stockQuantity ?? 0;
  const status = stockStatusFromQty(qty, item.reorderLevel);

  return (
    <AppScreen style={{ paddingHorizontal: 0 }}>
      <ScrollView>
        <LinearGradient colors={[colors.primary, colors.accent]} style={styles.hero}>
          <Text style={styles.heroTitle}>{item.name}</Text>
          <Text style={styles.heroSku}>{item.sku}</Text>
        </LinearGradient>
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <StatusPill status={status} />
          </View>
          <Info label="Type" value={item.type} />
          <Info label="Category" value={item.category} />
          <Info label="Quantity" value={String(qty)} />
          <Info label="Reorder level" value={item.reorderLevel != null ? String(item.reorderLevel) : '—'} />
          <Info label="Unit" value={item.unit} />
          {canManage ? (
            <Button mode="contained" onPress={() => navigation.navigate('ItemForm', { itemId })} style={{ marginTop: spacing.lg }}>
              Edit item
            </Button>
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, paddingTop: spacing.xl, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  heroTitle: { color: colors.white, fontSize: 26, fontWeight: '800' },
  heroSku: { color: '#E0E7FF', marginTop: spacing.xs, fontWeight: '600' },
  body: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.textMuted, fontSize: 14 },
  value: { color: colors.text, fontWeight: '600', fontSize: 14 },
  muted: { color: colors.textMuted, padding: spacing.lg },
});
