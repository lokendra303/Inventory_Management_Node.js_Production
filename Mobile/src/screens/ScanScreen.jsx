import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import InventoryTile from '../components/InventoryTile';
import { colors, spacing } from '../config/theme';

export default function ScanScreen() {
  const navigation = useNavigation();
  const [barcode, setBarcode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    setError('');
    setResult(null);
    const code = barcode.trim();
    if (!code) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/items', { params: { search: code, limit: 5 } });
      const items = Array.isArray(res?.data) ? res.data : [];
      const match = items.find((i) => String(i.sku).toLowerCase() === code.toLowerCase() || String(i.barcode) === code) || items[0];
      if (!match) {
        setError('No item found for this code');
      } else {
        setResult(match);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <GlassHeader title="Scan" subtitle="Barcode lookup" />
      {Platform.OS === 'web' ? (
        <Text style={styles.note}>Camera scanning is available on a physical device. On web, enter a barcode or SKU manually.</Text>
      ) : (
        <Text style={styles.note}>Use the camera scanner on device, or enter a code below.</Text>
      )}
      <TextInput label="Barcode / SKU" mode="outlined" value={barcode} onChangeText={setBarcode} style={styles.input} autoCapitalize="characters" />
      <Button mode="contained" onPress={lookup} loading={loading} style={{ marginBottom: spacing.md }}>Look up</Button>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <InventoryTile
          title={result.name}
          sku={result.sku}
          quantity={result.quantity ?? result.stockQuantity}
          reorderLevel={result.reorderLevel}
          onPress={() => navigation.navigate('ItemsTab', { screen: 'ItemDetail', params: { itemId: result.id || result.itemId } })}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  input: { marginBottom: spacing.sm, backgroundColor: colors.white },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
