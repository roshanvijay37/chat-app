import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getCachedConversations, setCachedConversations } from '../services/db';

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const initialLoad = useRef(true);

  // Load cached first, then fetch fresh
  const loadConversations = async (showRefresh = false) => {
    if (!user?.id) return;

    // On first load, show cached instantly
    if (initialLoad.current) {
      const cached = await getCachedConversations(user.id);
      if (cached.length > 0) {
        setConversations(cached);
      }
      initialLoad.current = false;
    }

    // Fetch fresh from server
    if (showRefresh) setRefreshing(true);
    const data = await api.getConversations();
    if (showRefresh) setRefreshing(false);

    if (Array.isArray(data)) {
      setConversations(data);
      await setCachedConversations(user.id, data);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [user?.id])
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMsg = (msg) => {
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== msg.conversation_id) return c;
          return {
            ...c,
            last_message: { id: msg.id, content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id, type: msg.type },
            unread_count: msg.sender_id !== user.id ? (c.unread_count || 0) + 1 : c.unread_count,
          };
        });
        return updated.sort((a, b) => {
          const timeA = a.last_message?.created_at || '0';
          const timeB = b.last_message?.created_at || '0';
          return timeB.localeCompare(timeA);
        });
      });
    };

    const handleStatus = ({ conversationId, status }) => {
      if (status === 'read') {
        setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)));
      }
    };

    const handleGroupCreated = () => loadConversations();

    socket.on('message:new', handleNewMsg);
    socket.on('message:status', handleStatus);
    socket.on('group:created', handleGroupCreated);
    socket.on('group:added', handleGroupCreated);

    return () => {
      socket.off('message:new', handleNewMsg);
      socket.off('message:status', handleStatus);
      socket.off('group:created', handleGroupCreated);
      socket.off('group:added', handleGroupCreated);
    };
  }, [user?.id]);

  const onRefresh = () => loadConversations(true);

  const getDisplay = (c) => {
    if (c.type === 'group') {
      return { name: c.name || 'Group', initial: c.name?.[0]?.toUpperCase() || 'G', avatarUrl: null, isGroup: true };
    }
    return {
      name: c.participant?.display_name || 'Unknown',
      initial: c.participant?.display_name?.[0]?.toUpperCase() || '?',
      avatarUrl: c.participant?.avatar_url || null,
      isGroup: false,
    };
  };

  const getPreview = (c) => {
    const msg = c.last_message;
    if (!msg) return 'No messages yet';
    if (msg.deleted_at) return '🚫 Message deleted';
    if (msg.type === 'image') return '🖼️ Photo';
    if (msg.type === 'file') return '📄 File';
    return msg.content?.slice(0, 35) || '';
  };

  const renderItem = ({ item }) => {
    const d = getDisplay(item);
    return (
      <TouchableOpacity
        style={[s.item, { borderBottomColor: theme.borderLight }]}
        onPress={() => navigation.navigate('Chat', { conversation: item })}
      >
        {d.avatarUrl ? (
          <Image source={{ uri: d.avatarUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: d.isGroup ? theme.groupColor : theme.accent }]}>
            <Text style={s.avatarText}>{d.initial}</Text>
          </View>
        )}
        <View style={s.info}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{d.name}</Text>
          <Text style={[s.preview, { color: theme.textMuted }]} numberOfLines={1}>{getPreview(item)}</Text>
        </View>
        {item.unread_count > 0 && (
          <View style={[s.badge, { backgroundColor: theme.accent }]}>
            <Text style={s.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={s.userRow} onPress={() => navigation.navigate('Profile')}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.headerAvatar} />
          ) : (
            <View style={[s.headerAvatar, s.avatarPlaceholder, { backgroundColor: theme.accent }]}>
              <Text style={s.avatarTextSmall}>{user?.display_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <Text style={[s.headerName, { color: theme.accent }]} numberOfLines={1}>{user?.display_name}</Text>
        </TouchableOpacity>
        <View style={s.headerActions}>
          <TouchableOpacity style={[s.iconBtn, { borderColor: theme.border }]} onPress={toggleTheme}>
            <Text style={{ color: theme.text }}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { borderColor: theme.border }]} onPress={() => navigation.navigate('NewChat')}>
            <Text style={{ color: theme.text, fontSize: 18 }}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { borderColor: theme.border }]} onPress={logout}>
            <Text style={{ color: theme.error, fontSize: 12, fontWeight: '600' }}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={<Text style={[s.empty, { color: theme.textMuted }]}>No conversations yet</Text>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerName: { fontWeight: '600', fontSize: 15, marginLeft: 10, flexShrink: 1 },
  headerActions: { flexDirection: 'row' },
  iconBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  avatarTextSmall: { color: '#fff', fontWeight: '700', fontSize: 14 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontWeight: '600', fontSize: 15, marginBottom: 2 },
  preview: { fontSize: 13 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#111', fontWeight: '700', fontSize: 11 },
  empty: { textAlign: 'center', marginTop: 50, fontSize: 15 },
});
