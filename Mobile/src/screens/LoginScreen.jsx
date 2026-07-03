import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Checkbox, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth/AuthContext';
import AppScreen from '../components/AppScreen';
import PrimaryButton from '../components/PrimaryButton';
import { getItem, KEYS, setItem, deleteItem } from '../api/storage';
import { colors, spacing } from '../config/theme';

export default function LoginScreen() {
  const { login, verifyLoginOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [step, setStep] = useState('credentials');
  const [saveCreds, setSaveCreds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const raw = await getItem(KEYS.creds);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.password) setPassword(parsed.password);
        setSaveCreds(true);
      } catch {}
    })();
  }, []);

  const onLogin = async () => {
    setError('');
    setLoading(true);
    const result = await login({ email: email.trim(), password });
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Login failed');
      return;
    }
    if (result.otpRequired) {
      setInstitutionId(result.institutionId || '');
      setStep('otp');
      return;
    }
    if (saveCreds) await setItem(KEYS.creds, JSON.stringify({ email: email.trim(), password }));
    else await deleteItem(KEYS.creds);
  };

  const onVerifyOtp = async () => {
    setError('');
    setLoading(true);
    const result = await verifyLoginOtp(email.trim(), otp.trim(), institutionId);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Invalid OTP');
      return;
    }
    if (saveCreds) await setItem(KEYS.creds, JSON.stringify({ email: email.trim(), password }));
    else await deleteItem(KEYS.creds);
  };

  return (
    <AppScreen style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
            <Text style={styles.brand}>IMS SEPCUNE</Text>
            <Text style={styles.tagline}>Inventory on the go</Text>
          </LinearGradient>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {step === 'credentials' ? (
            <>
              <TextInput label="Email" mode="outlined" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <TextInput label="Password" mode="outlined" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
              <View style={styles.row}>
                <Checkbox status={saveCreds ? 'checked' : 'unchecked'} onPress={() => setSaveCreds((v) => !v)} />
                <Text style={styles.checkLabel}>Remember email & password on this device</Text>
              </View>
              <PrimaryButton title="Sign in" onPress={onLogin} loading={loading} />
            </>
          ) : (
            <>
              <Text style={styles.otpHint}>Enter the OTP sent to {email}</Text>
              <TextInput label="OTP" mode="outlined" value={otp} onChangeText={setOtp} keyboardType="number-pad" style={styles.input} />
              <PrimaryButton title="Verify OTP" onPress={onVerifyOtp} loading={loading} />
              <PrimaryButton title="Back" onPress={() => setStep('credentials')} style={{ marginTop: spacing.sm }} disabled={loading} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  hero: { borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg },
  brand: { color: colors.white, fontSize: 28, fontWeight: '800' },
  tagline: { color: '#E0E7FF', marginTop: spacing.xs, fontSize: 15 },
  input: { marginBottom: spacing.sm, backgroundColor: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  checkLabel: { flex: 1, color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger, marginBottom: spacing.sm },
  otpHint: { color: colors.textMuted, marginBottom: spacing.md },
});
