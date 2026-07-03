import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';
import SkeletonTile from '../components/SkeletonTile';
import useFocusLoad from '../hooks/useFocusLoad';
import { apiError, getSubscription } from '../api/financeService';

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ?? '—'}</Text>
    </View>
  );
}

export default function SubscriptionScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSubscription();
      setData(res?.data || null);
    } catch (err) {
      setData(null);
      setError(apiError(err, 'Failed to load subscription'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useFocusLoad(load, [load], 60000);
  useEffect(() => { load(); }, [load]);

  const sub = data?.subscription || data || {};

  return (
    <AppScreen>
      <GlassHeader title="Subscription" subtitle="Plan & usage" />
      {error ? <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text> : null}
      {loading ? (
        <View><SkeletonTile /><SkeletonTile /></View>
      ) : (
        <ScrollView>
          <Field label="Plan" value={sub.plan_name || sub.planName || sub.plan} />
          <Field label="Status" value={sub.status} />
          <Field label="Billing cycle" value={sub.billing_cycle || sub.billingCycle} />
          <Field label="Renews on" value={sub.renewal_date || sub.renewalDate} />
          <Field label="Users" value={sub.users_used != null ? `${sub.users_used} / ${sub.user_limit ?? '∞'}` : null} />
          <Text style={styles.note}>
            Upgrade plans and billing history are managed on the web app.
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
