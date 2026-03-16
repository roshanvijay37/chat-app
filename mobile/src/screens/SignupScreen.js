import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('signup');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, verifyOtp } = useAuth();
  const { theme } = useTheme();

  const handleSignup = async () => {
    if (!email.trim() || !password || !displayName.trim()) return;
    setError('');
    setLoading(true);
    const res = await signup(email.trim(), password, displayName.trim());
    setLoading(false);
    if (res.error) return setError(res.error);
    if (res.needsVerification) setStep('otp');
  };

  const handleVerify = async () => {
    if (!otp.trim()) return;
    setError('');
    setLoading(true);
    const res = await verifyOtp(email.trim(), otp.trim());
    setLoading(false);
    if (res.error) setError(res.error);
  };

  if (step === 'otp') {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.card, { backgroundColor: theme.bgSecondary }]}>
            <Text style={[s.title, { color: theme.accent }]}>Verify Email</Text>
            <Text style={[s.subtitle, { color: theme.textMuted }]}>We sent a 6-digit code to {email}</Text>
            {error ? <Text style={[s.error, { color: theme.error }]}>{error}</Text> : null}
            <TextInput
              style={[s.input, s.otpInput, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
              placeholder="000000"
              placeholderTextColor={theme.textMuted}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity style={[s.btn, { backgroundColor: theme.accent }]} onPress={handleVerify} disabled={loading}>
              <Text style={s.btnText}>{loading ? 'Verifying...' : 'Verify'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.card, { backgroundColor: theme.bgSecondary }]}>
          <Text style={[s.title, { color: theme.accent }]}>Create Account</Text>
          {error ? <Text style={[s.error, { color: theme.error }]}>{error}</Text> : null}
          <TextInput
            style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
            placeholder="Username"
            placeholderTextColor={theme.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="none"
          />
          <TextInput
            style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
            placeholder="Email"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, s.passwordInput, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
              placeholder="Password (min 6 chars)"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.btn, { backgroundColor: theme.accent }]} onPress={handleSignup} disabled={loading}>
            <Text style={s.btnText}>{loading ? 'Signing up...' : 'Sign Up'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[s.link, { color: theme.textMuted }]}>
              Already have an account? <Text style={{ color: theme.accent }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, padding: 28, borderRadius: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  subtitle: { fontSize: 13, marginBottom: 14 },
  error: { fontSize: 13, marginBottom: 8 },
  input: { padding: 14, borderWidth: 1, borderRadius: 8, fontSize: 15, marginBottom: 10 },
  otpInput: { textAlign: 'center', fontSize: 22, letterSpacing: 8 },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
  btn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#111', fontWeight: '700', fontSize: 16 },
  link: { marginTop: 16, fontSize: 13, textAlign: 'center' },
});
