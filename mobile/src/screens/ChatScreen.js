import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, Pressable, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';
import { getCachedMessages, setCachedMessages, appendCachedMessage, updateCachedMessage } from '../services/db';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path } from 'react-native-svg';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function MessageStatus({ msg, theme }) {
  const SingleCheck = () => (
    <Svg width={16} height={11} viewBox="0 0 16 11" fill="none" stroke={theme.tickDefault} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 5.5L5.5 10L14.5 1" />
    </Svg>
  );
  const DoubleCheck = ({ color }) => (
    <Svg width={16} height={11} viewBox="0 0 16 11" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 5.5L4 8.5L10 2.5" />
      <Path d="M5 5.5L8 8.5L14 2.5" />
    </Svg>
  );

  if (msg.read_at) return <DoubleCheck color={theme.readBlue} />;
  if (msg.delivered_at) return <DoubleCheck color={theme.tickDefault} />;
  return <SingleCheck />;
}

export default function ChatScreen({ route, navigation }) {
  const { conversation } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [reactionMsgId, setReactionMsgId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);
  const initialLoad = useRef(true);
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startCall } = useCall();
  const isGroup = conversation?.type === 'group';

  // Cache-first message loading
  useEffect(() => {
    if (!conversation || !user?.id) return;

    const loadMessages = async () => {
      // Show cached instantly on first load
      if (initialLoad.current) {
        const cached = await getCachedMessages(conversation.id, user.id);
        if (cached.length > 0) {
          setMessages(cached);
        }
        initialLoad.current = false;
      }

      // Fetch fresh from server
      const data = await api.getMessages(conversation.id);
      if (Array.isArray(data)) {
        const reversed = data.reverse();
        setMessages(reversed);
        await setCachedMessages(conversation.id, user.id, reversed);
      }
    };

    loadMessages();
  }, [conversation?.id, user?.id]);

  useEffect(() => {
    if (!conversation) return;
    const socket = getSocket();
    if (socket) socket.emit('message:read', { conversationId: conversation.id });
  }, [conversation?.id, messages.length]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversation) return;

    socket.emit('conversation:join', conversation.id);

    const handleNew = async (msg) => {
      if (msg.conversation_id === conversation.id) {
        setMessages((prev) => [...prev, msg]);
        await appendCachedMessage(conversation.id, user.id, msg);
      }
    };

    const handleStatus = async ({ messageIds, status, timestamp }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!messageIds.includes(m.id)) return m;
          if (status === 'read') return { ...m, delivered_at: m.delivered_at || timestamp, read_at: timestamp };
          if (status === 'delivered') return { ...m, delivered_at: timestamp };
          return m;
        })
      );
      // Update cache
      for (const msgId of messageIds) {
        const update = status === 'read' 
          ? { delivered_at: timestamp, read_at: timestamp }
          : { delivered_at: timestamp };
        await updateCachedMessage(msgId, update);
      }
    };

    const handleTypingStart = ({ userId, conversationId }) => {
      if (conversationId === conversation.id && userId !== user.id) setTyping(true);
    };

    const handleTypingStop = ({ userId, conversationId }) => {
      if (conversationId === conversation.id && userId !== user.id) setTyping(false);
    };

    const handleUpdated = async ({ messageId, content, edited_at }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content, edited_at } : m)));
      await updateCachedMessage(messageId, { content, edited_at });
    };

    const handleDeleted = async ({ messageId, deleted_at }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: null, deleted_at } : m)));
      await updateCachedMessage(messageId, { content: null, deleted_at });
    };

    const handleReactionUpdated = async ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
      await updateCachedMessage(messageId, { reactions });
    };

    socket.on('message:new', handleNew);
    socket.on('message:status', handleStatus);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('message:updated', handleUpdated);
    socket.on('message:deleted', handleDeleted);
    socket.on('reaction:updated', handleReactionUpdated);

    return () => {
      socket.off('message:new', handleNew);
      socket.off('message:status', handleStatus);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('message:updated', handleUpdated);
      socket.off('message:deleted', handleDeleted);
      socket.off('reaction:updated', handleReactionUpdated);
    };
  }, [conversation?.id, user?.id]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const socket = getSocket();
    socket.emit('message:send', { conversationId: conversation.id, content: input.trim() });
    socket.emit('typing:stop', { conversationId: conversation.id });
    setInput('');
  };

  const handleInputChange = (text) => {
    setInput(text);
    const socket = getSocket();
    socket.emit('typing:start', { conversationId: conversation.id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: conversation.id });
    }, 1500);
  };

  const toggleReaction = (msgId, emoji) => {
    const socket = getSocket();
    socket.emit('reaction:toggle', { messageId: msgId, emoji, conversationId: conversation.id });
    setReactionMsgId(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploading(true);
      await api.uploadFile(conversation.id, asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploading(true);
      await api.uploadFile(conversation.id, asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
      setUploading(false);
    }
  };

  const headerName = isGroup ? conversation.name : conversation.participant?.display_name || 'Unknown';
  const headerInitial = isGroup ? conversation.name?.[0]?.toUpperCase() || 'G' : conversation.participant?.display_name?.[0]?.toUpperCase() || '?';
  const headerAvatarUrl = isGroup ? null : conversation.participant?.avatar_url;

  const memberMap = {};
  if (isGroup && conversation.members) {
    conversation.members.forEach((m) => { memberMap[m.id] = m.display_name; });
  }

  const renderMessage = ({ item: msg }) => {
    const isMine = msg.sender_id === user.id;
    const isDeleted = !!msg.deleted_at;
    let fileInfo = null;
    if ((msg.type === 'image' || msg.type === 'file') && msg.content) {
      try { fileInfo = JSON.parse(msg.content); } catch {}
    }

    return (
      <Pressable
        style={[s.msgRow, isMine ? s.msgRowMine : s.msgRowTheirs]}
        onLongPress={() => !isDeleted && setReactionMsgId(msg.id)}
      >
        <View style={[s.bubble, isMine ? { backgroundColor: theme.msgMine } : { backgroundColor: theme.msgTheirs, borderWidth: 1, borderColor: theme.borderLight }]}>
          {isDeleted ? (
            <Text style={[s.deletedText, { color: theme.textMuted }]}>🚫 This message was deleted</Text>
          ) : (
            <>
              {isGroup && !isMine && (
                <Text style={[s.senderName, { color: theme.groupColor }]}>
                  {msg.profiles?.display_name || memberMap[msg.sender_id] || 'Unknown'}
                </Text>
              )}
              {msg.type === 'image' && fileInfo ? (
                <Image source={{ uri: fileInfo.url }} style={s.msgImage} resizeMode="cover" />
              ) : msg.type === 'file' && fileInfo ? (
                <View style={s.fileCard}>
                  <Text style={{ fontSize: 24 }}>📄</Text>
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[s.fileName, { color: isMine ? theme.msgMineText : theme.msgTheirsText }]} numberOfLines={1}>{fileInfo.fileName}</Text>
                    <Text style={{ fontSize: 11, color: theme.textMuted }}>{(fileInfo.fileSize / 1024).toFixed(1)} KB</Text>
                  </View>
                </View>
              ) : (
                <Text style={[s.msgText, { color: isMine ? theme.msgMineText : theme.msgTheirsText }]}>{msg.content}</Text>
              )}
            </>
          )}
          {!isDeleted && msg.reactions?.length > 0 && (
            <View style={s.reactionPills}>
              {msg.reactions.map((r) => {
                const iReacted = r.users.some((u) => u.id === user.id);
                return (
                  <TouchableOpacity
                    key={r.emoji}
                    style={[s.pill, iReacted && { borderColor: theme.accent, backgroundColor: 'rgba(0,168,132,0.15)' }]}
                    onPress={() => toggleReaction(msg.id, r.emoji)}
                  >
                    <Text style={{ fontSize: 12 }}>{r.emoji} {r.users.length}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={s.msgMeta}>
            {msg.edited_at && !isDeleted && <Text style={[s.edited, { color: theme.textMuted }]}>edited </Text>}
            <Text style={[s.time, { color: theme.textMuted }]}>
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMine && !isDeleted && <View style={{ marginLeft: 4 }}><MessageStatus msg={msg} theme={theme} /></View>}
          </View>
        </View>

        {reactionMsgId === msg.id && (
          <View style={[s.reactionPicker, isMine ? { right: 10 } : { left: 10 }, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => toggleReaction(msg.id, emoji)} style={s.emojiBtn}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[s.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.borderLight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={{ color: theme.accent, fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerInfo}
            onPress={() => !isGroup && conversation.participant?.id && navigation.navigate('ViewProfile', { userId: conversation.participant.id })}
          >
            {headerAvatarUrl ? (
              <Image source={{ uri: headerAvatarUrl }} style={s.headerAvatar} />
            ) : (
              <View style={[s.headerAvatar, s.avatarPlaceholder, { backgroundColor: isGroup ? theme.groupColor : theme.accent }]}>
                <Text style={s.avatarText}>{headerInitial}</Text>
              </View>
            )}
            <View style={{ marginLeft: 10 }}>
              <Text style={[s.headerName, { color: theme.text }]}>{headerName}</Text>
              {isGroup && <Text style={{ fontSize: 12, color: theme.textMuted }}>{conversation.members?.length || 0} members</Text>}
            </View>
          </TouchableOpacity>
          {!isGroup && (
            <View style={s.callBtns}>
              <TouchableOpacity onPress={() => { startCall(conversation.participant, 'voice'); navigation.navigate('Call'); }} style={s.callBtn}>
                <Text style={{ fontSize: 20 }}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { startCall(conversation.participant, 'video'); navigation.navigate('Call'); }} style={s.callBtn}>
                <Text style={{ fontSize: 20 }}>📹</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 10 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListFooterComponent={typing ? <Text style={[s.typing, { color: theme.accent }]}>typing...</Text> : null}
        />

        <View style={[s.inputRow, { backgroundColor: theme.bgSecondary, borderTopColor: theme.borderLight }]}>
          <TouchableOpacity onPress={pickImage} disabled={uploading} style={s.attachBtn}>
            <Text style={{ fontSize: 22 }}>{uploading ? '⏳' : '🖼️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickDocument} disabled={uploading} style={s.attachBtn}>
            <Text style={{ fontSize: 20 }}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={handleInputChange}
            multiline
          />
          <TouchableOpacity style={[s.sendBtn, { backgroundColor: theme.accent }]} onPress={sendMessage}>
            <Text style={{ color: '#111', fontWeight: '700' }}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  backBtn: { padding: 6 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerName: { fontWeight: '600', fontSize: 16 },
  callBtns: { flexDirection: 'row', marginLeft: 'auto' },
  callBtn: { padding: 8 },
  msgRow: { marginBottom: 6 },
  msgRowMine: { alignItems: 'flex-end' },
  msgRowTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 12 },
  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  msgText: { fontSize: 15, lineHeight: 20 },
  deletedText: { fontStyle: 'italic', fontSize: 14 },
  msgImage: { width: 200, height: 150, borderRadius: 8 },
  fileCard: { flexDirection: 'row', alignItems: 'center' },
  fileName: { fontSize: 13, fontWeight: '600' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  time: { fontSize: 11 },
  edited: { fontSize: 11, fontStyle: 'italic' },
  reactionPills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#ccc' },
  reactionPicker: { position: 'absolute', top: -40, flexDirection: 'row', padding: 6, borderRadius: 20, borderWidth: 1, zIndex: 10 },
  emojiBtn: { paddingHorizontal: 4 },
  typing: { fontStyle: 'italic', fontSize: 13, marginLeft: 10, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 1 },
  attachBtn: { padding: 6 },
  input: { flex: 1, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, fontSize: 15, marginHorizontal: 6 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
});
