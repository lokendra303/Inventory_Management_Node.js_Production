import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import { generateSku } from '../api/skuService';
import { colors, spacing } from '../config/theme';

export default function ItemFormScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const itemId = route.params?.itemId;
  const isEdit = Boolean(itemId);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [type, setType] = useState('product');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      try {
        const res = await apiClient.get(`/items/${itemId}`);
        const item = res?.data;
        if (!item) return;
        setName(item.name || '');
        setSku(item.sku || '');
        setType(item.type || 'product');
        setCategory(item.category || '');
        setUnit(item.unit || 'pcs');
      } catch {}
    })();
  }, [itemId]);

  const onGenerateSku = async () => {
    try {
      const data = await generateSku({ name, category, type, unit });
      if (data?.sku) setSku(data.sku);
      else if (data?.preview) setSku(data.preview);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not generate SKU');
    }
  };

  const onSave = async () => {
    setError('');
    setLoading(true);
    const payload = { name: name.trim(), sku: sku.trim(), type, category: category.trim(), unit: unit.trim() };
    try {
      if (isEdit) await apiClient.put(`/items/${itemId}`, payload);
      else await apiClient.post('/items', payload);
      navigation.goBack();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <GlassHeader title={isEdit ? 'Edit item' : 'New item'} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput label="Name" mode="outlined" value={name} onChangeText={setName} style={styles.input} />
        <View style={styles.skuRow}>
          <TextInput label="SKU" mode="outlined" value={sku} onChangeText={setSku} style={[styles.input, { flex: 1 }]} />
          <Button mode="outlined" onPress={onGenerateSku} style={styles.genBtn}>Generate</Button>
        </View>
        <TextInput label="Type" mode="outlined" value={type} onChangeText={setType} style={styles.input} />
        <TextInput label="Category" mode="outlined" value={category} onChangeText={setCategory} style={styles.input} />
        <TextInput label="Unit" mode="outlined" value={unit} onChangeText={setUnit} style={styles.input} />
        <PrimaryButton title={isEdit ? 'Update item' : 'Create item'} onPress={onSave} loading={loading} />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: spacing.sm, backgroundColor: colors.white },
  skuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  genBtn: { marginBottom: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
