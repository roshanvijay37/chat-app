import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function NewChatScreen({ navigation }) {
  const [mode, setMode] = useState('direct');
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setError('');
    setLoading(true);
    const data = await api.findUser(query.trim());
    setLoading(false);
    if (data.error) { setError(data.error); setSearchResult(null); return; }
    setSearchResult(data);
  };

  const handleDirectChat = async () => {
    if (!searchResult) return handleSearch();
    setLoading(true);
    const conv = await api.createConversation(searchResult.id);
    setLoading(false);
    if (conv.error) return setError(conv.error);
    navigation.replace('Chat', { conversation: conv.conversation });
  };

  const addToGroup = () => {
    if (!searchResult) return;
    if (groupMembers.find((m) => m.id === searchResult.id)) return;
    setGroupMembers((prev) => [...prev, searchResult]);
    setSearchResult(null);
    setQuery('');
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return setError('Group name required');
    if (groupMembers.length < 1) return setError('Add at least 1 member');
    setError('');
    setLoading(true);
    const res = await api.createGroup(groupName.trim(), groupMembers.map((m) => m.id));
    setLoading(false);
    if (res.error) return setError(res.error);
    navigation.replace('Chat', { conversation: res.conversation });
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
      <View style={[s.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.accent, fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>New Chat</Text>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, mode === 'direct' && { backgroundColor: theme.accent }]}
          onPress={() => setMode('direct')}
        >
          <Text style={[s.tabText, mode === 'direct' && { color: '#111' }]}>Direct</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, mode === 'group' && { backgroundColor: theme.accent }]}
          onPress={() => setMode('group')}
        >
          <Text style={[s.tabText, mode === 'group' && { color: '#111' }]}>Group</Text>
        </TouchableOpacity>
      </View>

      {mode === 'group' && (
        <TextInput
          style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
          placeholder="Group name"
          placeholderTextColor={theme.textMuted}
          value={groupName}
          onChangeText={setGroupName}
        />
      )}

      <View style={s.searchRow}>
        <TextInput
          style={[s.input, { flex: 1, backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
          placeholder="Search by email or username"
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={(t) => { setQuery(t); setSearchResult(null); }}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={[s.searchBtn, { backgroundColor: theme.bgTertiary }]} onPress={handleSearch}>
          <Text>🔍</Text>
        </TouchableOpacity>
      </View>

      {searchResult && (
        <View style={[s.resultCard, { backgroundColor: theme.bgTertiary }]}>
          <Text style={{ color: theme.text, flex: 1 }}>{searchResult.display_name} ({searchResult.email})</Text>
          {mode === 'direct' ? (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={handleDirectChat}>
              <Text style={{ color: '#111', fontWeight: '600' }}>Chat</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={addToGroup}>
              <Text style={{ color: '#111', fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {mode === 'group' && groupMembers.length > 0 && (
        <View style={s.membersRow}>
          {groupMembers.map((m) => (
            <View key={m.id} style={[s.chip, { backgroundColor: theme.groupColor }]}>
              <Text style={{ color: '#fff', fontSize: 13 }}>{m.display_name}</Text>
              <TouchableOpacity onPress={() => setGroupMembers((prev) => prev.filter((x) => x.id !== m.id))}>
                <Text style={{ color: '#fff', marginLeft: 6 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {error ? <Text style={[s.error, { color: theme.error }]}>{error}</Text> : null}

      {mode === 'direct' && !searchResult && (
        <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }]} onPress={handleDirectChat} disabled={loading}>
          <Text style={{ color: '#111', fontWeight: '700' }}>{loading ? 'Searching...' : 'Find & Chat'}</Text>
        </TouchableOpacity>
      )}

      {mode === 'group' && (
        <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }]} onPress={handleCreateGroup} disabled={loading}>
          <Text style={{ color: '#111', fontWeight: '700' }}>{loading ? 'Creating...' : `Create Group (${groupMembers.length})`}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '600', marginLeft: 12 },
  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: 8, overflow: 'hidden' },
  tab: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#333' },
  tabText: { fontWeight: '600', color: '#888' },
  input: { padding: 12, borderWidth: 1, borderRadius: 8, fontSize: 15, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchBtn: { padding: 12, borderRadius: 8, justifyContent: 'center' },
  resultCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 12 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  membersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  error: { fontSize: 13, marginBottom: 12 },
  submitBtn: { padding: 14, borderRadius: 8, alignItems: 'center' },
});
