import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import useFocusLoad from '../hooks/useFocusLoad';
import { createRule, listRules } from '../api/skuService';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import PrimaryButton from '../components/PrimaryButton';
import { colors, radius, spacing } from '../config/theme';

export default function SkuRulesScreen() {
  const [rules, setRules] = useState([]);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('{CAT}-{SEQ}');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await listRules();
      setRules(Array.isArray(data) ? data : []);
    } catch {
      setRules([]);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 15000);

  const onCreate = async () => {
    setMessage('');
    setLoading(true);
    try {
      await createRule({ name: name.trim() || 'Default rule', pattern: pattern.trim(), isActive: true });
      setName('');
      setMessage('Rule saved');
      await load();
    } catch (e) {
      setMessage(e.response?.data?.error || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <GlassHeader title="SKU rules" subtitle="Generation patterns" />
      <View style={styles.form}>
        <TextInput label="Rule name" mode="outlined" value={name} onChangeText={setName} style={styles.input} />
        <TextInput label="Pattern" mode="outlined" value={pattern} onChangeText={setPattern} style={styles.input} />
        <PrimaryButton title="Create rule" onPress={onCreate} loading={loading} />
        {message ? <Text style={styles.msg}>{message}</Text> : null}
      </View>
      <FlatList
        data={rules}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name || 'Rule'}</Text>
            <Text style={styles.cardPattern}>{item.pattern}</Text>
            <Text style={styles.cardMeta}>{item.isActive === false ? 'Inactive' : 'Active'}</Text>
          </View>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: spacing.md },
  input: { marginBottom: spacing.sm, backgroundColor: colors.white },
  msg: { marginTop: spacing.sm, color: colors.textMuted },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontWeight: '700', color: colors.text },
  cardPattern: { marginTop: 4, color: colors.primary, fontFamily: 'monospace' },
  cardMeta: { marginTop: 4, fontSize: 12, color: colors.textMuted },
});
