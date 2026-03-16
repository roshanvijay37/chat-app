import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();

  const handleLogin = async () => {
    if (!identifier.trim() || !password) return;
    setError('');
    setLoading(true);
    const res = await login(identifier.trim(), password);
    setLoading(false);
    if (res.error) setError(res.error);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.card, { backgroundColor: theme.bgSecondary }]}>
          <Text style={[s.title, { color: theme.accent }]}>Sign In</Text>
          {error ? <Text style={[s.error, { color: theme.error }]}>{error}</Text> : null}
          <TextInput
            style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
            placeholder="Email or Username"
            placeholderTextColor={theme.textMuted}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, s.passwordInput, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
              placeholder="Password"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.btn, { backgroundColor: theme.accent }]} onPress={handleLogin} disabled={loading}>
            <Text style={s.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={[s.link, { color: theme.textMuted }]}>
              Don't have an account? <Text style={{ color: theme.accent }}>Sign Up</Text>
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
  error: { fontSize: 13, marginBottom: 8 },
  input: { padding: 14, borderWidth: 1, borderRadius: 8, fontSize: 15, marginBottom: 10 },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
  btn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#111', fontWeight: '700', fontSize: 16 },
  link: { marginTop: 16, fontSize: 13, textAlign: 'center' },
});
