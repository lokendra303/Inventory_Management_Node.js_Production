import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useFocusLoad from '../hooks/useFocusLoad';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import apiClient from '../api/apiClient';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import InventoryTile from '../components/InventoryTile';
import SearchBar from '../components/SearchBar';
import SkeletonTile from '../components/SkeletonTile';
import { APP_VERSION } from '../config/appVersion';
import { buildVisibleMenu, navigateMenuItem } from '../navigation/menuConfig';
import { colors, radius, spacing } from '../config/theme';

export default function InventoryScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const ops = useMemo(() => {
    const sections = buildVisibleMenu(user, APP_VERSION);
    const inventory = sections.find((s) => s.id === 'inventory');
    return (inventory?.items || []).filter((item) => item.screen && item.screen !== 'InventoryMain');
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/inventory', { params: { limit: 200 } });
      const data = Array.isArray(res?.data) ? res.data : [];
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 10000);

  const filtered = rows.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = String(row.itemName || row.name || '').toLowerCase();
    const sku = String(row.sku || '').toLowerCase();
    return name.includes(q) || sku.includes(q);
  });

  return (
    <AppScreen>
      <GlassHeader title="Inventory" subtitle="Stock levels and warehouse workflows" />
      {ops.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.opsRow} contentContainerStyle={styles.opsContent}>
          {ops.map((link) => (
            <Pressable
              key={link.screen}
              style={styles.opsChip}
              onPress={() => navigateMenuItem(navigation, link)}
            >
              <MaterialCommunityIcons name={link.icon || 'link'} size={18} color={colors.primary} />
              <Text style={styles.opsText}>{link.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Filter stock" />
      {loading ? (
        <View>
          <SkeletonTile />
          <SkeletonTile />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => String(item.id || item.itemId || idx)}
          renderItem={({ item }) => (
            <InventoryTile
              title={item.itemName || item.name || 'Stock'}
              subtitle={item.warehouseName || item.warehouse}
              sku={item.sku}
              quantity={item.quantity ?? item.availableQuantity ?? item.stock}
              reorderLevel={item.reorderLevel}
              icon="warehouse"
            />
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  opsRow: { marginBottom: spacing.sm, maxHeight: 48 },
  opsContent: { paddingRight: spacing.sm },
  opsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginRight: spacing.sm,
  },
  opsText: { fontWeight: '700', color: colors.primary, fontSize: 12 },
});
