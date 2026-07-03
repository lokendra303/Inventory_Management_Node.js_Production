import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getCompanySettings } from '../api/financeService';

function Field({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  );
}

export default function CompanySettingsScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCompanySettings();
      setData(res?.data || null);
    } catch (err) {
      setData(null);
      setError(apiError(err, 'Failed to load company settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 60000);
  useEffect(() => { load(); }, [load]);

  const company = data?.company || data || {};

  return (
    <AppScreen>
      <GlassHeader title="Company settings" subtitle="Read-only overview" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <ScrollView>
          <Field label="Company name" value={company.name || company.company_name} />
          <Field label="Legal name" value={company.legal_name} />
          <Field label="Email" value={company.email} />
          <Field label="Phone" value={company.phone} />
          <Field label="Tax ID" value={company.tax_id || company.gstin} />
          <Field label="Currency" value={company.currency || company.base_currency} />
          <Field label="Address" value={company.address || company.full_address} />
          <Text style={styles.note}>
            Edit company profile, stamps, and PDF templates on the web app.
          </Text>
        </ScrollView>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  fieldValue: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
  note: { color: '#64748B', fontSize: 13, marginTop: 16, lineHeight: 20 },
});
