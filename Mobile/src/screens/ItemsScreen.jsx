import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import InventoryTile from '../components/InventoryTile';
import SearchBar from '../components/SearchBar';
import SkeletonTile from '../components/SkeletonTile';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { hasPermission } from '../config/permissions';
import { colors, spacing } from '../config/theme';

export default function ItemsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 450);
  const canManage = hasPermission(user, 'item_management');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/items', {
        params: { search: debouncedSearch || undefined, limit: 100 },
      });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppScreen style={styles.screen}>
      <GlassHeader title="Items" subtitle="Browse catalog" />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search items" />
      {loading ? (
        <View>
          <SkeletonTile />
          <SkeletonTile />
          <SkeletonTile />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id || item.itemId || item.sku)}
          renderItem={({ item }) => (
            <InventoryTile
              title={item.name || item.itemName || 'Item'}
              subtitle={item.category || item.type}
              sku={item.sku}
              quantity={item.quantity ?? item.stockQuantity}
              reorderLevel={item.reorderLevel}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id || item.itemId })}
            />
          )}
          contentContainerStyle={{ paddingBottom: 96 }}
          onRefresh={load}
          refreshing={loading}
        />
      )}
      {canManage ? (
        <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('ItemForm', {})} color={colors.white} />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary },
});
