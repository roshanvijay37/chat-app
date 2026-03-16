import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function ViewProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { theme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProfile(userId)
      .then((data) => {
        if (data.error) setError(data.error);
        else setProfile(data);
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={[s.container, s.center, { backgroundColor: theme.bg }]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={[s.header, { borderBottomColor: theme.borderLight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.accent, fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: theme.text }]}>Profile</Text>
        </View>
        <View style={s.center}>
          <Text style={{ color: theme.error }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial = profile?.display_name?.[0]?.toUpperCase() || '?';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[s.header, { borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.accent, fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Profile</Text>
      </View>

      <View style={s.content}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: theme.accent }]}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
        )}

        <Text style={[s.name, { color: theme.text }]}>{profile.display_name}</Text>

        {profile.bio ? (
          <View style={[s.bioCard, { backgroundColor: theme.bgSecondary, borderColor: theme.borderLight }]}>
            <Text style={[s.bioLabel, { color: theme.textMuted }]}>About</Text>
            <Text style={[s.bioText, { color: theme.text }]}>{profile.bio}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '600', marginLeft: 12 },
  content: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 48 },
  name: { fontSize: 22, fontWeight: '600', marginTop: 16 },
  bioCard: { marginTop: 24, padding: 16, borderRadius: 12, borderWidth: 1, width: '100%' },
  bioLabel: { fontSize: 12, marginBottom: 4 },
  bioText: { fontSize: 15, lineHeight: 22 },
});
