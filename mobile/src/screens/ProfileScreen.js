import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUri, setAvatarUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const formData = new FormData();
    if (displayName.trim() !== user.display_name) formData.append('displayName', displayName.trim());
    if (bio.trim() !== (user.bio || '')) formData.append('bio', bio.trim());
    if (avatarUri) {
      formData.append('avatar', { uri: avatarUri, name: 'avatar.jpg', type: 'image/jpeg' });
    }

    const res = await api.updateProfile(formData);
    setSaving(false);
    if (res.error) return setError(res.error);
    await refreshProfile();
    navigation.goBack();
  };

  const cooldownDays = user?.display_name_changed_at
    ? Math.ceil(7 - (Date.now() - new Date(user.display_name_changed_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
      <View style={[s.header, { borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.accent, fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Edit Profile</Text>
      </View>

      <TouchableOpacity style={s.avatarWrap} onPress={pickAvatar}>
        {avatarUri || user?.avatar_url ? (
          <Image source={{ uri: avatarUri || user.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: theme.accent }]}>
            <Text style={s.avatarText}>{user?.display_name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <View style={[s.cameraIcon, { backgroundColor: theme.bgSecondary }]}>
          <Text>📷</Text>
        </View>
      </TouchableOpacity>

      <TextInput
        style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
        placeholder="Display name"
        placeholderTextColor={theme.textMuted}
        value={displayName}
        onChangeText={setDisplayName}
      />
      {cooldownDays > 0 && cooldownDays <= 7 && (
        <Text style={[s.cooldown, { color: '#f0a500' }]}>Username can be changed again in {cooldownDays} day{cooldownDays > 1 ? 's' : ''}</Text>
      )}

      <TextInput
        style={[s.input, s.bioInput, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
        placeholder="Bio (max 150 chars)"
        placeholderTextColor={theme.textMuted}
        value={bio}
        onChangeText={setBio}
        maxLength={150}
        multiline
      />
      <Text style={[s.charCount, { color: theme.textMuted }]}>{bio.length}/150</Text>

      {error ? <Text style={[s.error, { color: theme.error }]}>{error}</Text> : null}

      <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={handleSave} disabled={saving}>
        <Text style={{ color: '#111', fontWeight: '700', fontSize: 16 }}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '600', marginLeft: 12 },
  avatarWrap: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 36 },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  input: { padding: 14, borderWidth: 1, borderRadius: 8, fontSize: 15, marginBottom: 8 },
  bioInput: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, textAlign: 'right', marginBottom: 12 },
  cooldown: { fontSize: 12, marginBottom: 12 },
  error: { fontSize: 13, marginBottom: 12 },
  saveBtn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
});
